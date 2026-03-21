# Skill: Scout Bot Oversight

**Purpose:** Monitor and optimise the betting signals scout bot running at `/opt/scout-bot/`

## What Scout Bot Does

Scout Bot monitors Reddit, Twitter/X, and betting forums for conversations relevant to Conor's multi-sport betting signals Discord. It:
- Scans platforms on schedule (Reddit 30m, Twitter 15m, Forums 60m)
- Scores posts for relevance and engagement opportunity
- Generates draft responses using Claude API
- Queues drafts for Conor to review and post manually

It NEVER posts anything itself. Conor reviews and posts from his own accounts.

## Daily Digest

Run daily at 21:00 UTC. Read the scout bot metrics and send Conor a WhatsApp summary.

```bash
cd /opt/scout-bot && npx tsx src/cli.ts report
```

This outputs JSON metrics. Format into a WhatsApp message:

**Format:**
```
Scout Bot Daily
- Found X posts, drafted Y
- You approved Z, skipped W
- E expired unreviewed
- N drafts waiting in queue

Top platform: Reddit (X drafts)
Approval rate: X%
```

If pending drafts > 5, nudge: "You've got drafts piling up — worth a 5min review session."

## Health Checks

During heartbeats, check:

```bash
systemctl is-active scout-bot
```

If inactive, restart and alert Conor:
```bash
systemctl restart scout-bot
```

Also check the database isn't growing unbounded:
```bash
ls -lh /opt/scout-bot/data/scout.db
```

If > 100MB, run cleanup of old expired/skipped drafts.

## Weekly Tuning Review

Every Sunday, review the past week's metrics:

1. Which platform generated the most approved drafts? → If one platform dominates, suggest increasing its scan frequency
2. What was the approval rate? → If < 30%, scoring thresholds may be too low. If > 80%, thresholds may be too high (missing opportunities)
3. Which intent labels led to approvals? → Adjust scoring weights if "complaining_tipster" converts better than "seeking_tips" etc.

Send Conor a brief weekly summary with any tuning recommendations.

## Anomaly Alerts

Alert Conor immediately if:
- Scout bot service is down for > 1 hour
- Zero posts found in a 24-hour period (API may be broken)
- Database errors in logs
- Rate limiting from Reddit or Twitter

```bash
journalctl -u scout-bot --since "1 hour ago" --no-pager | grep -i error
```

## Database Location

- SQLite: `/opt/scout-bot/data/scout.db`
- Read directly with `sqlite3` for ad-hoc queries
- Metrics table has daily rollups by platform

## Key Commands

| Command | Purpose |
|---------|---------|
| `cd /opt/scout-bot && npx tsx src/cli.ts` | Open review queue |
| `cd /opt/scout-bot && npx tsx src/cli.ts stats` | Show today's stats |
| `cd /opt/scout-bot && npx tsx src/cli.ts report` | JSON report for Gecko |
| `systemctl status scout-bot` | Service health |
| `journalctl -u scout-bot -f` | Live logs |
