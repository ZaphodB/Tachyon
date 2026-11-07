#!/bin/sh

# Tachyon update checker
# Checks GitHub for a newer published release and emails an alert.
# Developed by GodfreyJH with community assistance.

# Configuration
TACHYON_DIR="/path/to/tachyon/v"
STATE_FILE="/path/to/tachyon-last-alert"
MAILTO="admin@example.com"

GITHUB_API="https://api.github.com/repos/kimusan/Tachyon/releases/latest"
USER_AGENT="Tachyon-Update-Checker"

# Compare numeric version components.
# Returns success if version 1 is greater than version 2.
version_is_newer()
{
    awk -v a="$1" -v b="$2" '
    BEGIN {
        na = split(a, av, ".")
        nb = split(b, bv, ".")
        n = (na > nb ? na : nb)

        for (i = 1; i <= n; i++) {
            x = (i <= na ? av[i] + 0 : 0)
            y = (i <= nb ? bv[i] + 0 : 0)

            if (x > y) exit 0
            if (x < y) exit 1
        }

        exit 1
    }'
}

# Find the highest installed version directory
INSTALLED_VERSION=$(
    for d in "$TACHYON_DIR"/*; do
        [ -d "$d" ] && basename "$d"
    done | awk '
        /^[0-9]+([.][0-9]+)*$/ {
            print
        }' | sort -V | tail -1
)

# Get the latest published GitHub release
RELEASE_JSON=$(
    curl -fsSL \
        -H 'Accept: application/vnd.github+json' \
        -H "User-Agent: $USER_AGENT" \
        "$GITHUB_API"
) || exit 1

LATEST_VERSION=$(
    printf '%s\n' "$RELEASE_JSON" |
        grep -o '"tag_name":[[:space:]]*"[^"]*"' |
        head -1 |
        cut -d'"' -f4
)

LATEST_VERSION=${LATEST_VERSION#v}
INSTALLED_VERSION=${INSTALLED_VERSION#v}

# Stop if either version could not be obtained
if [ -z "$INSTALLED_VERSION" ] || [ -z "$LATEST_VERSION" ]; then
    exit 1
fi

# Only alert when GitHub's release is newer
if ! version_is_newer "$LATEST_VERSION" "$INSTALLED_VERSION"; then
    exit 0
fi

# Do not repeat an alert for the same release
if [ -f "$STATE_FILE" ] &&
   [ "$(cat "$STATE_FILE")" = "$LATEST_VERSION" ]; then
    exit 0
fi

# Send notification
if mail -s "Tachyon update available: v$LATEST_VERSION" "$MAILTO" <<EOF
A Tachyon update is available.

Installed version : v$INSTALLED_VERSION
Latest version    : v$LATEST_VERSION

GitHub:
https://github.com/kimusan/Tachyon/releases/latest

This alert will not repeat for v$LATEST_VERSION.
EOF
then
    # Record the release only after the mail command succeeds
    printf '%s\n' "$LATEST_VERSION" > "$STATE_FILE" || exit 1
else
    exit 1
fi

exit 0

