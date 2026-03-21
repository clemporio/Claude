import readline from 'readline';
import { initDb, getPendingDrafts, updateDraftStatus, getDailyMetrics, expireOldDrafts } from './queue/queue';
import type { Draft } from './types';

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
    return;
  }

  console.log('\nScout Bot — Draft Review Queue\n');
  await showQueue();
  rl.close();
}

main().catch(err => {
  console.error(err);
  rl.close();
  process.exit(1);
});
