import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import type { ScoredPost, Platform } from '../types';
import { detectSports, detectRegions, getAudienceProfile, scoreAudience, type Sport, type Region } from '../audience/intelligence';

let anthropic: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropic) {
    anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });
  }
  return anthropic;
}

function getDiscordInvite(platform: Platform): string {
  const invites = config.discord.invites;
  return invites[platform === 'forum' ? 'forums' : platform] || invites.default;
}

function getPlatformGuidance(platform: Platform): string {
  switch (platform) {
    case 'reddit':
      return `Platform: Reddit
Tone: Casual, conversational, helpful. Redditors hate obvious promotion.
Format: 2-4 short paragraphs max. No bullet points unless the thread uses them.
Key rules:
- Lead with genuine value — share an insight, answer the question, contribute to the discussion
- If mentioning the Discord, frame it as "I've been part of..." or "there's a community I use that..." — never "check out my..."
- Match the subreddit's vibe (r/sportsbook is more analytical, r/sportsbetting is more casual)
- Never use marketing language`;

    case 'twitter':
      return `Platform: Twitter/X
Tone: Concise, direct, slightly opinionated. Twitter rewards hot takes done well.
Format: 1-2 tweets max (under 280 chars each). Can use a thread format if needed.
Key rules:
- Be punchy, not salesy
- If mentioning the Discord, keep it natural — "been sharing these in our discord" not "join my discord for..."
- Use numbers/stats if relevant — they perform well on Twitter
- No hashtag spam`;

    case 'forum':
      return `Platform: Betting Forum
Tone: Knowledgeable, helpful, community-member-ish. Forums value long-form thought.
Format: 2-5 paragraphs. Can be more detailed than Reddit/Twitter.
Key rules:
- Demonstrate expertise in your response
- Forum users are savvy — any hint of shilling gets called out
- Only mention the Discord if it genuinely adds to the conversation
- Reference specific data points or analysis approaches if relevant`;
  }
}

function buildAudienceGuidance(post: ScoredPost): string {
  const sports = post.relevance.detectedSports as Sport[];
  const regions = post.relevance.detectedRegions as Region[];
  const primarySport = sports[0] || 'general';
  const profile = getAudienceProfile(primarySport);
  const audience = scoreAudience(post);

  const regionLabels: Record<Region, string> = {
    US: 'American', CA: 'Canadian', UK: 'British',
    IE: 'Irish', IN: 'Indian', AU: 'Australian', GLOBAL: 'global',
  };

  const regionStr = regions.map(r => regionLabels[r] || r).join('/');

  // Build terminology guide
  const termGuide = Object.entries(profile.terminology)
    .map(([from, to]) => `- Say "${to}" NOT "${from}"`)
    .join('\n');

  return `
AUDIENCE INTELLIGENCE:
- Detected sport(s): ${sports.join(', ')}
- Target audience: ${regionStr}
- ${profile.culturalNotes}

${termGuide ? `TERMINOLOGY — Use the RIGHT words for this audience:\n${termGuide}` : 'No specific terminology adjustments needed.'}

IMPORTANT: Getting the language wrong instantly marks you as an outsider. A British football punter will ignore anyone who says "soccer" or "parlay". An American NBA bettor will ignore anyone who says "accumulator" or "bookmaker". Match the audience exactly.`;
}

function buildSportsContext(post: ScoredPost): string {
  const sports = post.relevance.detectedSports as Sport[];

  if (sports.includes('general') || sports.length === 0) {
    return 'This is a general sports betting post — no specific sport detected.';
  }

  const sportDescriptions: Partial<Record<Sport, string>> = {
    nba: 'NBA basketball — reference player props, spreads, totals, team matchups',
    nhl: 'NHL hockey — reference puck lines, goalie matchups, back-to-backs',
    nfl: 'NFL football — reference spreads, ATS, injury reports, game scripts',
    mlb: 'MLB baseball — reference starting pitchers, run lines, park factors',
    football: 'Football (soccer) — reference accumulators, BTTS, over/under goals, league-specific form',
    cricket: 'Cricket — reference pitch conditions, batting/bowling stats, format (T20/ODI/Test)',
    tennis: 'Tennis — reference surface, H2H records, recent form, tournament context',
    mma: 'MMA/UFC — reference fighting styles, reach, weight cuts, method of victory',
    boxing: 'Boxing — reference fight camps, styles, method of victory, round betting',
    horse_racing: 'Horse racing — reference going, trainer/jockey, course form, each way value',
  };

  return sports
    .map(s => sportDescriptions[s] || `${s} detected`)
    .join('\n');
}

export async function generateDrafts(post: ScoredPost): Promise<{ primary: string; alternate?: string }> {
  const invite = getDiscordInvite(post.platform);
  const guidance = getPlatformGuidance(post.platform);
  const intentContext = post.relevance.intentLabel;
  const audienceGuidance = buildAudienceGuidance(post);
  const sportsContext = buildSportsContext(post);

  const postContent = post.platform === 'twitter'
    ? post.body
    : `Title: ${post.title}\n\nBody: ${post.body}`;

  const systemPrompt = `You are helping draft a response to a social media post about sports betting.

${guidance}

${audienceGuidance}

SPORT CONTEXT:
${sportsContext}

Context about the Discord community you can mention IF it fits naturally:
- Multi-sport, data-backed betting signals community
- Free tier with premium option
- Covers: NBA, NHL, football (soccer), cricket, tennis, and more
- Focus: using data and analysis rather than gut feelings
- Invite link (only include if mentioning): ${invite}

The user's intent in this post is classified as: ${intentContext}

CRITICAL RULES:
1. Your response must genuinely contribute to the discussion FIRST. The value must stand alone even without any Discord mention.
2. Only mention the Discord if it's a natural fit. If the post is asking for communities/signals, it fits. If it's general discussion, contribute without mentioning it.
3. Never say "check out", "join", "visit", "click here", or any call-to-action language.
4. Never claim specific win rates, ROI, or profits unless you can back them up.
5. Sound like a real person who bets and is part of a community, not someone promoting one.
6. USE THE CORRECT TERMINOLOGY FOR THE AUDIENCE. This is non-negotiable. Wrong terminology = instant credibility loss.`;

  try {
    const response = await getClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Draft a response to this post. Write TWO versions separated by "---":
1. A version that naturally includes a Discord mention (if appropriate)
2. A version that's purely helpful with no Discord mention

Post:
${postContent}`,
      }],
    });

    const text = (response.content[0] as any).text;
    const parts = text.split('---').map((s: string) => s.trim()).filter(Boolean);

    return {
      primary: parts[0] || text,
      alternate: parts[1] || undefined,
    };
  } catch (err: any) {
    console.error(`[Drafter] Error generating draft: ${err.message}`);
    return { primary: `[Draft generation failed: ${err.message}]` };
  }
}
