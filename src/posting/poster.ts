import Snoowrap from 'snoowrap';
import { TwitterApi } from 'twitter-api-v2';
import { config } from '../config';
import type { Draft, Platform } from '../types';
import { canPost, recordPost } from '../safety/rails';
import { recordPostToDb } from '../queue/queue';

// --- Reddit Client (user-authenticated, can post) ---

let redditClient: Snoowrap | null = null;

function getRedditClient(): Snoowrap {
  if (!redditClient) {
    if (!config.reddit.clientId || !config.reddit.clientSecret ||
        !config.reddit.username || !config.reddit.password) {
      throw new Error('Reddit posting credentials not configured');
    }
    redditClient = new Snoowrap({
      userAgent: config.reddit.userAgent,
      clientId: config.reddit.clientId,
      clientSecret: config.reddit.clientSecret,
      username: config.reddit.username,
      password: config.reddit.password,
    });
    redditClient.config({ requestDelay: 2000, continueAfterRatelimitError: true });
  }
  return redditClient;
}

// --- Twitter Client (user-authenticated via OAuth 1.0a, can post) ---

let twitterClient: TwitterApi | null = null;

function getTwitterClient(): TwitterApi {
  if (!twitterClient) {
    const creds = config.twitter;
    if (!creds.apiKey || !creds.apiSecret || !creds.accessToken || !creds.accessSecret) {
      throw new Error('Twitter posting credentials not configured. Need API key, secret, access token, and access secret.');
    }
    twitterClient = new TwitterApi({
      appKey: creds.apiKey,
      appSecret: creds.apiSecret,
      accessToken: creds.accessToken,
      accessSecret: creds.accessSecret,
    });
  }
  return twitterClient;
}

// --- Post Result ---

export interface PostResult {
  success: boolean;
  platform: Platform;
  postedUrl?: string;
  error?: string;
  safetyBlocked?: boolean;
  safetyReason?: string;
}

// --- Reddit Posting ---

async function postToReddit(draft: Draft, subreddit?: string): Promise<PostResult> {
  try {
    const r = getRedditClient();

    // Extract the Reddit post ID from the URL
    // URL format: https://reddit.com/r/sub/comments/POST_ID/title/
    const match = draft.postUrl.match(/comments\/([a-z0-9]+)/i);
    if (!match) {
      return { success: false, platform: 'reddit', error: 'Could not extract Reddit post ID from URL' };
    }

    const postId = match[1];
    const submission = r.getSubmission(postId);

    // Post as a comment on the thread
    const comment = await (submission as any).reply(draft.draftText);
    const commentUrl = `https://reddit.com${comment.permalink}`;

    console.log(`[Poster] Reddit comment posted: ${commentUrl}`);

    const mentionsDiscord = draft.draftText.toLowerCase().includes('discord');
    recordPost('reddit', mentionsDiscord, subreddit);
    recordPostToDb({
      draftId: draft.id,
      platform: 'reddit',
      subreddit,
      hadDiscordMention: mentionsDiscord,
      postedUrl: commentUrl,
    });

    return { success: true, platform: 'reddit', postedUrl: commentUrl };
  } catch (err: any) {
    console.error(`[Poster] Reddit post failed: ${err.message}`);
    recordPostToDb({ platform: 'reddit', subreddit, hadDiscordMention: false, error: err.message });
    return { success: false, platform: 'reddit', error: err.message };
  }
}

// --- Twitter Posting ---

async function postToTwitter(draft: Draft): Promise<PostResult> {
  try {
    const api = getTwitterClient();

    // Twitter API blocks cold replies (403) regardless of Premium status.
    // Replies go via email to Conor for manual posting from the app.
    // Bot only posts standalone tweets.
    const result = await api.v2.tweet(draft.draftText);

    const postedUrl = `https://x.com/i/status/${result.data.id}`;
    console.log(`[Poster] Tweet posted: ${postedUrl}`);

    const mentionsDiscord = draft.draftText.toLowerCase().includes('discord');
    recordPost('twitter', mentionsDiscord);
    recordPostToDb({
      draftId: draft.id,
      platform: 'twitter',
      hadDiscordMention: mentionsDiscord,
      postedUrl,
    });

    return { success: true, platform: 'twitter', postedUrl };
  } catch (err: any) {
    console.error(`[Poster] Twitter post failed: ${err.message}`);
    recordPostToDb({ platform: 'twitter', hadDiscordMention: false, error: err.message });

    if (err.code === 429) {
      return { success: false, platform: 'twitter', error: 'Rate limited by Twitter. Will retry later.' };
    }
    if (err.code === 403) {
      return { success: false, platform: 'twitter', error: 'Twitter returned 403 Forbidden. Check API permissions (need read+write access).' };
    }

    return { success: false, platform: 'twitter', error: err.message };
  }
}

// --- Master Post Function ---

export async function postDraft(draft: Draft, subreddit?: string): Promise<PostResult> {
  // Safety gate — check ALL rails before attempting
  const safetyCheck = canPost(draft, subreddit);
  if (!safetyCheck.allowed) {
    console.log(`[Poster] BLOCKED by safety rails: ${safetyCheck.reason}`);
    return {
      success: false,
      platform: draft.platform,
      safetyBlocked: true,
      safetyReason: safetyCheck.reason,
    };
  }

  switch (draft.platform) {
    case 'reddit':
      return postToReddit(draft, subreddit);
    case 'twitter':
      return postToTwitter(draft);
    case 'forum':
      // Forum posting not automated — too many different auth mechanisms
      // Drafts for forums are always manual
      return {
        success: false,
        platform: 'forum',
        error: 'Forum posting is manual only. Copy draft and post from your browser.',
      };
    default:
      return { success: false, platform: draft.platform, error: `Unknown platform: ${draft.platform}` };
  }
}
