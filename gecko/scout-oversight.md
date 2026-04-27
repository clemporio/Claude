# Gecko Skill: Scout Bot Oversight

## What This Is
The Scout Bot runs at `/opt/scout-bot/` on the VPS. It monitors Reddit, Twitter/X, and betting forums for conversations relevant to Conor's betting signals Discord. It finds opportunities, scores them, drafts responses, and queues them for posting via Conor's real social media accounts.

**Your role:** Process the AI queue (intent classification + draft generation), oversee operations, enforce safety, track effectiveness, and report to Conor.

## AI Processing — Your Core Job

The scout bot handles monitoring and rule-based scoring. It does NOT call any AI APIs. That's your job.

### How it works
1. Scout bot finds posts, scores them with keywords/topics/freshness, and writes them to the `pending_ai` table
2. You pick them up, classify intent, generate drafts, and write results back
3. Drafts then enter the posting queue

### Processing Pending Items

**Check for pending items:**
```bash
bash /opt/scout-bot/gecko/process-queue.sh
```
This returns JSON array of items needing your AI processing.

**For each item, you must:**

1. **Classify intent** — Read the post title + body and classify as one of:
   - `seeking_tips` (asking for picks, signals, communities, or betting help) — score: 30
   - `seeking_community` (looking to join a betting group/discord) — score: 28
   - `complaining_tipster` (frustrated with a tipster or service) — score: 22
   - `general_discussion` (general betting chat) — score: 12
   - `sharing_picks` (sharing their own picks) — score: 8
   - `irrelevant` (not sports betting related) — score: 0

2. **If irrelevant:** Mark as done and skip: `sqlite3 /opt/scout-bot/data/scout.db "UPDATE pending_ai SET status = 'done' WHERE id = <id>"`

3. **Generate drafts** — For relevant posts, generate TWO draft responses:
   - **Primary:** Naturally includes a Discord mention IF appropriate
   - **Alternate:** Purely helpful, no Discord mention

   Use the audience intelligence data (detected_sports, detected_regions) to get terminology right. A British football punter post needs "accumulator" not "parlay". An American NBA post needs "sportsbook" not "bookmaker". Getting this wrong = instant credibility loss.

4. **Write the draft back:**
```bash
bash /opt/scout-bot/gecko/write-draft.sh <pending_id> <opp_id> <platform> <url> <title> <intent_label> "<draft_text>" "<alternate_text>"
```

### Frequency
- Run this **every heartbeat during peak hours** (or at minimum every 30 minutes)
- Posts decay fast — a 6-hour-old opportunity is worth much less than a 30-minute-old one
- If there are 0 pending items, move on — don't waste a turn

### X Algorithm Intelligence — READ THIS CAREFULLY

@LXIIVegas has X Premium. This gives us 4x visibility in-network, 2x out-of-network, and our replies are algorithmically sorted to the top of conversation threads. Every reply we post has outsized reach. Use it wisely.

