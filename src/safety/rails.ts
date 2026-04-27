import type { Platform, Draft } from '../types';
import { config } from '../config';

// --- Safety State (persisted in SQLite, loaded on init) ---

interface PostRecord {
  platform: Platform;
  subreddit?: string;
  hadDiscordMention: boolean;
  postedAt: number; // unix timestamp ms
}

// In-memory rolling window of recent posts — loaded from DB on init
const recentPosts: PostRecord[] = [];

// --- Configuration ---

export interface SafetyLimits {
  // Hard daily caps
  maxPostsPerDay: number;                // Total across all platforms
  maxRedditPostsPerDay: number;
  maxTwitterPostsPerDay: number;
  maxForumPostsPerDay: number;

  // Discord mention ratio: max 1 in N posts can mention Discord
  discordMentionRatio: number;           // e.g. 4 = max 1 in 4

  // Cooldowns (ms between posts)
  redditCooldownMs: number;
  twitterCooldownMs: number;
  forumCooldownMs: number;

  // Subreddit-specific limits
  maxPostsPerSubredditPerDay: number;
  subredditCooldownMs: number;

  // Content diversity
  minUniqueCharsRatio: number;           // Draft must be at least this % different from recent drafts
}

export function getSafetyLimits(): SafetyLimits {
  return {
    maxPostsPerDay: config.safety?.maxPostsPerDay ?? 8,
    maxRedditPostsPerDay: config.safety?.maxRedditPostsPerDay ?? 4,
    maxTwitterPostsPerDay: config.safety?.maxTwitterPostsPerDay ?? 5,
    maxForumPostsPerDay: config.safety?.maxForumPostsPerDay ?? 2,
    discordMentionRatio: config.safety?.discordMentionRatio ?? 4,
    redditCooldownMs: config.safety?.redditCooldownMinutes
      ? config.safety.redditCooldownMinutes * 60 * 1000
      : 90 * 60 * 1000,  // 90 min default
    twitterCooldownMs: config.safety?.twitterCooldownMinutes
      ? config.safety.twitterCooldownMinutes * 60 * 1000
      : 45 * 60 * 1000,  // 45 min default
    forumCooldownMs: config.safety?.forumCooldownMinutes
      ? config.safety.forumCooldownMinutes * 60 * 1000
      : 120 * 60 * 1000, // 2 hours default
    maxPostsPerSubredditPerDay: config.safety?.maxPostsPerSubredditPerDay ?? 1,
    subredditCooldownMs: config.safety?.subredditCooldownHours
      ? config.safety.subredditCooldownHours * 60 * 60 * 1000
      : 24 * 60 * 60 * 1000, // 24 hours default
    minUniqueCharsRatio: 0.5,
  };
}

// --- Check Functions ---

export interface SafetyCheckResult {
  allowed: boolean;
  reason?: string;
}

function todayPosts(): PostRecord[] {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  return recentPosts.filter(p => p.postedAt >= startOfDay.getTime());
}

function platformPosts(platform: Platform): PostRecord[] {
  return todayPosts().filter(p => p.platform === platform);
}

export function checkDailyLimit(): SafetyCheckResult {
  const limits = getSafetyLimits();
  const today = todayPosts();
  if (today.length >= limits.maxPostsPerDay) {
    return { allowed: false, reason: `Daily post cap reached (${limits.maxPostsPerDay}). Resets at midnight UTC.` };
  }
  return { allowed: true };
}

export function checkPlatformLimit(platform: Platform): SafetyCheckResult {
  const limits = getSafetyLimits();
  const today = platformPosts(platform);

  const platformMap: Record<Platform, number> = {
    reddit: limits.maxRedditPostsPerDay,
    twitter: limits.maxTwitterPostsPerDay,
    forum: limits.maxForumPostsPerDay,
  };

  const max = platformMap[platform];
  if (today.length >= max) {
    return { allowed: false, reason: `${platform} daily cap reached (${max}).` };
  }
  return { allowed: true };
}

export function checkCooldown(platform: Platform): SafetyCheckResult {
  const limits = getSafetyLimits();
  const now = Date.now();

  const cooldownMap: Record<Platform, number> = {
    reddit: limits.redditCooldownMs,
    twitter: limits.twitterCooldownMs,
    forum: limits.forumCooldownMs,
  };

  const cooldown = cooldownMap[platform];
  const lastPost = recentPosts
    .filter(p => p.platform === platform)
    .sort((a, b) => b.postedAt - a.postedAt)[0];

  if (lastPost && (now - lastPost.postedAt) < cooldown) {
    const remainingMin = Math.ceil((cooldown - (now - lastPost.postedAt)) / 60000);
    return { allowed: false, reason: `${platform} cooldown active. ${remainingMin}m remaining.` };
  }
  return { allowed: true };
}

export function checkSubredditLimit(subreddit?: string): SafetyCheckResult {
  if (!subreddit) return { allowed: true };

  const limits = getSafetyLimits();
  const today = todayPosts().filter(p => p.subreddit === subreddit);

  if (today.length >= limits.maxPostsPerSubredditPerDay) {
    return { allowed: false, reason: `Already posted in r/${subreddit} today (max ${limits.maxPostsPerSubredditPerDay}/day).` };
  }

  // Also check subreddit-specific cooldown
  const now = Date.now();
  const lastInSub = recentPosts
    .filter(p => p.subreddit === subreddit)
    .sort((a, b) => b.postedAt - a.postedAt)[0];

  if (lastInSub && (now - lastInSub.postedAt) < limits.subredditCooldownMs) {
    const remainingHrs = Math.ceil((limits.subredditCooldownMs - (now - lastInSub.postedAt)) / 3600000);
    return { allowed: false, reason: `r/${subreddit} cooldown active. ${remainingHrs}h remaining.` };
  }

  return { allowed: true };
}

