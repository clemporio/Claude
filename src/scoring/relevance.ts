import type { RawPost, RelevanceScore } from '../types';
import { detectSports, detectRegions } from '../audience/intelligence';

const BETTING_KEYWORDS = [
  'betting signals', 'betting tips', 'sports picks', 'free picks',
  'tipster', 'data driven', 'algorithm', 'model', 'discord',
  'community', 'value bets', 'sharp', 'handicapping', 'bankroll',
  'accumulators', 'accas', 'parlays', 'prop bets', 'in-play',
  'live betting', 'betting strategy', 'roi', 'units', 'edge',
  'betting system', 'profitable', 'track record', 'verified picks',
];

const MULTI_SPORT_KEYWORDS = [
  'multi-sport', 'all sports', 'football', 'soccer', 'nba', 'basketball',
  'tennis', 'mma', 'ufc', 'boxing', 'horse racing', 'nfl', 'mlb',
  'cricket', 'esports',
];

function scoreKeywords(text: string): number {
  const lower = text.toLowerCase();
  let matches = 0;
  for (const kw of BETTING_KEYWORDS) {
    if (lower.includes(kw)) matches++;
  }
  return Math.min(30, matches * 8);
}

function scoreTopicMatch(text: string): number {
  const lower = text.toLowerCase();

  const dataTerms = ['data', 'algorithm', 'model', 'statistics', 'analysis', 'analytics', 'machine learning', 'ai'];
  const hasDataFocus = dataTerms.some(t => lower.includes(t));

  let sportMentions = 0;
  for (const kw of MULTI_SPORT_KEYWORDS) {
    if (lower.includes(kw)) sportMentions++;
  }

  let score = 0;
  if (hasDataFocus) score += 12;
  if (sportMentions >= 2) score += 8;
  else if (sportMentions >= 1) score += 4;

  return Math.min(20, score);
}

function scoreFreshness(createdAt: Date): number {
  const ageMs = Date.now() - createdAt.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);

  if (ageHours <= 0.5) return 20;
  if (ageHours <= 1) return 18;
  if (ageHours <= 3) return 14;
  if (ageHours <= 6) return 10;
  if (ageHours <= 12) return 5;
  if (ageHours <= 24) return 2;
  return 0;
}

/**
 * Local-only relevance scoring — no AI calls.
 * Intent classification is deferred to Gecko via the pending_ai queue.
 */
export function scoreRelevanceLocal(post: RawPost): RelevanceScore {
  const text = `${post.title} ${post.body}`;
  const keyword = scoreKeywords(text);
  const topic = scoreTopicMatch(text);
  const freshness = scoreFreshness(post.createdAt);
  const sports = detectSports(post);
  const regions = detectRegions(post);

  return {
    keyword,
    intent: 0, // Gecko fills this in
    topic,
    freshness,
    total: keyword + topic + freshness, // Preliminary score without intent
    intentLabel: 'pending_gecko',
    detectedSports: sports,
    detectedRegions: regions,
  };
}