**The algorithm scoring hierarchy (from X's source code):**

| Signal | Weight | Implication |
|--------|--------|-------------|
| Reply that gets a reply BACK from the author | +75 | 150x a like. THIS IS THE GOAL. |
| Reply to a tweet | +13.5 | 27x a like, even without a response |
| Profile click from reply | +12 | Someone reads reply → clicks @LXIIVegas |
| Dwell time (2+ min in conversation) | +10 | Longer threads = more distribution |
| Bookmark | +10 | Saved conversations get boosted |
| Like | +0.5 | Nearly worthless |

**The single objective of every reply: get the original author to reply back to us.** That one interaction is worth more than hundreds of likes. Every draft must be engineered to provoke a response.

### Draft Quality Rules

**Content rules:**
- Every reply must genuinely contribute FIRST — value must stand alone
- NEVER include links in replies — the algorithm buries replies with external links. No Discord links, no website links, nothing. Links only go in standalone tweets on our own timeline.
- Never say "check out", "join", "visit", or any call-to-action language
- Never claim specific win rates, ROI, or profits
- Sound like a real person who bets, not someone promoting a service
- USE CORRECT TERMINOLOGY FOR THE AUDIENCE — this is non-negotiable

**Algorithm-optimised rules:**
- EVERY reply MUST end with a question. This is the #1 lever for getting the author to reply back (75x multiplier). No exceptions.
- Add a take, not just agreement. "Interesting, but I see it differently..." outperforms "Great analysis, I agree" every time. Contrarian or novel angles spark debate.
- Share a specific data point or personal anecdote — generic agreement gets buried
- Keep replies 2-4 sentences. Long enough to signal quality (algorithm de-prioritises 1-2 word replies), short enough to read on mobile
- No hashtags in replies (spam signal)
- No emojis unless the conversation tone warrants it
- Post timing matters — the first 30 minutes of a tweet's life are when the algorithm decides its reach. Process the queue fast during peak hours.

**What gets PENALISED:**
- Short generic replies ("great take", "this", "facts") — algorithmically deprioritised
- Links in replies — algorithm treats as spam/off-platform redirect
- Same link across multiple replies — triggers spam detection
- Hashtag stuffing — more than 1-2 = spam flag
- Repetitive/templated language across replies — bot signal
- Report triggers = -369x penalty (essentially kills the post)

### Tweet Formatting Rules — MANDATORY

**Two types of content, two formats:**

#### 1. REPLIES (posted to other people's tweets)
- Open with a short, sharp take that adds to the discussion (1 line)
- Line break
- 1-2 sentences that demonstrate knowledge or share an insight
- Line break
- Close with a QUESTION directed at the author (mandatory)
- Keep under 280 characters
- NO links, NO hashtags

**Example of a GOOD reply:**
```
Load management is the hidden variable nobody prices in properly.

Back-to-backs late in the season are where the real prop value lives — usage rates shift massively when a star sits.

What's your model weighting for rest days?
```

**Example of a BAD reply:**
```
The injury factor on NBA props is brutal. Half the time you are betting on whether a guy even suits up. Data-driven approaches that factor in availability and load management have been way more consistent than just looking at matchups.
```
(No question. No line breaks. No reason for the author to respond. Algorithm buries this.)

#### 2. STANDALONE TWEETS (posted to @LXIIVegas timeline)
- Open with a punchy observation (1 line)
- Line break
- 1-2 supporting sentences with substance
- Optionally close with a question to invite engagement
- Can include a Discord mention IF natural (but still no bare links — algorithm penalises them)
- Keep under 280 characters
- Max 1-2 hashtags if genuinely relevant

**Before writing ANY draft, check:**
1. Does it end with a question? (replies: mandatory. standalones: strongly preferred)
2. Would this make the author want to respond?
3. Does it read well on a phone screen with line breaks?
4. Is it under 280 characters?
5. Are there zero links in replies?
6. Is the terminology correct for the audience?

### Reply Drafts — Email to Conor for Manual Posting

Replies should be posted via the CLI where possible (Premium account supports replies). If the API blocks a specific reply, fall back to email for manual posting. Send to **conor@lxiicapital.com**.

**When to send:** Once daily during peak hours, or whenever you have 3+ reply drafts that failed via API.

**Email format:**

Subject: `Scout Bot — Reply Drafts [date]`

Body:
```
[number of drafts] reply drafts ready for manual posting.

---

1. [SPORT] — [brief description of the original tweet]
   URL: [full tweet URL]

   Draft reply:
   [the formatted reply text, ready to copy-paste]

---

2. [SPORT] — [brief description]
   URL: [full tweet URL]

   Draft reply:
   [reply text]

---
```

**Rules:**
- Only include reply-worthy posts (seeking_tips, seeking_community, complaining_tipster). Don't email replies to people just sharing their own picks.
- Format each reply following the Tweet Formatting Rules above
- Include the full clickable URL so Conor can open it directly
- Keep the email clean and scannable — Conor will be copy-pasting from his phone
- Send via the Gmail/email skill you already have access to
- Mark these drafts as `approved` in the DB after emailing (Conor handles actual posting)

**Standalone tweets still post automatically via the CLI. This email flow is ONLY for replies.**

## Safety Rails — Non-Negotiable

The bot has built-in safety limits. Your job is to monitor compliance and flag anomalies.

### Hard Limits (configured in .env, enforced in code)
| Limit | Default | Why |
|-------|---------|-----|
| Total posts/day | 8 | More than this looks automated |
| Reddit posts/day | 4 | Reddit is aggressive on spam detection |
| Twitter posts/day | 5 | Twitter is more lenient but still has rate limits |
| Forum posts/day | 2 | Forums are manual-only, this caps the queue |
| Discord mention ratio | 1 in 4 | Max 1 of every 4 posts can mention Discord |
| Reddit cooldown | 90 min | Minimum gap between Reddit posts |
| Twitter cooldown | 45 min | Minimum gap between tweets |
| Max per subreddit/day | 1 | Never post twice in the same subreddit in a day |
| Subreddit cooldown | 24 hours | Full day between posts in the same sub |

### Your Enforcement Duties
1. **Daily check:** Read `/opt/scout-bot/data/scout.db` post_history table. Verify posts stayed within limits.
2. **If limits were hit:** Report to Conor that demand exceeded capacity — this is useful signal, not a problem.
3. **If limits were breached (bug):** Alert Conor immediately. Stop the bot with `systemctl stop scout-bot`.
4. **Weekly review:** Check if limits should be adjusted based on what's working. Only adjust after discussing with Conor.

## Posting Drafts — How To

**IMPORTANT: Do NOT call Twitter/Reddit APIs yourself. Always use the scout bot CLI. It handles authentication, safety rails, and DB recording.**

### Post top N drafts (by score):
```bash
cd /opt/scout-bot && node dist/cli.js post --top 3
```

### Post a specific draft by ID:
```bash
cd /opt/scout-bot && node dist/cli.js post 42
```

### List pending drafts (JSON):
```bash
cd /opt/scout-bot && node dist/cli.js list
```

### Or use the shell wrappers:
```bash
bash /opt/scout-bot/gecko/post-drafts.sh --top 3
bash /opt/scout-bot/gecko/post-drafts.sh 42
bash /opt/scout-bot/gecko/post-drafts.sh list
```

### What happens when you post:
1. Safety rails check ALL limits (daily cap, platform cap, cooldown, subreddit limit, Discord mention ratio)
2. If any limit is hit → post is blocked with a clear reason, no API call made
3. If allowed → posts via the authenticated API (Twitter OAuth 1.0a / Reddit OAuth)
4. Result recorded to `post_history` table (success or failure)
5. In-memory safety state updated
6. Returns JSON with success/failure and posted URL

### Posting cadence recommendation:
- Post 3-5 drafts per cycle, spread across the day
- Don't dump all 15 Twitter posts at once — stagger them
- Let cooldowns do their job (20min Twitter, 90min Reddit)
- Check `list` first to review what's queued before posting

## Daily Digest (WhatsApp)

Send Conor a daily summary. Format:

```
Scout Bot — [date]

Found: [X] opportunities
Drafted: [X] responses
Posted: [X] (Reddit [X], Twitter [X])
Discord mentions: [X]/[X] posts ([X]%)

Top platform: [Reddit/Twitter]
Subreddits hit: [list]

Safety: All limits held / [specific limit hit]
```

Pull this data from the scout.db `metrics` and `post_history` tables.

## Effectiveness Tracking

### What to Track
- **Posts → Discord joins:** Compare post_history dates with Discord invite stats. If Conor created platform-specific invite links, correlate which platform drives the most joins.
- **Post type → engagement:** Which intent types (seeking_tips, complaining_tipster, etc.) led to the most successful posts?
- **Sport → conversion:** Do NBA-focused posts drive more joins than football? Track and report.
- **Time of day:** When do posts get the most engagement?

### Weekly Report (WhatsApp)
```
Scout Bot Weekly — [date range]

Posts: [X] total (Reddit [X], Twitter [X])
Discord mentions used: [X]/[X] ([X]%)
Estimated joins from scout activity: [X]

Best performing:
- Platform: [X]
- Sport niche: [X]
- Best post: [URL] (score: [X])

Recommendations:
- [Any tuning suggestions based on data]
```

## Tuning Recommendations

After 2+ weeks of data, you can suggest changes to:

1. **Scoring weights** — If high-scoring posts aren't converting, the scoring model needs adjustment
2. **Subreddit list** — Drop dead subs, add active ones you discover
3. **Keyword list** — Add terms that appear in converting posts but aren't in the monitor config
4. **Cooldown timers** — If we're consistently hitting limits with quality content, suggest loosening specific limits (with Conor's approval)
5. **Draft quality** — If certain draft styles convert better, update the drafter system prompt

