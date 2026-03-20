"""
Promotional message templates that rotate to avoid repetition.
Customize these to match your server's brand and voice.
"""

import random

# Discord embed messages (posted in Discord channels/threads)
DISCORD_PROMOS = [
    "Hey everyone! If you're into {keywords}, come check out **{server_name}** — "
    "we've got an active community and tons of great conversations happening.\n"
    "{invite_link}",

    "Looking for a chill place to talk about {keywords}? "
    "**{server_name}** is the spot. Join us!\n{invite_link}",

    "We just hit some awesome milestones over at **{server_name}**! "
    "If {keywords} is your thing, come be part of the community.\n{invite_link}",

    "Shoutout to anyone looking for a solid {keywords} community — "
    "**{server_name}** is growing fast. Come hang out with us!\n{invite_link}",
]

# Twitter/X posts
TWITTER_PROMOS = [
    "If you're into {keywords}, come join our Discord community — {server_name}! "
    "{description}\n\nJoin here: {invite_link}",

    "Looking for a {keywords} community? {server_name} on Discord is the place to be. "
    "{description}\n\n{invite_link}",

    "Join {server_name} on Discord! We talk about {keywords} and more. "
    "Great community, great vibes.\n{invite_link}",
]

# Twitter/X reply templates (for replying to relevant conversations)
TWITTER_REPLIES = [
    "If you're interested in this, you might enjoy our Discord community — "
    "{server_name}. We discuss {keywords} all the time!\n{invite_link}",

    "Great thread! We have similar conversations in our Discord — {server_name}. "
    "Come join us: {invite_link}",
]

# Reddit comment templates (conversational, not spammy)
REDDIT_COMMENTS = [
    "Great discussion! If anyone here wants to keep talking about this, "
    "we have an active community on Discord — **{server_name}**. "
    "{description}\n\nHere's the invite: {invite_link}",

    "This is a really interesting thread. We discuss {keywords} a lot "
    "in our Discord server (**{server_name}**) if anyone wants to "
    "continue the conversation there.\n\nLink: {invite_link}",

    "For anyone looking for more {keywords} content and discussion, "
    "check out **{server_name}** on Discord. {description}\n\n{invite_link}",
]


def get_random_message(templates: list[str], server_name: str, invite_link: str,
                        keywords: str, description: str = "") -> str:
    """Pick a random template and fill in the placeholders."""
    template = random.choice(templates)
    return template.format(
        server_name=server_name,
        invite_link=invite_link,
        keywords=keywords,
        description=description,
    )
