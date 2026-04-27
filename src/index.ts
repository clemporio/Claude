import cron from 'node-cron';
import { config } from './config';
import { initDb, closeDb, expireOldDrafts, expireStalePendingAi, incrementMetric, insertOpportunity, insertPendingAi, getPostHistory } from './queue/queue';
import { scanReddit } from './monitors/reddit';
import { scanTwitter } from './monitors/twitter';
import { scanForums } from './monitors/forums';
import { scoreRelevanceLocal } from './scoring/relevance';
import { scoreOpportunity } from './scoring/opportunity';
import { loadPostHistory } from './safety/rails';
import type { RawPost, Platform } from './types';

async function processPosts(posts: RawPost[]): Promise<void> {
  console.log(`[Pipeline] Processing ${posts.length} raw posts...`);

  for (const post of posts) {
    try {
      // Score relevance (keyword + topic + freshness only — no AI)
      const relevance = scoreRelevanceLocal(post);
      incrementMetric(post.platform, 'posts_scored');

      if (relevance.total < config.scoring.relevanceThreshold) {
        continue;
      }

      // Score opportunity
      const opportunity = scoreOpportunity(post);

      if (opportunity.total < config.scoring.opportunityThreshold) {
        continue;
      }

      // Combined score — opportunity (reach-heavy) weighted more than relevance
      const combinedScore = (relevance.total * 0.3) + (Math.min(opportunity.total, 120) / 120 * 100 * 0.7);

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
        intentLabel: 'pending_gecko',
        createdAt: post.createdAt.toISOString(),
      });

      if (oppId === 0) continue; // Already exists

      // Queue for Gecko's AI processing (intent classification + draft generation)
      insertPendingAi({
        opportunityId: oppId,
        platform: post.platform,
        url: post.url,
        title: post.title,
        body: post.body,
        subreddit: post.subreddit,
        keywordScore: relevance.keyword,
        topicScore: relevance.topic,
        freshnessScore: relevance.freshness,
        opportunityScore: opportunity.total,
        detectedSports: relevance.detectedSports,
        detectedRegions: relevance.detectedRegions,
      });

      console.log(`[Pipeline] Queued for Gecko: ${post.platform} post: ${post.title.slice(0, 60)}... (prelim score: ${combinedScore.toFixed(0)})`);
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
  const expiredDrafts = expireOldDrafts();
  if (expiredDrafts > 0) {
    console.log(`[Scheduler] Expired ${expiredDrafts} stale drafts`);
  }
  const expiredAi = expireStalePendingAi(6);
  if (expiredAi > 0) {
    console.log(`[Scheduler] Expired ${expiredAi} stale pending_ai items (>6h old)`);
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

  // Load post history into safety rails so limits survive restarts
  const history = getPostHistory(7);
  loadPostHistory(history);
  console.log(`[Scout Bot] Loaded ${history.length} post history records into safety rails`);

  startScheduler();
  console.log('[Scout Bot] Running. Press Ctrl+C to stop.');
}

// Graceful shutdown — flush DB before exit
function shutdown(signal: string): void {
  console.log(`[Scout Bot] ${signal} received, shutting down...`);
  closeDb();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

main().catch(err => {
  console.error('[Scout Bot] Fatal error:', err);
  closeDb();
  process.exit(1);
});
