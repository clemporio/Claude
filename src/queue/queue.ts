// @ts-ignore - sql.js lacks type declarations
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import type { Draft, DraftStatus, Platform, DailyMetrics } from '../types';

let db: any = null;

function saveDb(): void {
  if (!db) return;
  const dir = path.dirname(config.db.path);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const data = db.export();
  fs.writeFileSync(config.db.path, Buffer.from(data));
}

export async function initDb(): Promise<void> {
  const SQL = await initSqlJs();

  if (fs.existsSync(config.db.path)) {
    const buffer = fs.readFileSync(config.db.path);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS opportunities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      external_id TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      author TEXT NOT NULL,
      subreddit TEXT,
      forum_name TEXT,
      relevance_score REAL NOT NULL,
      opportunity_score REAL NOT NULL,
      combined_score REAL NOT NULL,
      intent_label TEXT,
      created_at TEXT NOT NULL,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(platform, external_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS drafts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      opportunity_id INTEGER NOT NULL,
      platform TEXT NOT NULL,
      post_url TEXT NOT NULL,
      post_title TEXT NOT NULL,
      post_body TEXT NOT NULL,
      draft_text TEXT NOT NULL,
      alternate_text TEXT,
      relevance_score REAL NOT NULL,
      opportunity_score REAL NOT NULL,
      combined_score REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      skip_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      FOREIGN KEY (opportunity_id) REFERENCES opportunities(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      platform TEXT NOT NULL,
      posts_found INTEGER NOT NULL DEFAULT 0,
      posts_scored INTEGER NOT NULL DEFAULT 0,
      drafts_generated INTEGER NOT NULL DEFAULT 0,
      drafts_approved INTEGER NOT NULL DEFAULT 0,
      drafts_skipped INTEGER NOT NULL DEFAULT 0,
      drafts_expired INTEGER NOT NULL DEFAULT 0,
      UNIQUE(date, platform)
    )
  `);

  // Pending AI — items awaiting Gecko's classification and draft generation
  db.run(`
    CREATE TABLE IF NOT EXISTS pending_ai (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      opportunity_id INTEGER NOT NULL,
      platform TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      subreddit TEXT,
      keyword_score REAL NOT NULL,
      topic_score REAL NOT NULL,
      freshness_score REAL NOT NULL,
      opportunity_score REAL NOT NULL,
      detected_sports TEXT,
      detected_regions TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (opportunity_id) REFERENCES opportunities(id)
    )
  `);

  // Post history — persists safety rail state across restarts
  db.run(`
    CREATE TABLE IF NOT EXISTS post_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      draft_id INTEGER,
      platform TEXT NOT NULL,
      subreddit TEXT,
      had_discord_mention INTEGER NOT NULL DEFAULT 0,
      posted_url TEXT,
      posted_at TEXT NOT NULL DEFAULT (datetime('now')),
      error TEXT,
      FOREIGN KEY (draft_id) REFERENCES drafts(id)
    )
  `);

  // Create indexes (safe to run multiple times with IF NOT EXISTS)
  db.run('CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_drafts_score ON drafts(combined_score DESC)');
  db.run('CREATE INDEX IF NOT EXISTS idx_opp_platform ON opportunities(platform, external_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_post_history_date ON post_history(posted_at)');
  db.run('CREATE INDEX IF NOT EXISTS idx_pending_ai_status ON pending_ai(status)');

  saveDb();
}

function getDb(): any {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

export function opportunityExists(platform: string, externalId: string): boolean {
  const stmt = getDb().prepare(
    'SELECT 1 FROM opportunities WHERE platform = ? AND external_id = ?'
  );
  stmt.bind([platform, externalId]);
  const hasRow = stmt.step();
  stmt.free();
  return hasRow;
}

export function insertOpportunity(opp: {
  platform: Platform;
  externalId: string;
  url: string;
  title: string;
  body: string;
  author: string;
  subreddit?: string;
  forumName?: string;
  relevanceScore: number;
  opportunityScore: number;
  combinedScore: number;
  intentLabel: string;
  createdAt: string;
}): number {
  const d = getDb();

  // Check if exists first (OR IGNORE doesn't return useful lastInsertRowid)
  if (opportunityExists(opp.platform, opp.externalId)) return 0;

  d.run(`
    INSERT INTO opportunities
    (platform, external_id, url, title, body, author, subreddit, forum_name,
     relevance_score, opportunity_score, combined_score, intent_label, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    opp.platform, opp.externalId, opp.url, opp.title,
    opp.body.slice(0, 2000), opp.author, opp.subreddit || null,
    opp.forumName || null, opp.relevanceScore, opp.opportunityScore,
    opp.combinedScore, opp.intentLabel, opp.createdAt,
  ]);

  const result = d.exec('SELECT last_insert_rowid() as id');
  saveDb();
  return result[0]?.values[0]?.[0] as number || 0;
}

