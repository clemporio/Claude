import Snoowrap from 'snoowrap';
import { config } from '../config';
import type { RawPost } from '../types';
import { opportunityExists } from '../queue/queue';
import { getPrioritySubredditsNow, getActiveSubreddits } from '../audience/intelligence';

let client: Snoowrap | null = null;

function getClient(): Snoowrap {
  if (!client) {
    if (!config.reddit.clientId || !config.reddit.clientSecret) {
      throw new Error('Reddit API credentials not configured');
    }
    client = new Snoowrap({
      userAgent: config.reddit.userAgent,
      clientId: config.reddit.clientId,
      clientSecret: config.reddit.clientSecret,
      username: config.reddit.username,
      password: config.reddit.password,
    });
    client.config({ requestDelay: 1100, continueAfterRatelimitError: true });
  }
  return client;
}

export async function scanReddit(): Promise<RawPost[]> {
  const r = getClient();
  const posts: RawPost[] = [];
  const now = Date.now();
  const maxAge = config.reddit.maxPostAge;

  // Use audience intelligence to pick subreddits based on time of day
  const prioritySubs = getPrioritySubredditsNow();
  const allSubs = getActiveSubreddits();

  // Scan priority subs (active audiences now) + always scan general subs
  const subsToScan = Array.from(new Set([...prioritySubs, ...config.reddit.subreddits]));

  console.log(`[Reddit] Scanning ${subsToScan.length} subreddits (${prioritySubs.length} priority for current time)...`);

  for (const sub of subsToScan) {
    try {
      const newPosts = await r.getSubreddit(sub).getNew({ limit: 25 });

      for (const post of newPosts) {
        const postAge = now - (post.created_utc * 1000);
        if (postAge > maxAge) continue;
        if (post.score < config.reddit.minUpvotes) continue;

        const externalId = post.id;
        if (opportunityExists('reddit', externalId)) continue;

        posts.push({
          platform: 'reddit',
          externalId,
          url: `https://reddit.com${post.permalink}`,
          title: post.title,
          body: (post.selftext || '').slice(0, 2000),
          author: post.author?.name || '[deleted]',
          subreddit: sub,
          upvotes: post.score,
          comments: post.num_comments,
          createdAt: new Date(post.created_utc * 1000),
          fetchedAt: new Date(),
        });
      }

      console.log(`[Reddit] r/${sub}: found ${newPosts.length} posts, ${posts.length} new candidates total`);
    } catch (err: any) {
      console.error(`[Reddit] Error scanning r/${sub}: ${err.message}`);
    }
  }

  // Also search for betting-related queries across Reddit
  const searchQueries = [
    'betting signals discord',
    'sports betting tips community',
    'data driven betting',
    'looking for tipster',
  ];

  for (const query of searchQueries) {
    try {
      const results = await r.search({
        query,
        sort: 'new',
        time: 'day',
        limit: 15,
      });

      for (const post of results) {
        const postAge = now - (post.created_utc * 1000);
        if (postAge > maxAge) continue;

        const externalId = post.id;
        if (opportunityExists('reddit', externalId)) continue;
        if (posts.some(p => p.externalId === externalId)) continue;

        posts.push({
          platform: 'reddit',
          externalId,
          url: `https://reddit.com${post.permalink}`,
          title: post.title,
          body: (post.selftext || '').slice(0, 2000),
          author: post.author?.name || '[deleted]',
          subreddit: post.subreddit?.display_name || '',
          upvotes: post.score,
          comments: post.num_comments,
          createdAt: new Date(post.created_utc * 1000),
          fetchedAt: new Date(),
        });
      }
    } catch (err: any) {
      console.error(`[Reddit] Search error for "${query}": ${err.message}`);
    }
  }

  console.log(`[Reddit] Total new candidates: ${posts.length}`);
  return posts;
}
