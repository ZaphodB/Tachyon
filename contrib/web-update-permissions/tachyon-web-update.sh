#!/bin/sh
#
# Tachyon Web Update Permission Helper
#
# Temporarily enables write permissions for the Tachyon
# web updater and restores the configured secure permissions
# when the administrator confirms the update is complete.
#
# Developed by GodfreyJH with community assistance.
# Written for FreeBSD; may be adapted for other systems.
#

# --------------------------------------------------
# Configuration
# --------------------------------------------------

# Full path to Tachyon's web entry point
INDEX="/path/to/tachyon/public_html/index.php"

# Full path to the Tachyon version directory
TACHYON_V="/path/to/tachyon/public_html/tachyon/v"

# Temporary update ownership
WEB_USER="www"
WEB_GROUP="hosted"
INDEX_GROUP="wheel"

# Secure ownership after the update
SECURE_INDEX_USER="root"
SECURE_INDEX_GROUP="wheel"
SECURE_TACHYON_USER="root"
SECURE_TACHYON_GROUP="hosted"

# --------------------------------------------------
# Main
# --------------------------------------------------

if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: This script must be run as root."
    exit 1
fi

if [ ! -f "$INDEX" ]; then
    echo "ERROR: index.php not found: $INDEX"
    exit 1
fi

if [ ! -d "$TACHYON_V" ]; then
    echo "ERROR: Tachyon version directory not found: $TACHYON_V"
    exit 1
fi

echo
echo "=============================================="
echo "       TACHYON WEB UPDATE PERMISSIONS"
echo "=============================================="
echo
echo "Enabling temporary write permissions..."
echo

if ! chown "$WEB_USER:$INDEX_GROUP" "$INDEX" ||
   ! chmod 664 "$INDEX" ||
   ! chown -R "$WEB_USER:$WEB_GROUP" "$TACHYON_V" ||
   ! chmod -R u+rwX,g+rwX "$TACHYON_V"; then
    echo "ERROR: One or more permission changes failed."
    echo "Check the installation and permissions manually."
    exit 1
fi

echo
echo "Tachyon update permissions are now ENABLED."
echo
echo "You may now perform the Tachyon update from the web panel."
echo
echo "When the update is completely finished,"
echo "return here and press Y followed by ENTER."
echo
printf "Continue when finished? [y/N]: "
IFS= read -r answer

case "$answer" in
    y|Y)
        echo
        echo "Restoring secure permissions..."
        echo

        if ! chown "$SECURE_INDEX_USER:$SECURE_INDEX_GROUP" "$INDEX" ||
           ! chmod 644 "$INDEX" ||
           ! chown -R "$SECURE_TACHYON_USER:$SECURE_TACHYON_GROUP" "$TACHYON_V" ||
           ! chmod -R u+rwX,go+rX,go-w "$TACHYON_V"; then
            echo "ERROR: Permission restoration failed."
            echo "Check the installation and permissions manually."
            exit 1
        fi

        echo "Permissions restored."
        echo
        ls -ld "$INDEX" "$TACHYON_V"
        echo
        ;;
    *)
        echo
        echo "No 'Y' entered."
        echo "Permissions have NOT been restored."
        echo "DO NOT leave this unattended."
        echo
        exit 1
        ;;
esac

exit 0