export function insertDraft(draft: {
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
}): number {
  const d = getDb();
  const expiresAt = new Date(
    Date.now() + config.drafting.expiryHours * 60 * 60 * 1000
  ).toISOString();

  d.run(`
    INSERT INTO drafts
    (opportunity_id, platform, post_url, post_title, post_body, draft_text,
     alternate_text, relevance_score, opportunity_score, combined_score, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    draft.opportunityId, draft.platform, draft.postUrl, draft.postTitle,
    draft.postBody.slice(0, 2000), draft.draftText, draft.alternateText || null,
    draft.relevanceScore, draft.opportunityScore, draft.combinedScore, expiresAt,
  ]);

  const result = d.exec('SELECT last_insert_rowid() as id');
  saveDb();
  return result[0]?.values[0]?.[0] as number || 0;
}

export function getPendingDrafts(limit = 20): Draft[] {
  const d = getDb();
  const now = new Date().toISOString();
  const results = d.exec(`
    SELECT id, opportunity_id, platform, post_url, post_title, post_body,
           draft_text, alternate_text, relevance_score, opportunity_score,
           combined_score, status, skip_reason, created_at, expires_at
    FROM drafts
    WHERE status = 'pending' AND expires_at > '${now}'
    ORDER BY combined_score DESC
    LIMIT ${limit}
  `);

  if (!results[0]) return [];

  return results[0].values.map((row: any[]) => ({
    id: row[0] as number,
    opportunityId: row[1] as number,
    platform: row[2] as Platform,
    postUrl: row[3] as string,
    postTitle: row[4] as string,
    postBody: row[5] as string,
    draftText: row[6] as string,
    alternateText: row[7] as string | undefined,
    relevanceScore: row[8] as number,
    opportunityScore: row[9] as number,
    combinedScore: row[10] as number,
    status: row[11] as DraftStatus,
    skipReason: row[12] as string | undefined,
    createdAt: row[13] as string,
    expiresAt: row[14] as string,
  }));
}

export function updateDraftStatus(id: number, status: DraftStatus, skipReason?: string): void {
  getDb().run(
    'UPDATE drafts SET status = ?, skip_reason = ? WHERE id = ?',
    [status, skipReason || null, id]
  );
  saveDb();
}

export function expireOldDrafts(): number {
  const d = getDb();
  const now = new Date().toISOString();
  d.run(`UPDATE drafts SET status = 'expired' WHERE status = 'pending' AND expires_at <= '${now}'`);
  const result = d.exec('SELECT changes()');
  const changes = result[0]?.values[0]?.[0] as number || 0;
  if (changes > 0) saveDb();
  return changes;
}

export function incrementMetric(
  platform: Platform,
  field: 'posts_found' | 'posts_scored' | 'drafts_generated' | 'drafts_approved' | 'drafts_skipped' | 'drafts_expired',
  count = 1
): void {
  const date = new Date().toISOString().split('T')[0];
  const d = getDb();

  // Upsert: try insert, on conflict update
  d.run(`
    INSERT INTO metrics (date, platform, ${field})
    VALUES (?, ?, ?)
    ON CONFLICT(date, platform) DO UPDATE SET ${field} = ${field} + ?
  `, [date, platform, count, count]);

  saveDb();
}

export function getDailyMetrics(date?: string): DailyMetrics {
  const d = date || new Date().toISOString().split('T')[0];
  const results = getDb().exec(
    `SELECT platform, posts_found, posts_scored, drafts_generated, drafts_approved, drafts_skipped, drafts_expired FROM metrics WHERE date = '${d}'`
  );

  const out: DailyMetrics = {
    date: d,
    postsFound: 0,
    postsScored: 0,
    draftsGenerated: 0,
    draftsApproved: 0,
    draftsSkipped: 0,
    draftsExpired: 0,
    byPlatform: {
      reddit: { found: 0, drafted: 0, approved: 0 },
      twitter: { found: 0, drafted: 0, approved: 0 },
      forum: { found: 0, drafted: 0, approved: 0 },
    },
  };

  if (!results[0]) return out;

  for (const r of results[0].values) {
    const row = r as any[];
    const p = row[0] as Platform;
    const found = row[1] as number;
    const scored = row[2] as number;
    const generated = row[3] as number;
    const approved = row[4] as number;
    const skipped = row[5] as number;
    const expired = row[6] as number;

    out.postsFound += found;
    out.postsScored += scored;
    out.draftsGenerated += generated;
    out.draftsApproved += approved;
    out.draftsSkipped += skipped;
    out.draftsExpired += expired;

    if (out.byPlatform[p]) {
      out.byPlatform[p].found = found;
      out.byPlatform[p].drafted = generated;
      out.byPlatform[p].approved = approved;
    }
  }

  return out;
}

export function recordPostToDb(entry: {
  draftId?: number;
  platform: Platform;
  subreddit?: string;
  hadDiscordMention: boolean;
  postedUrl?: string;
  error?: string;
}): void {
  getDb().run(`
    INSERT INTO post_history (draft_id, platform, subreddit, had_discord_mention, posted_url, error)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    entry.draftId || null,
    entry.platform,
    entry.subreddit || null,
    entry.hadDiscordMention ? 1 : 0,
    entry.postedUrl || null,
    entry.error || null,
  ]);
  saveDb();
}

