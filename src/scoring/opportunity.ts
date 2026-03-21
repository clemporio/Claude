import type { RawPost, OpportunityScore } from '../types';

function scoreReach(post: RawPost): number {
  if (post.platform === 'reddit') {
    // Based on subreddit size implied by upvotes on new posts
    const upvotes = post.upvotes || 0;
    if (upvotes >= 50) return 25;
    if (upvotes >= 20) return 20;
    if (upvotes >= 10) return 15;
    if (upvotes >= 5) return 10;
    return 5;
  }

  if (post.platform === 'twitter') {
    const followers = post.followers || 0;
    if (followers >= 10000) return 25;
    if (followers >= 5000) return 20;
    if (followers >= 1000) return 15;
    if (followers >= 500) return 10;
    return 5;
  }

  // Forums - moderate default reach
  return 12;
}

function scoreEngagement(post: RawPost): number {
  const comments = post.comments || 0;

  // Sweet spot: some engagement (visible thread) but not buried
  if (comments >= 100) return 5;    // Too buried
  if (comments >= 50) return 10;
  if (comments >= 20) return 15;
  if (comments >= 5) return 22;     // Active but not crowded
  if (comments >= 1) return 25;     // Early, high visibility
  return 18;                         // Brand new, first to engage
}

function scorePositioningFit(post: RawPost): number {
  const text = `${post.title} ${post.body}`.toLowerCase();

  // Direct asks for communities/signals = perfect fit
  if (text.includes('discord') || text.includes('community') || text.includes('group')) return 25;
  if (text.includes('signals') || text.includes('where to find')) return 23;
  if (text.includes('looking for') || text.includes('recommend')) return 22;

  // Complaints about existing services = repositioning opportunity
  if (text.includes('scam') || text.includes('fake') || text.includes('waste of money')) return 20;
  if (text.includes('disappointed') || text.includes('stopped using')) return 18;

  // General betting discussion = can contribute but harder to naturally mention
  if (text.includes('strategy') || text.includes('analysis') || text.includes('data')) return 15;

  // Sharing own picks = low fit (they're not looking for a service)
  if (text.includes('my picks') || text.includes('my bet') || text.includes('i bet')) return 5;

  return 10;
}

function scoreCompetition(post: RawPost): number {
  const comments = post.comments || 0;

  // Fewer comments generally = less competition from other services
  // But we can't actually see if competitors commented without fetching comments
  // So we use comment count as a proxy
  if (comments === 0) return 25;
  if (comments <= 3) return 22;
  if (comments <= 10) return 18;
  if (comments <= 25) return 12;
  if (comments <= 50) return 8;
  return 5;
}

export function scoreOpportunity(post: RawPost): OpportunityScore {
  const reach = scoreReach(post);
  const engagement = scoreEngagement(post);
  const positioningFit = scorePositioningFit(post);
  const competition = scoreCompetition(post);

  return {
    reach,
    engagement,
    positioningFit,
    competition,
    total: reach + engagement + positioningFit + competition,
  };
}
