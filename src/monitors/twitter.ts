import { TwitterApi } from 'twitter-api-v2';
import { config } from '../config';
import type { RawPost } from '../types';
import { opportunityExists } from '../queue/queue';
import { getActiveTwitterKeywords, getActiveTwitterHashtags } from '../audience/intelligence';

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

// Twitter free tier query limit is ~512 chars. We rotate through keyword batches
// to cover more ground across scan cycles without exceeding the limit.
let queryRotation = 0;

function buildSearchQuery(): string {
  const MAX_QUERY_LENGTH = 480; // Leave headroom for lang:en and -is:retweet suffix
  const suffix = ' lang:en -is:retweet';

  // Merge config keywords with audience-driven keywords
  const allKeywords = Array.from(new Set([
    ...config.twitter.keywords,
    ...getActiveTwitterKeywords(),
  ]));
  const allHashtags = Array.from(new Set([
    ...config.twitter.hashtags,
    ...getActiveTwitterHashtags(),
  ]));

  // Rotate starting position each scan cycle
  const BATCH_SIZE_KW = 8;
  const BATCH_SIZE_HT = 5;
  const kwStart = (queryRotation * BATCH_SIZE_KW) % allKeywords.length;
  const htStart = (queryRotation * BATCH_SIZE_HT) % allHashtags.length;
  queryRotation++;

  // Slice with wraparound
  const kwBatch = [
    ...allKeywords.slice(kwStart, kwStart + BATCH_SIZE_KW),
    ...allKeywords.slice(0, Math.max(0, (kwStart + BATCH_SIZE_KW) - allKeywords.length)),
  ].slice(0, BATCH_SIZE_KW);

  const htBatch = [
    ...allHashtags.slice(htStart, htStart + BATCH_SIZE_HT),
    ...allHashtags.slice(0, Math.max(0, (htStart + BATCH_SIZE_HT) - allHashtags.length)),
  ].slice(0, BATCH_SIZE_HT);

  // Build query, trimming if needed
  let parts: string[] = [];
  for (const kw of kwBatch) {
    parts.push(`"${kw}"`);
  }
  for (const ht of htBatch) {
    parts.push(`#${ht}`);
  }

  // Trim parts until query fits
  let query = `(${parts.join(' OR ')})${suffix}`;
  while (query.length > MAX_QUERY_LENGTH && parts.length > 2) {
    parts.pop();
    query = `(${parts.join(' OR ')})${suffix}`;
  }

  return query;
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
      'user.fields': ['username', 'public_metrics', 'verified', 'verified_type', 'created_at', 'description'],
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
      const metrics = author?.public_metrics || {};
      const followers = metrics.followers_count || 0;
      const following = metrics.following_count || 0;
      const tweetCount = metrics.tweet_count || 0;

      // --- Account Quality Filters (zero extra API calls) ---

      // Must be verified
      const isVerified = author?.verified === true || !!author?.verified_type;
      if (!isVerified) continue;

      // Follower/following ratio filter: reject follow-for-follow accounts
      // Ratio < 1.5 with 5k+ following = likely junk (unless very new)
      if (followers > 0 && following > 5000 && (followers / following) < 1.5) continue;

      // Account age: reject accounts less than 90 days old (likely bought/bot)
      const accountCreated = author?.created_at ? new Date(author.created_at) : null;
      if (accountCreated) {
        const ageDays = (Date.now() - accountCreated.getTime()) / (1000 * 60 * 60 * 24);
        if (ageDays < 90) continue;
      }

      // Tweet volume sanity: reject hyperactive accounts (>100 tweets/day avg = bot)
      if (accountCreated && tweetCount > 0) {
        const ageDays = Math.max(1, (Date.now() - accountCreated.getTime()) / (1000 * 60 * 60 * 24));
        const tweetsPerDay = tweetCount / ageDays;
        if (tweetsPerDay > 100) continue;
      }

      // Calculate engagement rate for the opportunity scorer
      // Uses this specific tweet's engagement vs follower count
      const tweetLikes = tweet.public_metrics?.like_count || 0;
      const tweetRetweets = tweet.public_metrics?.retweet_count || 0;
      const tweetReplies = tweet.public_metrics?.reply_count || 0;
      const tweetEngagement = tweetLikes + tweetRetweets + tweetReplies;
      const engagementRate = followers > 0 ? tweetEngagement / followers : 0;

      // Bio context — passed through for the drafter/scorer
      const bio = author?.description || '';

      posts.push({
        platform: 'twitter',
        externalId,
        url: `https://x.com/${username}/status/${tweet.id}`,
        title: bio.slice(0, 200), // Repurpose title field for bio (used in scoring/drafting)
        body: tweet.text,
        author: username,
        followers,
        following,
        tweetCount,
        engagementRate,
        likes: tweetLikes,
        retweets: tweetRetweets,
        comments: tweetReplies,
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
