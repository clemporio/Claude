import { getDailyMetrics, getPendingDrafts } from '../queue/queue';
import type { Platform } from '../types';

export function generateDailyDigest(): string {
  const metrics = getDailyMetrics();
  const pending = getPendingDrafts(100);

  const platforms: Platform[] = ['reddit', 'twitter', 'forum'];
  const topPlatform = platforms
    .sort((a, b) => metrics.byPlatform[b].drafted - metrics.byPlatform[a].drafted)[0];

  const lines: string[] = [];

  lines.push(`**Scout Bot Daily Digest** — ${metrics.date}`);
  lines.push('');
  lines.push(`- Found ${metrics.postsFound} posts across all platforms`);
  lines.push(`- Generated ${metrics.draftsGenerated} drafts`);
  lines.push(`- You approved ${metrics.draftsApproved}, skipped ${metrics.draftsSkipped}`);
  lines.push(`- ${metrics.draftsExpired} expired (not reviewed in time)`);
  lines.push('');

  if (pending.length > 0) {
    lines.push(`- **${pending.length} drafts waiting for review** — run \`scout queue\` to review`);
    lines.push('');
  }

  lines.push('**By platform:**');
  lines.push(`- Reddit: ${metrics.byPlatform.reddit.found} found, ${metrics.byPlatform.reddit.drafted} drafted`);
  lines.push(`- Twitter: ${metrics.byPlatform.twitter.found} found, ${metrics.byPlatform.twitter.drafted} drafted`);
  lines.push(`- Forums: ${metrics.byPlatform.forum.found} found, ${metrics.byPlatform.forum.drafted} drafted`);
  lines.push('');

  if (topPlatform && metrics.byPlatform[topPlatform].drafted > 0) {
    lines.push(`Top platform today: **${topPlatform}** (${metrics.byPlatform[topPlatform].drafted} drafts)`);
  }

  // Conversion prompt
  if (metrics.draftsApproved > 0 && metrics.draftsGenerated > 0) {
    const approvalRate = ((metrics.draftsApproved / metrics.draftsGenerated) * 100).toFixed(0);
    lines.push(`Approval rate: ${approvalRate}%`);
  }

  return lines.join('\n');
}

export function generateGeckoReport(): object {
  const metrics = getDailyMetrics();
  const pending = getPendingDrafts(100);

  return {
    date: metrics.date,
    summary: {
      postsFound: metrics.postsFound,
      draftsGenerated: metrics.draftsGenerated,
      draftsApproved: metrics.draftsApproved,
      draftsSkipped: metrics.draftsSkipped,
      draftsExpired: metrics.draftsExpired,
      pendingReview: pending.length,
    },
    byPlatform: metrics.byPlatform,
    approvalRate: metrics.draftsGenerated > 0
      ? (metrics.draftsApproved / metrics.draftsGenerated * 100).toFixed(1) + '%'
      : 'N/A',
    topOpportunities: pending.slice(0, 3).map(d => ({
      platform: d.platform,
      score: d.combinedScore,
      url: d.postUrl,
      title: d.postTitle.slice(0, 80),
    })),
  };
}
