"""Twitter/X platform promotion module."""

import logging
import tweepy
from bot.config import BotConfig
from bot.messages import get_random_message, TWITTER_PROMOS, TWITTER_REPLIES
from bot.targeting.discovery import TwitterDiscovery
from bot.targeting.engine import TargetingEngine

logger = logging.getLogger(__name__)


class TwitterPromoter:
    """Handles promotional posting and replies on Twitter/X."""

    def __init__(self, config: BotConfig, engine: TargetingEngine):
        self.config = config
        self.engine = engine
        self.client = self._create_client()
        self.discovery = TwitterDiscovery(self.client, engine) if self.client else None

    def _create_client(self) -> tweepy.Client | None:
        tc = self.config.twitter
        if not tc.is_configured:
            logger.warning("Twitter API not configured — skipping Twitter promotion")
            return None
        return tweepy.Client(
            consumer_key=tc.api_key,
            consumer_secret=tc.api_secret,
            access_token=tc.access_token,
            access_token_secret=tc.access_secret,
        )

    def post_standalone_promo(self):
        """Post a standalone promotional tweet."""
        if not self.client:
            return

        keywords_str = ", ".join(self.config.targeting.keywords[:3])
        message = get_random_message(
            TWITTER_PROMOS,
            server_name=self.config.discord.server_name,
            invite_link=self.config.discord.invite_link,
            keywords=keywords_str,
            description=self.config.discord.server_description,
        )

        try:
            self.client.create_tweet(text=message)
            logger.info("Posted standalone promo tweet")
        except Exception as e:
            logger.error(f"Error posting tweet: {e}")

    def reply_to_trending(self, max_replies: int = 3):
        """Find high-engagement tweets and reply with a promo."""
        if not self.client or not self.discovery:
            return

        candidates = self.discovery.discover_trending_conversations(
            keywords=self.config.targeting.keywords
        )
        keywords_str = ", ".join(self.config.targeting.keywords[:3])
        replied = 0

        for candidate in candidates:
            if replied >= max_replies:
                break

            message = get_random_message(
                TWITTER_REPLIES,
                server_name=self.config.discord.server_name,
                invite_link=self.config.discord.invite_link,
                keywords=keywords_str,
            )

            try:
                self.client.create_tweet(
                    text=message,
                    in_reply_to_tweet_id=int(candidate.identifier),
                )
                self.engine.mark_posted("twitter", candidate.identifier)
                replied += 1
                logger.info(f"Replied to tweet {candidate.identifier} "
                            f"[score: {candidate.combined_score:.2f}]")
            except Exception as e:
                logger.error(f"Error replying to tweet: {e}")

        logger.info(f"Twitter reply cycle: replied to {replied} tweets")

    def run_promotion_cycle(self):
        """Run a full Twitter promotion cycle."""
        if not self.client:
            logger.info("Twitter not configured, skipping")
            return
        logger.info("Starting Twitter promotion cycle...")
        self.post_standalone_promo()
        self.reply_to_trending()
