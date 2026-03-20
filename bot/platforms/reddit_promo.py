"""Reddit platform promotion module."""

import logging
import praw
from bot.config import BotConfig
from bot.messages import get_random_message, REDDIT_COMMENTS
from bot.targeting.discovery import RedditDiscovery
from bot.targeting.engine import TargetingEngine

logger = logging.getLogger(__name__)


class RedditPromoter:
    """Handles promotional commenting on Reddit threads."""

    def __init__(self, config: BotConfig, engine: TargetingEngine,
                 target_subreddits: list[str]):
        self.config = config
        self.engine = engine
        self.target_subreddits = target_subreddits
        self.reddit = self._create_client()
        self.discovery = (
            RedditDiscovery(self.reddit, engine, target_subreddits)
            if self.reddit else None
        )

    def _create_client(self) -> praw.Reddit | None:
        rc = self.config.reddit
        if not rc.is_configured:
            logger.warning("Reddit API not configured — skipping Reddit promotion")
            return None
        return praw.Reddit(
            client_id=rc.client_id,
            client_secret=rc.client_secret,
            username=rc.username,
            password=rc.password,
            user_agent=rc.user_agent,
        )

    def comment_on_hot_threads(self, max_comments: int = 3):
        """Find hot threads and post a relevant promotional comment."""
        if not self.reddit or not self.discovery:
            return

        candidates = self.discovery.discover_hot_threads()
        keywords_str = ", ".join(self.config.targeting.keywords[:3])
        commented = 0

        for candidate in candidates:
            if commented >= max_comments:
                break

            try:
                submission = self.reddit.submission(id=candidate.identifier)
                message = get_random_message(
                    REDDIT_COMMENTS,
                    server_name=self.config.discord.server_name,
                    invite_link=self.config.discord.invite_link,
                    keywords=keywords_str,
                    description=self.config.discord.server_description,
                )
                submission.reply(message)
                self.engine.mark_posted("reddit", candidate.identifier)
                commented += 1
                logger.info(
                    f"Commented on r/{candidate.metadata.get('subreddit')} post "
                    f"'{candidate.title[:50]}' [score: {candidate.combined_score:.2f}]"
                )
            except Exception as e:
                logger.error(f"Error commenting on Reddit: {e}")

        logger.info(f"Reddit hot thread cycle: commented on {commented} threads")

    def comment_on_rising_threads(self, max_comments: int = 2):
        """Target rising threads — high momentum, great for early engagement."""
        if not self.reddit or not self.discovery:
            return

        candidates = self.discovery.discover_rising_threads()
        keywords_str = ", ".join(self.config.targeting.keywords[:3])
        commented = 0

        for candidate in candidates:
            if commented >= max_comments:
                break

            try:
                submission = self.reddit.submission(id=candidate.identifier)
                message = get_random_message(
                    REDDIT_COMMENTS,
                    server_name=self.config.discord.server_name,
                    invite_link=self.config.discord.invite_link,
                    keywords=keywords_str,
                    description=self.config.discord.server_description,
                )
                submission.reply(message)
                self.engine.mark_posted("reddit", candidate.identifier)
                commented += 1
                logger.info(
                    f"Commented on rising r/{candidate.metadata.get('subreddit')} post "
                    f"'{candidate.title[:50]}' [score: {candidate.combined_score:.2f}]"
                )
            except Exception as e:
                logger.error(f"Error commenting on rising thread: {e}")

        logger.info(f"Reddit rising cycle: commented on {commented} threads")

    def run_promotion_cycle(self):
        """Run a full Reddit promotion cycle."""
        if not self.reddit:
            logger.info("Reddit not configured, skipping")
            return
        logger.info("Starting Reddit promotion cycle...")
        self.comment_on_hot_threads()
        self.comment_on_rising_threads()
