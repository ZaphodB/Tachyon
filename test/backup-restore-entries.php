<?php

// Run with: php test/backup-restore-entries.php
// Covers GHSA-5r45-3mqm-hcvg. The restore endpoint took no account of who was
// calling and extracted a whole archive wherever its entries pointed.

function check(bool $condition, string $message): void
{
	if (!$condition) {
		throw new RuntimeException($message);
	}
}

$sSrc = file_get_contents(__DIR__.'/../plugins/backup/index.php');

// The login check has to come before anything touches the upload.
$iAuth = strpos($sSrc, 'IsAdminLoggined()');
$iFiles = strpos($sSrc, "\$_FILES['backup']");
check(false !== $iAuth, 'JsonAdminRestoreData does not check for an admin session');
check($iAuth < $iFiles, 'the admin session is checked after the upload is used');
check(!str_contains($sSrc, "'application/zip' !== "),
	'the client-set Content-Type is being used as a check again');
check(!str_contains($sSrc, 'ZipArchive::ER_OK ==='),
	'open() is compared against ER_OK again, which is never true');
check(!preg_match('/extractTo\(APP_PRIVATE_DATA\)\s*;/', $sSrc),
	'the whole archive is extracted again, without an entry list');

// Exercise the entry filter itself.
if (!class_exists('ZipArchive')) {
	echo "backup-restore-entries: skipped, no zip extension\n";
	exit;
}
// The plugin extends a class the app loads for it, so stand one up rather
// than boot the application to reach a static helper.
if (!class_exists('Tachyon\\Plugins\\AbstractPlugin')) {
	eval('namespace Tachyon\\Plugins; abstract class AbstractPlugin {}');
}
require_once __DIR__.'/../plugins/backup/index.php';
$oMethod = new ReflectionMethod('BackupPlugin', 'restorableEntries');
$oMethod->setAccessible(true);

$sTmp = tempnam(sys_get_temp_dir(), 'bk');
$fBuild = function (array $aEntries) use ($sTmp) {
	@unlink($sTmp);
	$o = new ZipArchive();
	$o->open($sTmp, ZipArchive::CREATE | ZipArchive::OVERWRITE);
	foreach ($aEntries as $s) {
		$o->addFromString($s, 'x');
	}
	$o->close();
	$r = new ZipArchive();
	$r->open($sTmp);
	return $r;
};

$aGood = ['configs/application.ini', 'domains/example.com.json', 'storage/x/y.json',
	'plugins/avatars/index.php', 'AddressBook.sqlite'];
$aEntries = $oMethod->invoke(null, $fBuild($aGood));
check(null !== $aEntries, 'a genuine backup is refused');
check(count($aEntries) === count($aGood), 'a genuine backup loses entries: '.count($aEntries));

foreach ([
	['../../index.php'            => 'a parent traversal'],
	['configs/../../../etc/passwd'=> 'a traversal through an allowed directory'],
	['/etc/passwd'                => 'an absolute path'],
	['C:/windows/x.ini'           => 'a drive-letter path'],
	['..'                         => 'a bare parent'],
	['index.php'                  => 'a file outside any backup directory'],
	['data/evil.php'              => 'an unknown top-level directory'],
] as $aCase) {
	foreach ($aCase as $sEntry => $sWhat) {
		check(null === $oMethod->invoke(null, $fBuild([$sEntry])), "{$sWhat} is accepted: {$sEntry}");
		// and one bad entry must refuse the whole archive, not just itself
		check(null === $oMethod->invoke(null, $fBuild(['configs/ok.ini', $sEntry])),
			"{$sWhat} only removes itself instead of refusing the restore");
	}
}
@unlink($sTmp);

echo "backup-restore-entries: ok\n";
