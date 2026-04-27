import readline from 'readline';
import { initDb, closeDb, getPendingDrafts, updateDraftStatus, getDailyMetrics, expireOldDrafts, getPendingAiItems, markPendingAiDone, insertDraft, incrementMetric, getPostHistory, recordPostToDb } from './queue/queue';
import { postDraft } from './posting/poster';
import { loadPostHistory } from './safety/rails';
import type { Draft, Platform } from './types';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(q: string): Promise<string> {
  return new Promise(resolve => rl.question(q, resolve));
}

function formatDraft(draft: Draft, index: number): string {
  const platform = draft.platform.toUpperCase().padEnd(7);
  const score = draft.combinedScore.toFixed(0).padStart(3);
  const age = getAge(draft.createdAt);

  return `
${'='.repeat(80)}
[${index + 1}] ${platform} | Score: ${score} | ${age} ago
${'-'.repeat(80)}
URL: ${draft.postUrl}
Title: ${draft.postTitle || '(no title)'}
Post: ${draft.postBody.slice(0, 200)}${draft.postBody.length > 200 ? '...' : ''}
${'-'.repeat(80)}
DRAFT:
${draft.draftText}
${draft.alternateText ? `\nALTERNATE:\n${draft.alternateText}` : ''}
${'='.repeat(80)}`;
}

