#!/usr/bin/env bash
# Does this URL serve this commit yet?
#
# Polls `<url>/api/health` until the `commit` field equals the expected SHA, or
# the deadline expires. Called by `.github/workflows/deploy-check.yml`, once per
# deployed service.
#
# Usage: scripts/probe-deploy.sh <url> <expected-sha> <timeout-seconds> [label]
#
# Exit 0 on a match, 1 on the deadline. A URL that answers nothing and a URL
# that answers an earlier commit are the same failure with different advice —
# both are reported, because "no response" and "not redeployed" send whoever
# reads the summary to different places.
#
# `x-vercel-protection-bypass` is sent when VERCEL_BYPASS_TOKEN is in the
# environment: Vercel's deployment protection answers 401 to an unauthenticated
# probe, and a 401 is indistinguishable here from a service that is not up.
set -uo pipefail

url_base="${1:?usage: probe-deploy.sh <url> <expected-sha> <timeout> [label]}"
expected="${2:?missing expected sha}"
timeout="${3:?missing timeout}"
label="${4:-deployment}"

url="${url_base%/}/api/health"
deadline=$(( $(date +%s) + timeout ))
attempt=0
served=""
version=""

summary() { cat >> "${GITHUB_STEP_SUMMARY:-/dev/null}"; }

echo "Expected commit : ${expected:0:7}"
echo "Probe           : $url"

curl_args=(-fsS --max-time 20)
if [ -n "${VERCEL_BYPASS_TOKEN:-}" ]; then
  curl_args+=(-H "x-vercel-protection-bypass: $VERCEL_BYPASS_TOKEN")
fi

# `python3 -c` rather than `jq`: the runner has both, and the Python one is what
# the workflow already used — a rewrite is not a place to also change tooling.
field() {
  printf '%s' "$1" | python3 -c \
    "import json,sys; print(json.load(sys.stdin).get('$2',''))" 2>/dev/null || true
}

while [ "$(date +%s)" -lt "$deadline" ]; do
  attempt=$((attempt + 1))
  body=$(curl "${curl_args[@]}" "$url" 2>/dev/null || true)

  if [ -n "$body" ]; then
    served=$(field "$body" commit)
    version=$(field "$body" version)
    echo "attempt $attempt — version=$version commit=${served:0:7}"

    if [ "$served" = "$expected" ]; then
      summary <<EOF
### ✅ $label up to date

| | |
|---|---|
| Served version | \`$version\` |
| Served commit | \`${served:0:7}\` |
| URL | $url_base |
EOF
      exit 0
    fi
  else
    echo "attempt $attempt — no response (deploy in progress?)"
  fi
  sleep 15
done

{
  echo "### ⚠️ $label does not serve this commit yet"
  echo
  echo "| | |"
  echo "|---|---|"
  echo "| Expected commit | \`${expected:0:7}\` |"
  echo "| Served commit | \`${served:0:7}\` |"
  echo "| Timeout | ${timeout}s |"
  echo
  if [ -z "$served" ]; then
    echo "No response from the probe: service asleep (free plan), deploy still"
    echo "in progress, protection answering 401, or an incorrect URL."
  else
    echo "The service responds, but with an earlier version:"
    echo "automatic deploys may be disabled."
  fi
} | summary
exit 1
