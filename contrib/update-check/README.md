# Tachyon Update Checker

A small shell script for system administrators who want to know when a newer published release of Tachyon Webmail is available.

The script checks the latest published release on GitHub and emails a notification if it is newer than the highest installed version directory.

It does not install or modify Tachyon. Updates remain under the administrator's control.

## Requirements

The system must provide:

- `sh`
- `awk`
- `curl`
- `grep`
- `head`
- `cut`
- `mail`
- `sort`

The script uses `sort -V` to identify the highest installed version directory. This option is available on common Linux distributions and some other Unix-like systems, but may not be available on every platform.

## Configuration

Edit `check-tachyon-update.sh` and change these settings to match your installation:

```sh
TACHYON_DIR="/path/to/tachyon/v"
STATE_FILE="/path/to/tachyon-last-alert"
MAILTO="admin@example.com"
```

- `TACHYON_DIR`: directory containing the installed version directories, such as `4.4.4`.
- `STATE_FILE`: file used to remember which release has already triggered an alert. The script needs permission to write this file.
- `MAILTO`: email address that should receive update notifications.

The configured paths and email address are examples and must be replaced before use.

## Installation

1. Copy `check-tachyon-update.sh` to a suitable location on your server.
2. Edit the configuration values.
3. Ensure the script is executable:

   ```sh
   chmod 755 check-tachyon-update.sh
   ```

4. Run it manually to check that the configuration and email delivery work.
5. If desired, schedule it using cron.

## Behaviour

- Checks the latest published GitHub release.
- Compares it with the highest installed version directory.
- Sends an email when a newer release is available.
- Records the release after the mail command succeeds, preventing repeated alerts for the same release.
- Exits without sending an alert when the installed version is current or newer.

The script relies on the version directories using numeric components, such as `4.4.4`.

## Limitations

- This is a release-monitoring utility, not an automatic updater.
- It does not download, install or upgrade Tachyon.
- It assumes the server's `mail` command reports success when the message is accepted for sending; this does not guarantee final delivery.
- Review the script and test it in your own environment before relying on scheduled notifications.

## Author

Developed by GodfreyJH with community assistance.