export function getPostHistory(days = 7): Array<{
  platform: Platform;
  subreddit?: string;
  hadDiscordMention: boolean;
  postedAt: number;
}> {
  const d = getDb();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const results = d.exec(
    `SELECT platform, subreddit, had_discord_mention, posted_at
     FROM post_history
     WHERE posted_at >= '${cutoff}' AND error IS NULL
     ORDER BY posted_at DESC`
  );

  if (!results[0]) return [];

  return results[0].values.map((row: any[]) => ({
    platform: row[0] as Platform,
    subreddit: row[1] as string | undefined,
    hadDiscordMention: row[2] === 1,
    postedAt: new Date(row[3] as string).getTime(),
  }));
}

export function getPostHistoryStats(date?: string): {
  total: number;
  byPlatform: Record<Platform, number>;
  discordMentions: number;
  subredditsUsed: string[];
} {
  const d = date || new Date().toISOString().split('T')[0];
  const db = getDb();
  const results = db.exec(
    `SELECT platform, subreddit, had_discord_mention
     FROM post_history
     WHERE date(posted_at) = '${d}' AND error IS NULL`
  );

  const stats = {
    total: 0,
    byPlatform: { reddit: 0, twitter: 0, forum: 0 } as Record<Platform, number>,
    discordMentions: 0,
    subredditsUsed: [] as string[],
  };

  if (!results[0]) return stats;

  const subs = new Set<string>();
  for (const row of results[0].values) {
    stats.total++;
    stats.byPlatform[row[0] as Platform]++;
    if (row[2] === 1) stats.discordMentions++;
    if (row[1]) subs.add(row[1] as string);
  }
  stats.subredditsUsed = Array.from(subs);
  return stats;
}

// --- Pending AI Queue (for Gecko) ---

export function insertPendingAi(item: {
  opportunityId: number;
  platform: Platform;
  url: string;
  title: string;
  body: string;
  subreddit?: string;
  keywordScore: number;
  topicScore: number;
  freshnessScore: number;
  opportunityScore: number;
  detectedSports: string[];
  detectedRegions: string[];
}): number {
  const d = getDb();
  d.run(`
    INSERT INTO pending_ai
    (opportunity_id, platform, url, title, body, subreddit,
     keyword_score, topic_score, freshness_score, opportunity_score,
     detected_sports, detected_regions)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    item.opportunityId, item.platform, item.url, item.title,
    item.body.slice(0, 2000), item.subreddit || null,
    item.keywordScore, item.topicScore, item.freshnessScore,
    item.opportunityScore,
    JSON.stringify(item.detectedSports),
    JSON.stringify(item.detectedRegions),
  ]);

  const result = d.exec('SELECT last_insert_rowid() as id');
  saveDb();
  return result[0]?.values[0]?.[0] as number || 0;
}

export function getPendingAiItems(limit = 20): Array<{
  id: number;
  opportunityId: number;
  platform: Platform;
  url: string;
  title: string;
  body: string;
  subreddit?: string;
  keywordScore: number;
  topicScore: number;
  freshnessScore: number;
  opportunityScore: number;
  detectedSports: string[];
  detectedRegions: string[];
}> {
  const results = getDb().exec(`
    SELECT id, opportunity_id, platform, url, title, body, subreddit,
           keyword_score, topic_score, freshness_score, opportunity_score,
           detected_sports, detected_regions
    FROM pending_ai
    WHERE status = 'pending'
    ORDER BY opportunity_score DESC
    LIMIT ${limit}
  `);

  if (!results[0]) return [];

  return results[0].values.map((row: any[]) => ({
    id: row[0] as number,
    opportunityId: row[1] as number,
    platform: row[2] as Platform,
    url: row[3] as string,
    title: row[4] as string,
    body: row[5] as string,
    subreddit: row[6] as string | undefined,
    keywordScore: row[7] as number,
    topicScore: row[8] as number,
    freshnessScore: row[9] as number,
    opportunityScore: row[10] as number,
    detectedSports: JSON.parse(row[11] as string || '[]'),
    detectedRegions: JSON.parse(row[12] as string || '[]'),
  }));
}

export function markPendingAiDone(id: number): void {
  getDb().run("UPDATE pending_ai SET status = 'done' WHERE id = ?", [id]);
  saveDb();
}

export function getPendingAiCount(): number {
  const results = getDb().exec("SELECT COUNT(*) FROM pending_ai WHERE status = 'pending'");
  return results[0]?.values[0]?.[0] as number || 0;
}

export function expireStalePendingAi(maxAgeHours = 6): number {
  const d = getDb();
  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();
  d.run(`UPDATE pending_ai SET status = 'expired' WHERE status = 'pending' AND created_at <= '${cutoff}'`);
  const result = d.exec('SELECT changes()');
  const changes = result[0]?.values[0]?.[0] as number || 0;
  if (changes > 0) saveDb();
  return changes;
}

export function closeDb(): void {
  if (db) {
    saveDb();
    db.close();
    db = null;
  }
}
