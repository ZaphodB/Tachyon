# Tachyon Web Update Permission Helper

## Purpose

This small shell script helps system administrators temporarily enable the file permissions required for Tachyon's web-based updater, then restore a defined set of secure permissions after the update has completed.

It was developed for administrators who prefer to keep their web-facing installation files under tighter ownership and permission controls between updates.

The script was written for FreeBSD. Administrators using other systems may be able to adapt it to their environment.

## Who might find it useful?

This utility is intended for security-conscious system administrators managing self-hosted Tachyon installations. It may be particularly useful where the administrator does not want the web server account to retain write access to Tachyon's version files during normal operation.

It can be run independently or incorporated into an existing server administration menu.

## Configuration

Edit the configuration section at the top of `tachyon-web-update.sh` before use.

Set the paths to:

- Tachyon's `index.php` entry point.
- Tachyon's version directory, usually `tachyon/v`.

Review the temporary and secure ownership settings carefully. The example values use common FreeBSD account and group names, but these may differ on your installation.

Do not run the script with the example paths unchanged.

## Usage

1. Review and configure the script for your installation.
2. Ensure the script is executable:

   ```sh
   chmod 755 tachyon-web-update.sh
   ```

3. Run it as `root`.
4. Confirm that you want to enable temporary update permissions.
5. Perform the Tachyon update from the web panel.
6. Return to the terminal after the update has completely finished.
7. Enter `Y` when prompted to restore the configured secure permissions.
8. Review the displayed ownership and permissions.

If you do not confirm completion, the script deliberately leaves the temporary permissions in place and displays a warning. Do not leave the installation unattended in this state. Restore the intended secure permissions manually if necessary.

## Security considerations

The script changes file ownership and permissions recursively within the configured Tachyon version directory. Incorrect paths or unsuitable ownership settings can affect an installation.

Before using it:

- Check every configured path.
- Confirm that the web server account and groups are correct.
- Review the intended secure ownership and permissions.
- Keep a suitable backup and ensure you can administer the server if manual recovery is needed.

The script cannot guarantee automatic restoration if the process is interrupted, the machine loses power, or the administrator's session ends unexpectedly. Administrators remain responsible for checking the resulting permissions.

This utility is a small administrative convenience, not a substitute for a broader server security policy.

## Author

Developed by GodfreyJH with community assistance.
