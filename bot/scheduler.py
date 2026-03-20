"""
Scheduler that orchestrates promotion cycles across all platforms
on configurable intervals.
"""

import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from bot.targeting.engine import TargetingEngine

logger = logging.getLogger(__name__)


class PromoScheduler:
    """Manages scheduled promotion jobs across all platforms."""

    def __init__(self, engine: TargetingEngine):
        self.scheduler = AsyncIOScheduler()
        self.engine = engine
        self._discord_promoter = None
        self._twitter_promoter = None
        self._reddit_promoter = None

    def set_discord_promoter(self, promoter):
        self._discord_promoter = promoter

    def set_twitter_promoter(self, promoter):
        self._twitter_promoter = promoter

    def set_reddit_promoter(self, promoter):
        self._reddit_promoter = promoter

    def _run_twitter_cycle(self):
        if self._twitter_promoter:
            self._twitter_promoter.run_promotion_cycle()

    def _run_reddit_cycle(self):
        if self._reddit_promoter:
            self._reddit_promoter.run_promotion_cycle()

    async def _run_discord_cycle(self):
        if self._discord_promoter:
            await self._discord_promoter.run_promotion_cycle()

    def _reset_daily_cache(self):
        """Reset the posted-targets cache daily so we can re-engage."""
        self.engine.reset_posted()
        logger.info("Daily cache reset complete")

    def start(self,
              discord_interval_minutes: int = 60,
              twitter_interval_minutes: int = 120,
              reddit_interval_minutes: int = 90):
        """Start all scheduled promotion jobs."""

        if self._discord_promoter:
            self.scheduler.add_job(
                self._run_discord_cycle,
                trigger=IntervalTrigger(minutes=discord_interval_minutes),
                id="discord_promo",
                name="Discord Promotion Cycle",
                replace_existing=True,
            )
            logger.info(f"Discord promotion scheduled every {discord_interval_minutes}m")

        if self._twitter_promoter:
            self.scheduler.add_job(
                self._run_twitter_cycle,
                trigger=IntervalTrigger(minutes=twitter_interval_minutes),
                id="twitter_promo",
                name="Twitter Promotion Cycle",
                replace_existing=True,
            )
            logger.info(f"Twitter promotion scheduled every {twitter_interval_minutes}m")

        if self._reddit_promoter:
            self.scheduler.add_job(
                self._run_reddit_cycle,
                trigger=IntervalTrigger(minutes=reddit_interval_minutes),
                id="reddit_promo",
                name="Reddit Promotion Cycle",
                replace_existing=True,
            )
            logger.info(f"Reddit promotion scheduled every {reddit_interval_minutes}m")

        # Daily cache reset at midnight
        self.scheduler.add_job(
            self._reset_daily_cache,
            trigger=IntervalTrigger(hours=24),
            id="cache_reset",
            name="Daily Cache Reset",
            replace_existing=True,
        )

        self.scheduler.start()
        logger.info("Scheduler started with all promotion jobs")

    def stop(self):
        """Stop the scheduler."""
        self.scheduler.shutdown()
        logger.info("Scheduler stopped")
