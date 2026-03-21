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

  // Create indexes (safe to run multiple times with IF NOT EXISTS)
  db.run('CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_drafts_score ON drafts(combined_score DESC)');
  db.run('CREATE INDEX IF NOT EXISTS idx_opp_platform ON opportunities(platform, external_id)');

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

export function closeDb(): void {
  if (db) {
    saveDb();
    db.close();
    db = null;
  }
}
