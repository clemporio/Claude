import * as cheerio from 'cheerio';
import { config } from '../config';
import type { RawPost, ForumTarget } from '../types';
import { opportunityExists } from '../queue/queue';

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.text();
}

async function scrapeForum(target: ForumTarget): Promise<RawPost[]> {
  const posts: RawPost[] = [];
  const url = `${target.baseUrl}${target.newPostsPath}`;

  console.log(`[Forum] Scraping ${target.name}: ${url}`);

  try {
    const html = await fetchPage(url);
    const $ = cheerio.load(html);

    $(target.postSelector).each((_, el) => {
      const $el = $(el);
      const title = $el.find(target.titleSelector).text().trim();
      const body = $el.find(target.bodySelector).text().trim();
      const author = $el.find(target.authorSelector).text().trim();
      const dateStr = $el.find(target.dateSelector).text().trim();
      const link = $el.find(target.linkSelector).attr('href') || '';

      if (!title) return;

      const fullUrl = link.startsWith('http') ? link : `${target.baseUrl}${link}`;
      const externalId = Buffer.from(fullUrl).toString('base64').slice(0, 64);

      if (opportunityExists('forum', externalId)) return;

      posts.push({
        platform: 'forum',
        externalId,
        url: fullUrl,
        title,
        body: body.slice(0, 2000),
        author: author || 'anonymous',
        forumName: target.name,
        createdAt: parseFuzzyDate(dateStr),
        fetchedAt: new Date(),
      });
    });

    console.log(`[Forum] ${target.name}: found ${posts.length} new candidates`);
  } catch (err: any) {
    console.error(`[Forum] Error scraping ${target.name}: ${err.message}`);
  }

  return posts;
}

function parseFuzzyDate(str: string): Date {
  if (!str) return new Date();

  const lower = str.toLowerCase();

  if (lower.includes('just now') || lower.includes('moment')) return new Date();
  if (lower.includes('min')) {
    const mins = parseInt(str) || 5;
    return new Date(Date.now() - mins * 60 * 1000);
  }
  if (lower.includes('hour')) {
    const hours = parseInt(str) || 1;
    return new Date(Date.now() - hours * 60 * 60 * 1000);
  }
  if (lower.includes('today')) return new Date();
  if (lower.includes('yesterday')) return new Date(Date.now() - 24 * 60 * 60 * 1000);

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

export async function scanForums(): Promise<RawPost[]> {
  const allPosts: RawPost[] = [];

  for (const target of config.forums.targets) {
    const posts = await scrapeForum(target);
    allPosts.push(...posts);
  }

  console.log(`[Forum] Total new candidates across all forums: ${allPosts.length}`);
  return allPosts;
}
