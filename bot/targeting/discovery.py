"""
Platform-specific discovery functions that find high-engagement targets
and feed them into the targeting engine.
"""

import logging
from .engine import TargetingEngine, TargetCandidate

logger = logging.getLogger(__name__)


class RedditDiscovery:
    """Discovers high-engagement Reddit threads relevant to promotion."""

    def __init__(self, reddit_client, engine: TargetingEngine, subreddits: list[str]):
        self.reddit = reddit_client
        self.engine = engine
        self.subreddits = subreddits

    def discover_hot_threads(self, limit_per_sub: int = 25) -> list[TargetCandidate]:
        """Scan hot threads in target subreddits for high-engagement opportunities."""
        candidates = []
        for sub_name in self.subreddits:
            try:
                subreddit = self.reddit.subreddit(sub_name)
                for submission in subreddit.hot(limit=limit_per_sub):
                    if submission.stickied or submission.locked:
                        continue

                    text = f"{submission.title} {submission.selftext}"
                    metrics = {
                        "upvotes": submission.score,
                        "comments": submission.num_comments,
                    }
                    candidate = self.engine.evaluate(
                        platform="reddit",
                        identifier=submission.id,
                        title=submission.title,
                        text=text,
                        metrics=metrics,
                        metadata={
                            "subreddit": sub_name,
                            "url": submission.url,
                            "permalink": f"https://reddit.com{submission.permalink}",
                        },
                    )
                    if candidate:
                        candidates.append(candidate)
            except Exception as e:
                logger.error(f"Error scanning r/{sub_name}: {e}")

        return self.engine.rank_candidates(candidates)

    def discover_rising_threads(self, limit_per_sub: int = 15) -> list[TargetCandidate]:
        """Find rising threads — these have momentum and are ideal for early engagement."""
        candidates = []
        for sub_name in self.subreddits:
            try:
                subreddit = self.reddit.subreddit(sub_name)
                for submission in subreddit.rising(limit=limit_per_sub):
                    if submission.stickied or submission.locked:
                        continue

                    text = f"{submission.title} {submission.selftext}"
                    metrics = {
                        "upvotes": submission.score,
                        "comments": submission.num_comments,
                    }
                    candidate = self.engine.evaluate(
                        platform="reddit",
                        identifier=submission.id,
                        title=submission.title,
                        text=text,
                        metrics=metrics,
                        metadata={
                            "subreddit": sub_name,
                            "url": submission.url,
                            "permalink": f"https://reddit.com{submission.permalink}",
                            "rising": True,
                        },
                    )
                    if candidate:
                        candidates.append(candidate)
            except Exception as e:
                logger.error(f"Error scanning rising r/{sub_name}: {e}")

        return self.engine.rank_candidates(candidates)


class TwitterDiscovery:
    """Discovers high-engagement Twitter/X conversations relevant to promotion."""

    def __init__(self, twitter_client, engine: TargetingEngine):
        self.client = twitter_client
        self.engine = engine

    def discover_trending_conversations(self, keywords: list[str],
                                         max_results: int = 50) -> list[TargetCandidate]:
        """Search Twitter for high-engagement tweets matching our keywords."""
        candidates = []
        for keyword in keywords:
            try:
                query = f"{keyword} -is:retweet lang:en"
                tweets = self.client.search_recent_tweets(
                    query=query,
                    max_results=min(max_results, 100),
                    tweet_fields=["public_metrics", "conversation_id", "created_at"],
                )
                if not tweets.data:
                    continue

                for tweet in tweets.data:
                    pm = tweet.public_metrics or {}
                    metrics = {
                        "likes": pm.get("like_count", 0),
                        "retweets": pm.get("retweet_count", 0),
                        "replies": pm.get("reply_count", 0),
                    }
                    candidate = self.engine.evaluate(
                        platform="twitter",
                        identifier=str(tweet.id),
                        title=tweet.text[:80],
                        text=tweet.text,
                        metrics=metrics,
                        metadata={
                            "conversation_id": tweet.conversation_id,
                            "tweet_url": f"https://twitter.com/i/web/status/{tweet.id}",
                        },
                    )
                    if candidate:
                        candidates.append(candidate)
            except Exception as e:
                logger.error(f"Error searching Twitter for '{keyword}': {e}")

        return self.engine.rank_candidates(candidates)


class DiscordDiscovery:
    """Discovers high-engagement Discord channels/threads for cross-promotion."""

    def __init__(self, discord_bot, engine: TargetingEngine):
        self.bot = discord_bot
        self.engine = engine

    async def discover_active_channels(self) -> list[TargetCandidate]:
        """Find the most active channels across servers the bot is in."""
        candidates = []
        for guild in self.bot.guilds:
            for channel in guild.text_channels:
                try:
                    # Check recent message activity
                    messages = [msg async for msg in channel.history(limit=50)]
                    if not messages:
                        continue

                    unique_authors = len(set(m.author.id for m in messages))
                    total_reactions = sum(
                        sum(r.count for r in m.reactions) for m in messages if m.reactions
                    )
                    text = channel.name + " " + (channel.topic or "")
                    metrics = {
                        "active_members": unique_authors,
                        "comments": len(messages),
                        "likes": total_reactions,
                    }
                    candidate = self.engine.evaluate(
                        platform="discord",
                        identifier=str(channel.id),
                        title=f"#{channel.name} in {guild.name}",
                        text=text,
                        metrics=metrics,
                        metadata={
                            "guild_id": guild.id,
                            "guild_name": guild.name,
                            "channel_name": channel.name,
                        },
                    )
                    if candidate:
                        candidates.append(candidate)
                except Exception as e:
                    logger.debug(f"Skipping #{channel.name}: {e}")

        return self.engine.rank_candidates(candidates)

    async def discover_active_threads(self) -> list[TargetCandidate]:
        """Find active threads — these are highly engaged conversations."""
        candidates = []
        for guild in self.bot.guilds:
            try:
                threads = await guild.active_threads()
                for thread in threads:
                    messages = [msg async for msg in thread.history(limit=30)]
                    if not messages:
                        continue

                    unique_authors = len(set(m.author.id for m in messages))
                    text = thread.name
                    metrics = {
                        "active_members": unique_authors,
                        "comments": len(messages),
                    }
                    candidate = self.engine.evaluate(
                        platform="discord",
                        identifier=str(thread.id),
                        title=f"Thread: {thread.name} in {guild.name}",
                        text=text,
                        metrics=metrics,
                        metadata={
                            "guild_id": guild.id,
                            "guild_name": guild.name,
                            "thread_name": thread.name,
                            "is_thread": True,
                        },
                    )
                    if candidate:
                        candidates.append(candidate)
            except Exception as e:
                logger.debug(f"Error scanning threads in {guild.name}: {e}")

        return self.engine.rank_candidates(candidates)
