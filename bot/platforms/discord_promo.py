"""Discord platform promotion module."""

import logging
import discord
from bot.config import BotConfig
from bot.messages import get_random_message, DISCORD_PROMOS
from bot.targeting.discovery import DiscordDiscovery
from bot.targeting.engine import TargetingEngine

logger = logging.getLogger(__name__)


class DiscordPromoter:
    """Handles promotional messaging on Discord channels and threads."""

    def __init__(self, bot: discord.Client, config: BotConfig, engine: TargetingEngine):
        self.bot = bot
        self.config = config
        self.engine = engine
        self.discovery = DiscordDiscovery(bot, engine)

    async def promote_in_active_channels(self, max_posts: int = 3):
        """Find the most active, relevant channels and post a promo message."""
        candidates = await self.discovery.discover_active_channels()
        keywords_str = ", ".join(self.config.targeting.keywords[:3])
        posted = 0

        for candidate in candidates:
            if posted >= max_posts:
                break

            channel_id = int(candidate.identifier)
            channel = self.bot.get_channel(channel_id)
            if not channel:
                continue

            # Don't post in our own server
            if channel.guild.name == self.config.discord.server_name:
                continue

            try:
                message = get_random_message(
                    DISCORD_PROMOS,
                    server_name=self.config.discord.server_name,
                    invite_link=self.config.discord.invite_link,
                    keywords=keywords_str,
                )
                await channel.send(message)
                self.engine.mark_posted("discord", candidate.identifier)
                posted += 1
                logger.info(f"Posted promo in #{channel.name} ({channel.guild.name}) "
                            f"[score: {candidate.combined_score:.2f}]")
            except discord.Forbidden:
                logger.debug(f"No permission to post in #{channel.name}")
            except Exception as e:
                logger.error(f"Error posting in #{channel.name}: {e}")

        logger.info(f"Discord promotion cycle: posted in {posted} channels")

    async def promote_in_active_threads(self, max_posts: int = 2):
        """Find active threads and post promotional content."""
        candidates = await self.discovery.discover_active_threads()
        keywords_str = ", ".join(self.config.targeting.keywords[:3])
        posted = 0

        for candidate in candidates:
            if posted >= max_posts:
                break

            thread_id = int(candidate.identifier)
            thread = self.bot.get_channel(thread_id)
            if not thread:
                continue

            if thread.guild.name == self.config.discord.server_name:
                continue

            try:
                message = get_random_message(
                    DISCORD_PROMOS,
                    server_name=self.config.discord.server_name,
                    invite_link=self.config.discord.invite_link,
                    keywords=keywords_str,
                )
                await thread.send(message)
                self.engine.mark_posted("discord", candidate.identifier)
                posted += 1
                logger.info(f"Posted promo in thread '{thread.name}' "
                            f"[score: {candidate.combined_score:.2f}]")
            except Exception as e:
                logger.error(f"Error posting in thread: {e}")

        logger.info(f"Discord thread promotion: posted in {posted} threads")

    async def run_promotion_cycle(self):
        """Run a full Discord promotion cycle."""
        logger.info("Starting Discord promotion cycle...")
        await self.promote_in_active_channels()
        await self.promote_in_active_threads()
