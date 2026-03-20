import os
from dataclasses import dataclass, field
from dotenv import load_dotenv

load_dotenv()


@dataclass
class DiscordConfig:
    bot_token: str = ""
    invite_link: str = ""
    server_name: str = ""
    server_description: str = ""

    @classmethod
    def from_env(cls) -> "DiscordConfig":
        return cls(
            bot_token=os.getenv("DISCORD_BOT_TOKEN", ""),
            invite_link=os.getenv("DISCORD_INVITE_LINK", ""),
            server_name=os.getenv("DISCORD_SERVER_NAME", ""),
            server_description=os.getenv("DISCORD_SERVER_DESCRIPTION", ""),
        )


@dataclass
class TwitterConfig:
    api_key: str = ""
    api_secret: str = ""
    access_token: str = ""
    access_secret: str = ""

    @classmethod
    def from_env(cls) -> "TwitterConfig":
        return cls(
            api_key=os.getenv("TWITTER_API_KEY", ""),
            api_secret=os.getenv("TWITTER_API_SECRET", ""),
            access_token=os.getenv("TWITTER_ACCESS_TOKEN", ""),
            access_secret=os.getenv("TWITTER_ACCESS_SECRET", ""),
        )

    @property
    def is_configured(self) -> bool:
        return all([self.api_key, self.api_secret, self.access_token, self.access_secret])


@dataclass
class RedditConfig:
    client_id: str = ""
    client_secret: str = ""
    username: str = ""
    password: str = ""
    user_agent: str = "DiscordPromoBot/1.0"

    @classmethod
    def from_env(cls) -> "RedditConfig":
        return cls(
            client_id=os.getenv("REDDIT_CLIENT_ID", ""),
            client_secret=os.getenv("REDDIT_CLIENT_SECRET", ""),
            username=os.getenv("REDDIT_USERNAME", ""),
            password=os.getenv("REDDIT_PASSWORD", ""),
            user_agent=os.getenv("REDDIT_USER_AGENT", "DiscordPromoBot/1.0"),
        )

    @property
    def is_configured(self) -> bool:
        return all([self.client_id, self.client_secret, self.username, self.password])


@dataclass
class TargetingConfig:
    keywords: list[str] = field(default_factory=list)
    min_engagement: int = 10
    max_posts_per_hour: int = 5

    @classmethod
    def from_env(cls) -> "TargetingConfig":
        keywords_raw = os.getenv("TARGET_KEYWORDS", "")
        keywords = [k.strip() for k in keywords_raw.split(",") if k.strip()]
        return cls(
            keywords=keywords,
            min_engagement=int(os.getenv("TARGET_MIN_ENGAGEMENT", "10")),
            max_posts_per_hour=int(os.getenv("TARGET_MAX_POSTS_PER_HOUR", "5")),
        )


@dataclass
class BotConfig:
    discord: DiscordConfig = field(default_factory=DiscordConfig)
    twitter: TwitterConfig = field(default_factory=TwitterConfig)
    reddit: RedditConfig = field(default_factory=RedditConfig)
    targeting: TargetingConfig = field(default_factory=TargetingConfig)

    @classmethod
    def from_env(cls) -> "BotConfig":
        return cls(
            discord=DiscordConfig.from_env(),
            twitter=TwitterConfig.from_env(),
            reddit=RedditConfig.from_env(),
            targeting=TargetingConfig.from_env(),
        )
