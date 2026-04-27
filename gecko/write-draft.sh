#!/bin/bash
# Gecko calls this to write a draft back to the scout bot queue.
# Usage: ./write-draft.sh '<json>'
# JSON format: {"pendingId": 1, "opportunityId": 2, "platform": "reddit", "postUrl": "...", "postTitle": "...", "intentLabel": "seeking_tips", "draftText": "...", "alternateText": "..."}
# No direct SQL — uses the safe Node CLI with parameterised queries.
cd /opt/scout-bot && node dist/cli.js write-draft "$1"