**IMPORTANT:** Never change safety limits without Conor's explicit approval. You can recommend, not act.

## Commands

From the VPS:
- `systemctl status scout-bot` — check if bot is running
- `systemctl restart scout-bot` — restart (after config changes)
- `systemctl stop scout-bot` — emergency stop
- `cd /opt/scout-bot && npx tsx src/cli.ts pending` — view pending drafts
- `cd /opt/scout-bot && npx tsx src/cli.ts stats` — view today's stats
- `sqlite3 /opt/scout-bot/data/scout.db "SELECT * FROM post_history ORDER BY posted_at DESC LIMIT 20"` — recent posts
- `journalctl -u scout-bot --since '1 hour ago'` — recent logs

## Anomaly Alerts

Flag to Conor immediately if:
- Bot hasn't posted in 24+ hours (may be down or API issue)
- Reddit returns 403/banned errors (account may be flagged)
- Twitter returns 403 errors (API permissions issue)
- Draft generation fails repeatedly (Anthropic API issue)
- Post volume suddenly spikes (something is wrong with rate limiting)
- All posts in a day went to the same subreddit (rotation failure)

## Account Security

- Credentials are in `/opt/scout-bot/.env` — never expose these in logs, reports, or WhatsApp messages
- If you suspect account compromise, stop the bot first, then alert Conor
- Reddit and Twitter tokens should be rotated quarterly — remind Conor

## Relationship to GeckoOps

This is a **separate project** from GeckoOps. Do not mix scout bot operations with GeckoOps pipeline operations. They share no infrastructure except the VPS itself.
