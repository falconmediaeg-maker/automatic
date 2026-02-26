#!/bin/bash
# Usage: ./vote.sh <url> <proxy_url> <answer_key> <cookie_file>
# Returns: HTTP status code

URL="$1"
PROXY="$2"
ANSWER_KEY="$3"
COOKIE_FILE="$4"

PROXY_ARG=""
if [ -n "$PROXY" ]; then
  PROXY_ARG="-x $PROXY"
fi

UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# Step 1: Fetch page and get cookies + token
HTML=$(curl -s -L --max-time 25 $PROXY_ARG \
  -c "$COOKIE_FILE" \
  -H "User-Agent: $UA" \
  -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" \
  -H "Accept-Language: en-US,en;q=0.9,ar;q=0.8" \
  "$URL" 2>/dev/null)

if [ -z "$HTML" ]; then
  echo "0"
  exit 1
fi

TOKEN=$(echo "$HTML" | grep -oP '_token.*?value="\K[^"]+' | head -1)
POLL_ID=$(echo "$HTML" | grep -oP 'gidvnrj.*?value="\K\d+' | head -1)

if [ -z "$TOKEN" ] || [ -z "$POLL_ID" ]; then
  echo "0"
  exit 1
fi

ORIGIN=$(echo "$URL" | grep -oP 'https?://[^/]+')
VOTE_URL="${ORIGIN}/pvote"
ENCODED_KEY=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$ANSWER_KEY'))" 2>/dev/null || echo "$ANSWER_KEY" | sed 's/\[/%5B/g' | sed 's/\]/%5D/g')
SEX=$((RANDOM % 2 + 1))
AGE=$((RANDOM % 5 + 1))
FORM_DATA="gidvnrj=${POLL_ID}&sex=${SEX}&age=${AGE}&_token=${TOKEN}&${ENCODED_KEY}=1"

sleep 0.$((RANDOM % 9 + 1))

# Step 2: Submit vote
STATUS=$(curl -s --max-time 25 $PROXY_ARG \
  -b "$COOKIE_FILE" \
  -H "User-Agent: $UA" \
  -H "Referer: $URL" \
  -H "Origin: $ORIGIN" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "$FORM_DATA" \
  -o /dev/null -w "%{http_code}" \
  "$VOTE_URL" 2>/dev/null)

echo "${STATUS:-0}"
