#!/bin/bash
# Gecko runs this to get pending AI items from the scout bot queue.
# Returns JSON array. No direct SQL — uses the safe Node CLI.
cd /opt/scout-bot && node dist/cli.js pending-ai
