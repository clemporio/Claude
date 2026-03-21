import { TwitterApi } from 'twitter-api-v2';
import { config } from '../config';
import type { RawPost } from '../types';
import { opportunityExists } from '../queue/queue';

let client: TwitterApi | null = null;

function getClient(): TwitterApi {
  if (!client) {
    if (!config.twitter.bearerToken) {
      throw new Error('Twitter bearer token not configured');
    }
    client = new TwitterApi(config.twitter.bearerToken);
  }
  return client;
}

function buildSearchQuery(): string {
  const keywordParts = config.twitter.keywords
    .map(k => `"${k}"`)
    .join(' OR ');

  const hashtagParts = config.twitter.hashtags
    .map(h => `#${h}`)
    .join(' OR ');

  // Exclude retweets, require English
  return `(${keywordParts} OR ${hashtagParts}) lang:en -is:retweet`;
}

export async function scanTwitter(): Promise<RawPost[]> {
  const api = getClient().readOnly;
  const posts: RawPost[] = [];

  console.log('[Twitter] Scanning for betting-related tweets...');

  try {
    const query = buildSearchQuery();

    const result = await api.v2.search(query, {
      max_results: config.twitter.maxResults,
      'tweet.fields': ['created_at', 'public_metrics', 'author_id', 'text'],
      'user.fields': ['username', 'public_metrics'],
      expansions: ['author_id'],
      sort_order: 'recency',
    });

    const users = new Map<string, any>();
    if (result.includes?.users) {
      for (const user of result.includes.users) {
        users.set(user.id, user);
      }
    }

    const tweets = result.data?.data || [];
    for (const tweet of tweets) {
      const externalId = tweet.id;
      if (opportunityExists('twitter', externalId)) continue;

      const author = users.get(tweet.author_id || '');
      const username = author?.username || 'unknown';
      const followers = author?.public_metrics?.followers_count || 0;

      posts.push({
        platform: 'twitter',
        externalId,
        url: `https://x.com/${username}/status/${tweet.id}`,
        title: '', // Tweets don't have titles
        body: tweet.text,
        author: username,
        followers,
        likes: tweet.public_metrics?.like_count || 0,
        retweets: tweet.public_metrics?.retweet_count || 0,
        comments: tweet.public_metrics?.reply_count || 0,
        createdAt: new Date(tweet.created_at || Date.now()),
        fetchedAt: new Date(),
      });
    }

    console.log(`[Twitter] Found ${posts.length} new candidates`);
  } catch (err: any) {
    console.error(`[Twitter] Error: ${err.message}`);
    if (err.code === 429) {
      console.error('[Twitter] Rate limited. Will retry next scan cycle.');
    }
  }

  return posts;
}
