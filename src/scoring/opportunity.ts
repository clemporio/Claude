import type { RawPost, OpportunityScore } from '../types';
import { scoreAudience } from '../audience/intelligence';

// Reach is now the dominant scoring factor.
// A reply to a 100k follower account is worth 10x a reply to a 500 follower account.
// Minimum follower threshold: accounts under 1k are essentially invisible.

function scoreReach(post: RawPost): number {
  if (post.platform === 'reddit') {
    const upvotes = post.upvotes || 0;
    if (upvotes >= 100) return 50;
    if (upvotes >= 50) return 40;
    if (upvotes >= 25) return 30;
    if (upvotes >= 10) return 20;
    if (upvotes >= 5) return 10;
    return 0; // Low upvote posts aren't worth engaging
  }

  if (post.platform === 'twitter') {
    const followers = post.followers || 0;
    const engagementRate = post.engagementRate || 0;
    const likes = post.likes || 0;
    const retweets = post.retweets || 0;
    const tweetEngagement = likes + (retweets * 3);

    if (followers < 1000) return 0;

    // Follower-based score (0-30)
    let followerScore = 0;
    if (followers >= 100000) followerScore = 30;
    else if (followers >= 50000) followerScore = 27;
    else if (followers >= 25000) followerScore = 23;
    else if (followers >= 10000) followerScore = 18;
    else if (followers >= 5000) followerScore = 12;
    else if (followers >= 2000) followerScore = 7;
    else followerScore = 3;

    // Engagement rate score (0-12) — a 10k account with 3% rate > 100k account with 0.01%
    let erScore = 0;
    if (engagementRate >= 0.05) erScore = 12;      // 5%+ = exceptional
    else if (engagementRate >= 0.02) erScore = 10;  // 2%+ = strong
    else if (engagementRate >= 0.01) erScore = 7;   // 1%+ = decent
    else if (engagementRate >= 0.005) erScore = 4;  // 0.5%+ = average
    else if (engagementRate >= 0.001) erScore = 2;  // 0.1%+ = low but alive
    // Below 0.1% = dead audience, 0 bonus

    // Tweet engagement bonus (0-8) — viral individual tweet
    let tweetBonus = 0;
    if (tweetEngagement >= 100) tweetBonus = 8;
    else if (tweetEngagement >= 50) tweetBonus = 6;
    else if (tweetEngagement >= 20) tweetBonus = 4;
    else if (tweetEngagement >= 5) tweetBonus = 2;

    return followerScore + erScore + tweetBonus;
  }

  // Forums
  return 15;
}

function scoreEngagement(post: RawPost): number {
  const comments = post.comments || 0;

  // Active threads are good (visible), but mega-threads bury you
  if (comments >= 100) return 2;
  if (comments >= 50) return 5;
  if (comments >= 20) return 10;
  if (comments >= 5) return 15;
  if (comments >= 1) return 12;
  return 8; // Brand new — first to engage but no social proof yet
}

function scorePositioningFit(post: RawPost): number {
  const text = `${post.title} ${post.body}`.toLowerCase();

  // Direct asks for communities/signals = perfect fit
  if (text.includes('discord') || text.includes('community') || text.includes('group')) return 20;
  if (text.includes('signals') || text.includes('where to find')) return 18;
  if (text.includes('looking for') || text.includes('recommend')) return 17;

  // Complaints about existing services = repositioning opportunity
  if (text.includes('scam') || text.includes('fake') || text.includes('waste of money')) return 15;
  if (text.includes('disappointed') || text.includes('stopped using')) return 13;

  // Data/strategy discussion = can contribute naturally
  if (text.includes('strategy') || text.includes('analysis') || text.includes('data') || text.includes('model')) return 12;

  // Someone sharing picks = low fit (they're not looking for a service)
  if (text.includes('my picks') || text.includes('my bet') || text.includes('i bet')) return 3;

  return 8;
}

function scoreCompetition(post: RawPost): number {
  const comments = post.comments || 0;

  if (comments === 0) return 15;
  if (comments <= 3) return 12;
  if (comments <= 10) return 10;
  if (comments <= 25) return 6;
  if (comments <= 50) return 3;
  return 0;
}

export function scoreOpportunity(post: RawPost): OpportunityScore {
  const reach = scoreReach(post);

  // Hard gate: if reach is 0, don't even bother scoring the rest.
  // No point engaging with accounts nobody will see.
  if (reach === 0) {
    return {
      reach: 0,
      engagement: 0,
      positioningFit: 0,
      competition: 0,
      audienceBonus: 0,
      total: 0,
    };
  }

  const engagement = scoreEngagement(post);
  const positioningFit = scorePositioningFit(post);
  const competition = scoreCompetition(post);
  const audience = scoreAudience(post);
  const audienceBonus = audience.total;

  return {
    reach,
    engagement,
    positioningFit,
    competition,
    audienceBonus,
    total: reach + engagement + positioningFit + competition + audienceBonus,
  };
}