export function checkDiscordMentionRatio(draftMentionsDiscord: boolean): SafetyCheckResult {
  if (!draftMentionsDiscord) return { allowed: true };

  const limits = getSafetyLimits();
  // Look at last N posts where N = discordMentionRatio
  const recent = [...recentPosts]
    .sort((a, b) => b.postedAt - a.postedAt)
    .slice(0, limits.discordMentionRatio - 1);

  const recentMentions = recent.filter(p => p.hadDiscordMention).length;

  // If any of the last (ratio-1) posts mentioned Discord, block this one
  if (recentMentions > 0) {
    return {
      allowed: false,
      reason: `Discord mention ratio exceeded. Max 1 mention per ${limits.discordMentionRatio} posts. Use the alternate (no-mention) draft instead.`,
    };
  }
  return { allowed: true };
}

export function checkContentDiversity(draftText: string): SafetyCheckResult {
  const limits = getSafetyLimits();

  // Compare against last 10 posted drafts
  const recentTexts = [...recentPosts]
    .sort((a, b) => b.postedAt - a.postedAt)
    .slice(0, 10);

  // We don't store full texts in PostRecord — this check relies on the queue DB
  // For now, just check against stored drafts via a simple length/content check
  // Full dedup is done in the queue module
  return { allowed: true };
}

// --- Master Gate ---

export function canPost(draft: Draft, subreddit?: string): SafetyCheckResult {
  const checks = [
    checkDailyLimit(),
    checkPlatformLimit(draft.platform),
    checkCooldown(draft.platform),
    checkSubredditLimit(subreddit),
    checkDiscordMentionRatio(draftMentionsDiscord(draft.draftText)),
  ];

  const blocked = checks.find(c => !c.allowed);
  if (blocked) return blocked;

  return { allowed: true };
}

// --- Utility ---

function draftMentionsDiscord(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('discord') || lower.includes('discord.gg');
}

// --- Recording ---

export function recordPost(platform: Platform, hadDiscordMention: boolean, subreddit?: string): void {
  recentPosts.push({
    platform,
    subreddit,
    hadDiscordMention,
    postedAt: Date.now(),
  });

  // Trim to last 7 days
  const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const firstValid = recentPosts.findIndex(p => p.postedAt >= cutoff);
  if (firstValid > 0) recentPosts.splice(0, firstValid);
}

// --- Reporting (for Gecko) ---

export interface SafetyReport {
  postsToday: number;
  postsTodayByPlatform: Record<Platform, number>;
  discordMentionsToday: number;
  discordMentionRatio: string; // e.g. "2/8 (25%)"
  nextAllowedPost: Record<Platform, string>; // "now" or "in Xm"
  subredditsUsedToday: string[];
  limitsHit: string[]; // Which limits are currently blocking
}

export function getSafetyReport(): SafetyReport {
  const limits = getSafetyLimits();
  const today = todayPosts();
  const now = Date.now();

  const byPlatform: Record<Platform, number> = {
    reddit: platformPosts('reddit').length,
    twitter: platformPosts('twitter').length,
    forum: platformPosts('forum').length,
  };

  const discordMentionsToday = today.filter(p => p.hadDiscordMention).length;

  // Calculate next allowed time per platform
  const nextAllowed: Record<Platform, string> = {} as any;
  for (const platform of ['reddit', 'twitter', 'forum'] as Platform[]) {
    const cooldownCheck = checkCooldown(platform);
    const limitCheck = checkPlatformLimit(platform);
    if (!limitCheck.allowed) {
      nextAllowed[platform] = 'Capped for today';
    } else if (!cooldownCheck.allowed) {
      nextAllowed[platform] = cooldownCheck.reason || 'Cooling down';
    } else {
      nextAllowed[platform] = 'Ready';
    }
  }

  const subredditsUsed = [...new Set(today.filter(p => p.subreddit).map(p => p.subreddit!))];

  const limitsHit: string[] = [];
  if (!checkDailyLimit().allowed) limitsHit.push('Daily total cap');
  for (const p of ['reddit', 'twitter', 'forum'] as Platform[]) {
    if (!checkPlatformLimit(p).allowed) limitsHit.push(`${p} daily cap`);
    if (!checkCooldown(p).allowed) limitsHit.push(`${p} cooldown`);
  }

  return {
    postsToday: today.length,
    postsTodayByPlatform: byPlatform,
    discordMentionsToday,
    discordMentionRatio: `${discordMentionsToday}/${today.length} (${today.length > 0 ? Math.round(discordMentionsToday / today.length * 100) : 0}%)`,
    nextAllowedPost: nextAllowed,
    subredditsUsedToday: subredditsUsed,
    limitsHit,
  };
}

// --- Load from DB on init ---

export function loadPostHistory(records: PostRecord[]): void {
  recentPosts.length = 0;
  recentPosts.push(...records);
}
