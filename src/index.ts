import cron from 'node-cron';
import { config } from './config';
import { initDb, expireOldDrafts, incrementMetric, insertOpportunity, insertDraft } from './queue/queue';
import { scanReddit } from './monitors/reddit';
import { scanTwitter } from './monitors/twitter';
import { scanForums } from './monitors/forums';
import { scoreRelevance } from './scoring/relevance';
import { scoreOpportunity } from './scoring/opportunity';
import { generateDrafts } from './drafting/drafter';
import type { RawPost, ScoredPost, Platform } from './types';

async function processPosts(posts: RawPost[]): Promise<void> {
  console.log(`[Pipeline] Processing ${posts.length} raw posts...`);

  for (const post of posts) {
    try {
      // Score relevance
      const relevance = await scoreRelevance(post);
      incrementMetric(post.platform, 'posts_scored');

      if (relevance.total < config.scoring.relevanceThreshold) {
        continue;
      }

      // Score opportunity
      const opportunity = scoreOpportunity(post);

      if (opportunity.total < config.scoring.opportunityThreshold) {
        continue;
      }

      // Normalise: relevance is 0-100, opportunity is 0-125 (with audience bonus)
      // Combined score is weighted average, normalised to 0-100
      const combinedScore = (relevance.total * 0.45) + (Math.min(opportunity.total, 125) / 125 * 100 * 0.55);

      // Store opportunity
      const oppId = insertOpportunity({
        platform: post.platform,
        externalId: post.externalId,
        url: post.url,
        title: post.title,
        body: post.body,
        author: post.author,
        subreddit: post.subreddit,
        forumName: post.forumName,
        relevanceScore: relevance.total,
        opportunityScore: opportunity.total,
        combinedScore,
        intentLabel: relevance.intentLabel,
        createdAt: post.createdAt.toISOString(),
      });

      if (oppId === 0) continue; // Already exists

      // Generate drafts
      const scored: ScoredPost = {
        ...post,
        relevance,
        opportunity,
        combinedScore,
      };

      const drafts = await generateDrafts(scored);

      insertDraft({
        opportunityId: oppId,
        platform: post.platform,
        postUrl: post.url,
        postTitle: post.title,
        postBody: post.body,
        draftText: drafts.primary,
        alternateText: drafts.alternate,
        relevanceScore: relevance.total,
        opportunityScore: opportunity.total,
        combinedScore,
      });

      incrementMetric(post.platform, 'drafts_generated');
      console.log(`[Pipeline] Draft created for ${post.platform} post: ${post.title.slice(0, 60)}... (score: ${combinedScore.toFixed(0)})`);
    } catch (err: any) {
      console.error(`[Pipeline] Error processing post ${post.externalId}: ${err.message}`);
    }
  }
}

async function runRedditScan(): Promise<void> {
  try {
    const posts = await scanReddit();
    incrementMetric('reddit', 'posts_found', posts.length);
    await processPosts(posts);
  } catch (err: any) {
    console.error(`[Scheduler] Reddit scan failed: ${err.message}`);
  }
}

async function runTwitterScan(): Promise<void> {
  try {
    const posts = await scanTwitter();
    incrementMetric('twitter', 'posts_found', posts.length);
    await processPosts(posts);
  } catch (err: any) {
    console.error(`[Scheduler] Twitter scan failed: ${err.message}`);
  }
}

async function runForumScan(): Promise<void> {
  try {
    const posts = await scanForums();
    incrementMetric('forum', 'posts_found', posts.length);
    await processPosts(posts);
  } catch (err: any) {
    console.error(`[Scheduler] Forum scan failed: ${err.message}`);
  }
}

function runExpiry(): void {
  const expired = expireOldDrafts();
  if (expired > 0) {
    console.log(`[Scheduler] Expired ${expired} stale drafts`);
  }
}

function startScheduler(): void {
  console.log('[Scout Bot] Starting scheduler...');
  console.log(`[Scout Bot] Reddit: every ${config.reddit.scanIntervalMinutes}m`);
  console.log(`[Scout Bot] Twitter: every ${config.twitter.scanIntervalMinutes}m`);
  console.log(`[Scout Bot] Forums: every ${config.forums.scanIntervalMinutes}m`);

  // Reddit scan
  cron.schedule(`*/${config.reddit.scanIntervalMinutes} * * * *`, () => {
    runRedditScan();
  });

  // Twitter scan
  cron.schedule(`*/${config.twitter.scanIntervalMinutes} * * * *`, () => {
    runTwitterScan();
  });

  // Forum scan
  cron.schedule(`*/${config.forums.scanIntervalMinutes} * * * *`, () => {
    runForumScan();
  });

  // Expire old drafts every hour
  cron.schedule('0 * * * *', () => {
    runExpiry();
  });

  // Run initial scans on startup
  console.log('[Scout Bot] Running initial scans...');
  runRedditScan();
  runTwitterScan();
  runForumScan();
}

async function main(): Promise<void> {
  console.log('[Scout Bot] Initializing...');
  await initDb();
  startScheduler();
  console.log('[Scout Bot] Running. Press Ctrl+C to stop.');
}

main().catch(err => {
  console.error('[Scout Bot] Fatal error:', err);
  process.exit(1);
});
