import type { RawPost, OpportunityScore } from '../types';
import { scoreAudience } from '../audience/intelligence';

function scoreReach(post: RawPost): number {
  if (post.platform === 'reddit') {
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

  return 12;
}

function scoreEngagement(post: RawPost): number {
  const comments = post.comments || 0;

  if (comments >= 100) return 5;
  if (comments >= 50) return 10;
  if (comments >= 20) return 15;
  if (comments >= 5) return 22;
  if (comments >= 1) return 25;
  return 18;
}

function scorePositioningFit(post: RawPost): number {
  const text = `${post.title} ${post.body}`.toLowerCase();

  if (text.includes('discord') || text.includes('community') || text.includes('group')) return 25;
  if (text.includes('signals') || text.includes('where to find')) return 23;
  if (text.includes('looking for') || text.includes('recommend')) return 22;

  if (text.includes('scam') || text.includes('fake') || text.includes('waste of money')) return 20;
  if (text.includes('disappointed') || text.includes('stopped using')) return 18;

  if (text.includes('strategy') || text.includes('analysis') || text.includes('data')) return 15;

  if (text.includes('my picks') || text.includes('my bet') || text.includes('i bet')) return 5;

  return 10;
}

function scoreCompetition(post: RawPost): number {
  const comments = post.comments || 0;

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

  // Audience intelligence bonus
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