function getAge(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

async function showQueue(): Promise<void> {
  expireOldDrafts();
  const drafts = getPendingDrafts(20);

  if (drafts.length === 0) {
    console.log('\nNo pending drafts. Scout is still scanning.\n');
    return;
  }

  console.log(`\n${drafts.length} pending drafts (sorted by score):\n`);

  for (let i = 0; i < drafts.length; i++) {
    console.log(formatDraft(drafts[i], i));
  }

  await reviewDrafts(drafts);
}

async function reviewDrafts(drafts: Draft[]): Promise<void> {
  while (true) {
    const input = await prompt('\nAction: [number] to review, (s)tats, (q)uit > ');

    if (input === 'q' || input === 'quit') break;
    if (input === 's' || input === 'stats') {
      showStats();
      continue;
    }

    const num = parseInt(input);
    if (isNaN(num) || num < 1 || num > drafts.length) {
      console.log('Invalid selection.');
      continue;
    }

    const draft = drafts[num - 1];
    await reviewSingle(draft);
  }
}

async function reviewSingle(draft: Draft): Promise<void> {
  console.log(formatDraft(draft, 0));

  const action = await prompt('\n(a)pprove, (s)kip, (e)dit, (b)ack > ');

  switch (action.toLowerCase()) {
    case 'a':
    case 'approve':
      updateDraftStatus(draft.id, 'approved');
      console.log(`\nApproved. Draft copied below — paste it at: ${draft.postUrl}\n`);
      console.log('---');
      console.log(draft.draftText);
      console.log('---\n');
      break;

    case 's':
    case 'skip': {
      const reason = await prompt('Skip reason (optional): ');
      updateDraftStatus(draft.id, 'skipped', reason || undefined);
      console.log('Skipped.');
      break;
    }

    case 'e':
    case 'edit':
      console.log('\nCurrent draft:');
      console.log(draft.draftText);
      console.log('\n(Edit in your text editor, then approve/skip via the queue)');
      break;

    default:
      break;
  }
}

function showStats(): void {
  const metrics = getDailyMetrics();
  console.log(`
${'='.repeat(50)}
DAILY STATS — ${metrics.date}
${'='.repeat(50)}
Posts found:      ${metrics.postsFound}
Posts scored:     ${metrics.postsScored}
Drafts generated: ${metrics.draftsGenerated}
Drafts approved:  ${metrics.draftsApproved}
Drafts skipped:   ${metrics.draftsSkipped}
Drafts expired:   ${metrics.draftsExpired}

By Platform:
  Reddit:  ${metrics.byPlatform.reddit.found} found, ${metrics.byPlatform.reddit.drafted} drafted, ${metrics.byPlatform.reddit.approved} approved
  Twitter: ${metrics.byPlatform.twitter.found} found, ${metrics.byPlatform.twitter.drafted} drafted, ${metrics.byPlatform.twitter.approved} approved
  Forums:  ${metrics.byPlatform.forum.found} found, ${metrics.byPlatform.forum.drafted} drafted, ${metrics.byPlatform.forum.approved} approved
${'='.repeat(50)}
`);
}

async function main(): Promise<void> {
  await initDb();

  const args = process.argv.slice(2);

  if (args[0] === 'stats') {
    showStats();
    rl.close();
    return;
  }

  if (args[0] === 'report') {
    // JSON output for Gecko
    const metrics = getDailyMetrics();
    console.log(JSON.stringify(metrics, null, 2));
    rl.close();
    closeDb();
    return;
  }

  if (args[0] === 'pending-ai') {
    // JSON output of pending AI items for Gecko
    const items = getPendingAiItems(20);
    console.log(JSON.stringify(items, null, 2));
    rl.close();
    closeDb();
    return;
  }

  if (args[0] === 'write-draft') {
    // Gecko writes a draft back: write-draft <json>
    // JSON: { pendingId, opportunityId, platform, postUrl, postTitle, intentLabel, draftText, alternateText? }
    const jsonStr = args.slice(1).join(' ');
    try {
      const data = JSON.parse(jsonStr);
      if (!data.pendingId || !data.opportunityId || !data.draftText) {
        console.error('{"error": "Required: pendingId, opportunityId, draftText"}');
        process.exit(1);
      }

      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

      insertDraft({
        opportunityId: data.opportunityId,
        platform: (data.platform || 'reddit') as Platform,
        postUrl: data.postUrl || '',
        postTitle: data.postTitle || '',
        postBody: '',
        draftText: data.draftText,
        alternateText: data.alternateText,
        relevanceScore: data.relevanceScore || 0,
        opportunityScore: data.opportunityScore || 0,
        combinedScore: data.combinedScore || 0,
      });

      markPendingAiDone(data.pendingId);
      incrementMetric((data.platform || 'reddit') as Platform, 'drafts_generated');

      console.log(JSON.stringify({ success: true, pendingId: data.pendingId, opportunityId: data.opportunityId }));
    } catch (err: any) {
      console.error(JSON.stringify({ error: err.message }));
      process.exit(1);
    }
    rl.close();
    closeDb();
    return;
  }

  if (args[0] === 'post') {
    // Post a specific draft by ID, or post top N pending drafts
    // Usage: post <draft_id> OR post --top <N>
    // Loads safety rail state, checks limits, posts via API
    const history = getPostHistory(7);
    loadPostHistory(history);

    if (args[1] === '--top') {
      const count = parseInt(args[2]) || 3;
      const drafts = getPendingDrafts(count);
      if (drafts.length === 0) {
        console.log(JSON.stringify({ error: 'No pending drafts to post' }));
        rl.close();
        closeDb();
        return;
      }
      const results = [];
      for (const draft of drafts) {
        const result = await postDraft(draft, draft.platform === 'reddit' ? extractSubreddit(draft.postUrl) : undefined);
        if (result.success) {
          updateDraftStatus(draft.id, 'posted');
          incrementMetric(draft.platform, 'drafts_approved');
        } else if (result.safetyBlocked) {
          // Safety blocked — stop trying more, limits are hit
          results.push({ draftId: draft.id, ...result });
          break;
        } else {
          updateDraftStatus(draft.id, 'failed');
        }
        results.push({ draftId: draft.id, ...result });
      }
      console.log(JSON.stringify(results, null, 2));
    } else {
      const draftId = parseInt(args[1]);
      if (isNaN(draftId)) {
        console.error(JSON.stringify({ error: 'Usage: post <draft_id> OR post --top <N>' }));
        process.exit(1);
      }
      const drafts = getPendingDrafts(100);
      const draft = drafts.find(d => d.id === draftId);
      if (!draft) {
        console.error(JSON.stringify({ error: `Draft ${draftId} not found or not pending` }));
        process.exit(1);
      }
      const result = await postDraft(draft, draft.platform === 'reddit' ? extractSubreddit(draft.postUrl) : undefined);
      if (result.success) {
        updateDraftStatus(draft.id, 'posted');
        incrementMetric(draft.platform, 'drafts_approved');
      } else {
        updateDraftStatus(draft.id, 'failed');
      }
      console.log(JSON.stringify({ draftId: draft.id, ...result }, null, 2));
    }
    rl.close();
    closeDb();
    return;
  }

  if (args[0] === 'list') {
    // List pending drafts as JSON for Gecko
    const drafts = getPendingDrafts(20);
    const summary = drafts.map(d => ({
      id: d.id,
      platform: d.platform,
      score: d.combinedScore,
      postUrl: d.postUrl,
      title: d.postTitle?.slice(0, 80),
      draft: d.draftText.slice(0, 200),
      hasAlternate: !!d.alternateText,
    }));
    console.log(JSON.stringify(summary, null, 2));
    rl.close();
    closeDb();
    return;
  }

  console.log('\nScout Bot — Draft Review Queue\n');
  await showQueue();
  rl.close();
  closeDb();
}

function extractSubreddit(url: string): string | undefined {
  const match = url.match(/reddit\.com\/r\/([^/]+)/);
  return match?.[1];
}

main().catch(err => {
  console.error(err);
  rl.close();
  process.exit(1);
});
