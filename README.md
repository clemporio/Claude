# Discord Promotion Bot

A multi-platform bot that promotes your Discord server by posting scheduled, targeted messages across Discord, Twitter/X, and Reddit.

## Features

- **Intelligent Targeting Engine** — Discovers high-engagement communities, threads, and conversations that are most relevant to your server's topic
- **Multi-Platform Promotion** — Posts across Discord (other servers), Twitter/X, and Reddit
- **Engagement Scoring** — Ranks targets by a weighted combination of engagement metrics (comments, likes, upvotes, active members) and keyword relevance
- **Scheduled Automation** — Configurable intervals for each platform using APScheduler
- **Duplicate Prevention** — Tracks posted targets to avoid double-posting, with daily cache reset
- **Rotating Messages** — Multiple message templates per platform to keep promos fresh

## Architecture

```
bot/
├── config.py                 # Configuration from environment variables
├── messages.py               # Promotional message templates
├── scheduler.py              # APScheduler-based job orchestration
├── targeting/
│   ├── engine.py             # Core scoring & ranking engine
│   └── discovery.py          # Platform-specific target discovery
└── platforms/
    ├── discord_promo.py      # Discord channel/thread promotion
    ├── twitter_promo.py      # Twitter/X tweets and replies
    └── reddit_promo.py       # Reddit comment promotion
main.py                      # Entry point
```

## Setup

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

- **Discord**: Bot token (from [Discord Developer Portal](https://discord.com/developers/applications)) and your server's invite link
- **Twitter/X**: API v2 credentials (from [Twitter Developer Portal](https://developer.twitter.com/))
- **Reddit**: API credentials (from [Reddit App Preferences](https://www.reddit.com/prefs/apps))

### 3. Configure targeting

In your `.env` file:

```
TARGET_KEYWORDS=gaming,community,chat
TARGET_MIN_ENGAGEMENT=10
TARGET_MAX_POSTS_PER_HOUR=5
TARGET_SUBREDDITS=gaming,discordservers,findaserver
```

### 4. Run the bot

```bash
python main.py
```

## How Targeting Works

The targeting engine uses a two-factor scoring system:

1. **Engagement Score (40% weight)** — Based on weighted metrics like comments (3x), replies (3x), retweets (2x), likes (1x), active members (2x). Uses logarithmic normalization to handle varying scales.

2. **Relevance Score (60% weight)** — Measures keyword match density in thread titles, body text, and channel topics against your configured keywords.

Targets below the minimum engagement threshold are filtered out. Remaining candidates are ranked by combined score, and the top targets are selected for promotion.

## Configuration

| Environment Variable | Description | Default |
|---|---|---|
| `DISCORD_BOT_TOKEN` | Discord bot token (required) | — |
| `DISCORD_INVITE_LINK` | Your server's invite link (required) | — |
| `DISCORD_SERVER_NAME` | Your server's name | — |
| `DISCORD_SERVER_DESCRIPTION` | Short description for promos | — |
| `TWITTER_API_KEY` | Twitter API key | — |
| `TWITTER_API_SECRET` | Twitter API secret | — |
| `TWITTER_ACCESS_TOKEN` | Twitter access token | — |
| `TWITTER_ACCESS_SECRET` | Twitter access secret | — |
| `REDDIT_CLIENT_ID` | Reddit app client ID | — |
| `REDDIT_CLIENT_SECRET` | Reddit app client secret | — |
| `REDDIT_USERNAME` | Reddit username | — |
| `REDDIT_PASSWORD` | Reddit password | — |
| `TARGET_KEYWORDS` | Comma-separated keywords | — |
| `TARGET_MIN_ENGAGEMENT` | Minimum engagement threshold | `10` |
| `TARGET_MAX_POSTS_PER_HOUR` | Rate limit per hour | `5` |
| `TARGET_SUBREDDITS` | Comma-separated subreddits | `gaming,discordservers,findaserver` |
| `DISCORD_INTERVAL_MINUTES` | Discord promo interval | `60` |
| `TWITTER_INTERVAL_MINUTES` | Twitter promo interval | `120` |
| `REDDIT_INTERVAL_MINUTES` | Reddit promo interval | `90` |
