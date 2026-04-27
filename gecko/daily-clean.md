# 2026-03-24

## Scout Bot — Active Task

You have ONE job this heartbeat. Execute these commands in order.

### Step 1: Get pending items

```
bash /opt/scout-bot/gecko/process-queue.sh
```

### Step 2: For each item, classify and draft

Write a standalone tweet draft for each good item:

```
cd /opt/scout-bot && node dist/cli.js write-draft '{"pendingId":ID,"opportunityId":OPP_ID,"platform":"twitter","postUrl":"","postTitle":"","draftText":"YOUR DRAFT","relevanceScore":30,"opportunityScore":70,"combinedScore":55}'
```

### Step 3: Post standalones

```
cd /opt/scout-bot && node dist/cli.js post --top 5
```

### Step 4: Email reply drafts to Conor

For tweets worth replying to (seeking_tips, seeking_community, complaining_tipster from high-reach verified accounts), email conor@lxiicapital.com using sendmail. Format:

Subject: Scout Bot - Reply Drafts [date]

Each entry: numbered, tweet URL, draft reply text. Every reply ends with a question. No links.

### Draft rules:
- Every reply MUST end with a question
- No links in replies ever
- 2-4 sentences with line breaks
- Correct terminology (US: parlay/sportsbook, UK: accumulator/bookmaker)
- Title field contains author bio — use it to adjust tone
- Confident but conversational. Pub chat, not an ad.

### Full reference: /root/.openclaw/workspace/scout-oversight.md

### Repeat this every heartbeat during peak hours.
