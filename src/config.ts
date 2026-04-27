import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

function num(key: string, fallback: number): number {
  const val = process.env[key];
  return val ? parseInt(val, 10) : fallback;
}

export const config = {
  reddit: {
    clientId: optional('REDDIT_CLIENT_ID', ''),
    clientSecret: optional('REDDIT_CLIENT_SECRET', ''),
    username: optional('REDDIT_USERNAME', ''),
    password: optional('REDDIT_PASSWORD', ''),
    userAgent: optional('REDDIT_USER_AGENT', 'scout-bot/1.0'),
    subreddits: [
      'sportsbook', 'sportsbetting', 'gambling', 'bettingadvice',
      'soccer', 'nba', 'tennis', 'horseracing',
      'fantasyfootball', 'MMA', 'boxing'
    ],
    scanIntervalMinutes: num('REDDIT_SCAN_INTERVAL', 30),
    maxPostAge: 6 * 60 * 60 * 1000, // 6 hours in ms
    minUpvotes: 1,
  },

  twitter: {
    bearerToken: optional('TWITTER_BEARER_TOKEN', ''),
    apiKey: optional('TWITTER_API_KEY', ''),
    apiSecret: optional('TWITTER_API_SECRET', ''),
    accessToken: optional('TWITTER_ACCESS_TOKEN', ''),
    accessSecret: optional('TWITTER_ACCESS_SECRET', ''),
    keywords: [
      'betting signals', 'sports picks', 'betting tips', 'free picks',
      'betting discord', 'tipster', 'data betting', 'sports betting model',
      'betting algorithm', 'sharp picks', 'value bets', 'betting community'
    ],
    hashtags: [
      'SportsBetting', 'BettingTips', 'FreePicks', 'GamblingTwitter',
      'BettingCommunity', 'SharpBetting'
    ],
    scanIntervalMinutes: num('TWITTER_SCAN_INTERVAL', 15),
    maxResults: 50,
  },

  forums: {
    scanIntervalMinutes: num('FORUM_SCAN_INTERVAL', 60),
    targets: [
      {
        name: 'Covers',
        baseUrl: 'https://www.covers.com',
        newPostsPath: '/forum/sports-betting-pair/',
        postSelector: '.thread-list .thread-item',
        titleSelector: '.thread-title a',
        bodySelector: '.thread-preview',
        authorSelector: '.thread-author',
        dateSelector: '.thread-date',
        linkSelector: '.thread-title a',
      },
      {
        name: 'OLBG',
        baseUrl: 'https://www.olbg.com',
        newPostsPath: '/forum/',
        postSelector: '.forum-topic',
        titleSelector: '.topic-title a',
        bodySelector: '.topic-preview',
        authorSelector: '.topic-author',
        dateSelector: '.topic-date',
        linkSelector: '.topic-title a',
      },
    ],
  },

  scoring: {
    relevanceThreshold: num('RELEVANCE_THRESHOLD', 28),
    opportunityThreshold: num('OPPORTUNITY_THRESHOLD', 30),
  },

  discord: {
    invites: {
      reddit: optional('DISCORD_INVITE_REDDIT', 'https://discord.gg/nVNAAWyv'),
      twitter: optional('DISCORD_INVITE_TWITTER', 'https://discord.gg/nVNAAWyv'),
      forums: optional('DISCORD_INVITE_FORUMS', 'https://discord.gg/nVNAAWyv'),
      default: optional('DISCORD_INVITE_DEFAULT', 'https://discord.gg/nVNAAWyv'),
    },
  },

  drafting: {
    expiryHours: num('DRAFT_EXPIRY_HOURS', 12),
  },

  safety: {
    maxPostsPerDay: num('SAFETY_MAX_POSTS_PER_DAY', 8),
    maxRedditPostsPerDay: num('SAFETY_MAX_REDDIT_PER_DAY', 4),
    maxTwitterPostsPerDay: num('SAFETY_MAX_TWITTER_PER_DAY', 15),
    maxForumPostsPerDay: num('SAFETY_MAX_FORUM_PER_DAY', 2),
    discordMentionRatio: num('SAFETY_DISCORD_MENTION_RATIO', 4),
    redditCooldownMinutes: num('SAFETY_REDDIT_COOLDOWN_MIN', 90),
    twitterCooldownMinutes: num('SAFETY_TWITTER_COOLDOWN_MIN', 20),
    forumCooldownMinutes: num('SAFETY_FORUM_COOLDOWN_MIN', 120),
    maxPostsPerSubredditPerDay: num('SAFETY_MAX_PER_SUBREDDIT', 1),
    subredditCooldownHours: num('SAFETY_SUBREDDIT_COOLDOWN_HR', 24),
  },

  db: {
    path: path.resolve(__dirname, '..', 'data', 'scout.db'),
  },
};
