export type Platform = 'reddit' | 'twitter' | 'forum';

export interface RawPost {
  platform: Platform;
  externalId: string;
  url: string;
  title: string;
  body: string;
  author: string;
  subreddit?: string;       // Reddit
  forumName?: string;       // Forums
  upvotes?: number;
  comments?: number;
  followers?: number;       // Twitter author followers
  retweets?: number;
  likes?: number;
  createdAt: Date;
  fetchedAt: Date;
}

export interface RelevanceScore {
  keyword: number;          // 0-30
  intent: number;           // 0-30
  topic: number;            // 0-20
  freshness: number;        // 0-20
  total: number;            // 0-100
  intentLabel: string;      // e.g. "seeking_tips", "sharing_picks", "complaining"
  detectedSports: string[];
  detectedRegions: string[];
}

export interface OpportunityScore {
  reach: number;            // 0-25
  engagement: number;       // 0-25
  positioningFit: number;   // 0-25
  competition: number;      // 0-25
  audienceBonus: number;    // 0-25: timing + terminology fit from audience intelligence
  total: number;            // 0-125 (normalised to 0-100 in combined score)
}

export interface ScoredPost extends RawPost {
  relevance: RelevanceScore;
  opportunity: OpportunityScore;
  combinedScore: number;
}

export type DraftStatus = 'pending' | 'approved' | 'skipped' | 'expired' | 'posted';

export interface Draft {
  id: number;
  opportunityId: number;
  platform: Platform;
  postUrl: string;
  postTitle: string;
  postBody: string;
  draftText: string;
  alternateText?: string;
  relevanceScore: number;
  opportunityScore: number;
  combinedScore: number;
  status: DraftStatus;
  skipReason?: string;
  createdAt: string;
  expiresAt: string;
}

export interface DailyMetrics {
  date: string;
  postsFound: number;
  postsScored: number;
  draftsGenerated: number;
  draftsApproved: number;
  draftsSkipped: number;
  draftsExpired: number;
  byPlatform: Record<Platform, {
    found: number;
    drafted: number;
    approved: number;
  }>;
}

export interface ForumTarget {
  name: string;
  baseUrl: string;
  newPostsPath: string;
  postSelector: string;
  titleSelector: string;
  bodySelector: string;
  authorSelector: string;
  dateSelector: string;
  linkSelector: string;
}
