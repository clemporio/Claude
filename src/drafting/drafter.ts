import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import type { ScoredPost, Platform } from '../types';

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

export async function generateDrafts(post: ScoredPost): Promise<{ primary: string; alternate?: string }> {
  const invite = getDiscordInvite(post.platform);
  const guidance = getPlatformGuidance(post.platform);
  const intentContext = post.relevance.intentLabel;

  const postContent = post.platform === 'twitter'
    ? post.body
    : `Title: ${post.title}\n\nBody: ${post.body}`;

  const systemPrompt = `You are helping draft a response to a social media post about sports betting.

${guidance}

Context about the Discord community you can mention IF it fits naturally:
- Multi-sport, data-backed betting signals community
- Free tier with premium option
- Focus: using data and analysis rather than gut feelings
- Invite link (only include if mentioning): ${invite}

The user's intent in this post is classified as: ${intentContext}

CRITICAL RULES:
1. Your response must genuinely contribute to the discussion FIRST. The value must stand alone even without any Discord mention.
2. Only mention the Discord if it's a natural fit. If the post is asking for communities/signals, it fits. If it's general discussion, contribute without mentioning it.
3. Never say "check out", "join", "visit", "click here", or any call-to-action language.
4. Never claim specific win rates, ROI, or profits unless you can back them up.
5. Sound like a real person who bets and is part of a community, not someone promoting one.`;

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
