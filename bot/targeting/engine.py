"""
Targeting engine that discovers high-engagement, relevant communities and threads
across Discord, Twitter/X, and Reddit for promotional outreach.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


@dataclass
class TargetCandidate:
    """Represents a discovered target for promotion."""

    platform: str  # "discord", "twitter", "reddit"
    identifier: str  # channel ID, tweet ID, subreddit+thread ID
    title: str
    engagement_score: float  # normalized 0-1
    relevance_score: float  # normalized 0-1
    combined_score: float = 0.0
    metadata: dict = field(default_factory=dict)
    discovered_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self):
        self.combined_score = (self.engagement_score * 0.4) + (self.relevance_score * 0.6)


class TargetingEngine:
    """
    Core targeting engine that scores and ranks potential promotion targets
    across all platforms based on engagement and keyword relevance.
    """

    def __init__(self, keywords: list[str], min_engagement: int = 10):
        self.keywords = [kw.lower() for kw in keywords]
        self.min_engagement = min_engagement
        self._posted_targets: set[str] = set()

    def score_relevance(self, text: str) -> float:
        """Score how relevant a piece of text is based on keyword matches."""
        if not self.keywords or not text:
            return 0.0
        text_lower = text.lower()
        matches = sum(1 for kw in self.keywords if kw in text_lower)
        return min(matches / max(len(self.keywords), 1), 1.0)

    def score_engagement(self, metrics: dict) -> float:
        """
        Score engagement from platform-specific metrics.

        Expects a dict with raw counts. Supported keys:
        - comments, upvotes, likes, retweets, replies, members, active_members
        """
        total = 0
        weights = {
            "comments": 3.0,
            "replies": 3.0,
            "upvotes": 1.0,
            "likes": 1.0,
            "retweets": 2.0,
            "members": 0.1,
            "active_members": 2.0,
        }
        for key, weight in weights.items():
            total += metrics.get(key, 0) * weight

        if total < self.min_engagement:
            return 0.0

        # Normalize with diminishing returns (log scale)
        import math
        return min(math.log(total + 1) / math.log(1000), 1.0)

    def evaluate(self, platform: str, identifier: str, title: str,
                 text: str, metrics: dict, metadata: dict | None = None) -> TargetCandidate | None:
        """
        Evaluate a potential target and return a TargetCandidate if it meets thresholds.
        Returns None if the target doesn't meet minimum engagement or was already posted to.
        """
        cache_key = f"{platform}:{identifier}"
        if cache_key in self._posted_targets:
            return None

        relevance = self.score_relevance(text)
        engagement = self.score_engagement(metrics)

        if engagement == 0.0:
            return None

        candidate = TargetCandidate(
            platform=platform,
            identifier=identifier,
            title=title,
            engagement_score=engagement,
            relevance_score=relevance,
            metadata=metadata or {},
        )

        return candidate

    def rank_candidates(self, candidates: list[TargetCandidate],
                        limit: int = 10) -> list[TargetCandidate]:
        """Rank candidates by combined score, return top N."""
        ranked = sorted(candidates, key=lambda c: c.combined_score, reverse=True)
        return ranked[:limit]

    def mark_posted(self, platform: str, identifier: str):
        """Mark a target as already posted to, so we don't double-post."""
        self._posted_targets.add(f"{platform}:{identifier}")

    def reset_posted(self):
        """Clear the posted-targets cache (e.g., on a daily basis)."""
        self._posted_targets.clear()
