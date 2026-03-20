"""
Discord Promotion Bot — Main Entry Point

A multi-platform bot that promotes your Discord server by posting
scheduled, targeted messages on Discord, Twitter/X, and Reddit.

Usage:
    1. Copy .env.example to .env and fill in your API credentials
    2. pip install -r requirements.txt
    3. python main.py
"""

import asyncio
import logging
import os
import sys

import discord
from discord.ext import tasks

from bot.config import BotConfig
from bot.targeting.engine import TargetingEngine
from bot.platforms.discord_promo import DiscordPromoter
from bot.platforms.twitter_promo import TwitterPromoter
from bot.platforms.reddit_promo import RedditPromoter
from bot.scheduler import PromoScheduler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("promo_bot.log"),
    ],
)
logger = logging.getLogger("promo_bot")

# Subreddits to target (customize this list for your niche)
TARGET_SUBREDDITS = os.getenv(
    "TARGET_SUBREDDITS",
    "gaming,discordservers,findaserver"
).split(",")

# Promotion intervals (in minutes)
DISCORD_INTERVAL = int(os.getenv("DISCORD_INTERVAL_MINUTES", "60"))
TWITTER_INTERVAL = int(os.getenv("TWITTER_INTERVAL_MINUTES", "120"))
REDDIT_INTERVAL = int(os.getenv("REDDIT_INTERVAL_MINUTES", "90"))


def main():
    config = BotConfig.from_env()

    if not config.discord.bot_token:
        logger.error("DISCORD_BOT_TOKEN is required. Set it in your .env file.")
        sys.exit(1)

    if not config.discord.invite_link:
        logger.error("DISCORD_INVITE_LINK is required. Set it in your .env file.")
        sys.exit(1)

    # Initialize targeting engine
    engine = TargetingEngine(
        keywords=config.targeting.keywords,
        min_engagement=config.targeting.min_engagement,
    )

    # Initialize platform promoters
    twitter_promoter = TwitterPromoter(config, engine)
    reddit_promoter = RedditPromoter(config, engine, TARGET_SUBREDDITS)

    # Set up Discord bot
    intents = discord.Intents.default()
    intents.message_content = True
    intents.guilds = True
    bot = discord.Client(intents=intents)

    scheduler = PromoScheduler(engine)

    @bot.event
    async def on_ready():
        logger.info(f"Bot logged in as {bot.user} (ID: {bot.user.id})")
        logger.info(f"Connected to {len(bot.guilds)} servers")
        logger.info(f"Targeting keywords: {config.targeting.keywords}")
        logger.info(f"Max posts/hour: {config.targeting.max_posts_per_hour}")

        # Initialize Discord promoter (needs bot to be ready)
        discord_promoter = DiscordPromoter(bot, config, engine)

        # Wire up scheduler
        scheduler.set_discord_promoter(discord_promoter)
        scheduler.set_twitter_promoter(twitter_promoter)
        scheduler.set_reddit_promoter(reddit_promoter)

        scheduler.start(
            discord_interval_minutes=DISCORD_INTERVAL,
            twitter_interval_minutes=TWITTER_INTERVAL,
            reddit_interval_minutes=REDDIT_INTERVAL,
        )

        logger.info("Promotion bot is running! Press Ctrl+C to stop.")

    # Run the bot
    try:
        bot.run(config.discord.bot_token)
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        scheduler.stop()
    except Exception as e:
        logger.error(f"Bot crashed: {e}")
        scheduler.stop()
        sys.exit(1)


if __name__ == "__main__":
    main()
