#!/bin/bash
# Gecko calls this to post drafts through the safety-gated poster.
# Usage:
#   ./post-drafts.sh --top 3     # Post top 3 pending drafts (by score)
#   ./post-drafts.sh 42          # Post specific draft ID 42
#   ./post-drafts.sh list        # List pending drafts as JSON
#
# All posts go through safety rails. If a limit is hit, posting stops.
# Returns JSON with results for each attempted post.
cd /opt/scout-bot && node dist/cli.js post "$@"
