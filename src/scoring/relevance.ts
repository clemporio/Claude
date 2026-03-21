import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import type { RawPost, RelevanceScore } from '../types';

let anthropic: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropic) {
    anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });
  }
  return anthropic;
}

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
  // Scale: 0 matches = 0, 1 = 10, 2 = 18, 3+ = 24-30
  return Math.min(30, matches * 8);
}

function scoreTopicMatch(text: string): number {
  const lower = text.toLowerCase();

  // Data/stats focus scores highest
  const dataTerms = ['data', 'algorithm', 'model', 'statistics', 'analysis', 'analytics', 'machine learning', 'ai'];
  const hasDataFocus = dataTerms.some(t => lower.includes(t));

  // Multi-sport mentions
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

async function classifyIntent(post: RawPost): Promise<{ score: number; label: string }> {
  const text = `${post.title}\n${post.body}`.slice(0, 500);

  try {
    const response = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 50,
      messages: [{
        role: 'user',
        content: `Classify this betting forum/social media post into exactly one category. Reply with ONLY the category label, nothing else.

Categories:
- seeking_tips (asking for picks, signals, communities, or betting help)
- seeking_community (looking to join a betting group/discord/community)
- complaining_tipster (frustrated with a tipster or service)
- sharing_picks (sharing their own picks or analysis)
- general_discussion (general betting chat, not seeking anything specific)
- irrelevant (not related to sports betting)

Post: "${text}"`
      }],
    });

    const label = (response.content[0] as any).text.trim().toLowerCase();

    const scores: Record<string, number> = {
      seeking_tips: 30,
      seeking_community: 28,
      complaining_tipster: 22,
      general_discussion: 12,
      sharing_picks: 8,
      irrelevant: 0,
    };

    return {
      score: scores[label] ?? 10,
      label: label,
    };
  } catch (err: any) {
    console.error(`[Scoring] Intent classification error: ${err.message}`);
    return { score: 10, label: 'unknown' };
  }
}

export async function scoreRelevance(post: RawPost): Promise<RelevanceScore> {
  const text = `${post.title} ${post.body}`;
  const keyword = scoreKeywords(text);
  const topic = scoreTopicMatch(text);
  const freshness = scoreFreshness(post.createdAt);
  const intent = await classifyIntent(post);

  return {
    keyword,
    intent: intent.score,
    topic,
    freshness,
    total: keyword + intent.score + topic + freshness,
    intentLabel: intent.label,
  };
}
