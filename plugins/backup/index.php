<?php

class BackupPlugin extends \Tachyon\Plugins\AbstractPlugin
{
	const
		NAME     = 'Backup',
		AUTHOR   = 'Tachyon',
		URL      = 'https://github.com/kimusan/Tachyon',
		VERSION  = '1.4',
		RELEASE  = '2026-10-09',
		REQUIRED = '2.30.0',
		CATEGORY = 'General',
		LICENSE  = 'MIT',
		DESCRIPTION = '';

	public function Init() : void
	{
		// Admin Settings tab
		$this->addJs('js/BackupAdminSettings.js', true); // add js file
		$this->addJsonHook('JsonAdminRestoreData');
		$this->addTemplate('templates/BackupAdminSettingsTab.html', true);
	}

	/**
	 * What DoAdminBackup() writes, and so the only thing a restore may contain.
	 */
	private const RESTORE_DIRS = ['configs/', 'domains/', 'plugins/', 'storage/'];
	private const RESTORE_FILES = ['AddressBook.sqlite'];

	public function JsonAdminRestoreData()
	{
		$oActions = $this->Manager()->Actions();
		if (!($oActions instanceof \Tachyon\ActionsAdmin)) {
			return $this->jsonResponse(__FUNCTION__, false);
		}

		// Nothing here asked who was calling. Reaching the admin panel was the
		// only gate, and anyone who can load it satisfies that; the core rule
		// that demands a login for Admin* actions never fires either, because a
		// plugin action is dispatched as PluginJsonAdminRestoreData and the test
		// is on the name starting with Admin. Reported by Fathi Ben Nasr
		// (GHSA-5r45-3mqm-hcvg). Throws when there is no admin session.
		$oActions->IsAdminLoggined();

		// The Content-Type of an upload is whatever the client typed, so it was
		// never a check. Whether this is a zip is settled by opening it.
		if (empty($_FILES['backup']) || !\is_uploaded_file($_FILES['backup']['tmp_name'])) {
			return $this->jsonResponse(__FUNCTION__, false);
		}

		$result = false;
		if (\class_exists('ZipArchive')) {
			$oArchive = new \ZipArchive();
			// open() returns true, and ZipArchive::ER_OK is 0, so the comparison
			// here was never true and no archive has ever been extracted. Fixing
			// that alone, without the login check above, would have turned a dead
			// bug into an anonymous write into the data directory.
			if (true === $oArchive->open($_FILES['backup']['tmp_name'])) {
				$aEntries = static::restorableEntries($oArchive);
				$result = null !== $aEntries
					&& (!$aEntries || $oArchive->extractTo(APP_PRIVATE_DATA, $aEntries));
				$oArchive->close();
			}
		}

		return $this->jsonResponse(__FUNCTION__, $result);
	}

	/**
	 * The entries to extract, or null when the archive holds anything a backup
	 * would not. extractTo() is given the list rather than the whole archive,
	 * and one bad entry refuses the lot: a restore that half happened is worse
	 * than one that did not.
	 */
	private static function restorableEntries(\ZipArchive $oArchive) : ?array
	{
		$aNames = [];
		for ($i = 0; $i < $oArchive->numFiles; ++$i) {
			$sName = (string) $oArchive->getNameIndex($i);
			$sPath = \str_replace('\\', '/', $sName);
			if ('' === $sPath
			 || \str_starts_with($sPath, '/')
			 || \preg_match('#^[A-Za-z]:#', $sPath)
			 || \preg_match('#(^|/)\.\.(/|$)#', $sPath)
			) {
				return null;
			}
			if (\str_ends_with($sPath, '/')) {
				continue;
			}
			$bAllowed = \in_array($sPath, self::RESTORE_FILES, true);
			foreach (self::RESTORE_DIRS as $sDir) {
				$bAllowed = $bAllowed || \str_starts_with($sPath, $sDir);
			}
			if (!$bAllowed) {
				return null;
			}
			$aNames[] = $sName;
		}
		return $aNames;
	}

}
