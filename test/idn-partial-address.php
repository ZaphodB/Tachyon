<?php

// Run with: php test/idn-partial-address.php
// Covers #122. A draft holds whatever was typed, so an address can have an
// empty domain. PHP 8.4 throws a ValueError from idn_to_utf8('') and earlier
// versions return false, which concatenated into an address with its domain
// quietly removed. Serialising a message list then failed outright, and
// opening Drafts reported "unknown error".

require __DIR__.'/../tachyon/v/0.0.0/app/libraries/tachyon_util/idn.php';

function check(bool $condition, string $message): void
{
	if (!$condition) {
		throw new RuntimeException($message);
	}
}

$aCases = [
	// address                     toAscii                 toUtf8
	['user@',                      'user@',                'user@'],
	['',                           '',                     ''],
	['user',                       'user',                 'user'],
	['@example.com',               '@example.com',         '@example.com'],
	['user@example.com',           'user@example.com',     'user@example.com'],
	['user@EXAMPLE.com',           'user@example.com',     'user@example.com'], // idn normalises case both ways
	['first.last@sub.example.org', 'first.last@sub.example.org', 'first.last@sub.example.org'],
	// a domain the converter will not take: keep it rather than empty it
	['user@'.str_repeat('a', 300), 'user@'.str_repeat('a', 300), 'user@'.str_repeat('a', 300)],
];

foreach ($aCases as [$sIn, $sAscii, $sUtf8]) {
	$sLabel = '' === $sIn ? "''" : $sIn;
	try {
		$sGot = \Tachyon\Util\IDN::emailToAscii($sIn);
	} catch (\Throwable $e) {
		throw new RuntimeException("emailToAscii({$sLabel}) threw ".get_class($e).': '.$e->getMessage());
	}
	check($sAscii === $sGot, "emailToAscii({$sLabel}): expected '{$sAscii}', got '{$sGot}'");

	try {
		$sGot = \Tachyon\Util\IDN::emailToUtf8($sIn);
	} catch (\Throwable $e) {
		throw new RuntimeException("emailToUtf8({$sLabel}) threw ".get_class($e).': '.$e->getMessage());
	}
	check($sUtf8 === $sGot, "emailToUtf8({$sLabel}): expected '{$sUtf8}', got '{$sGot}'");
}

// A real IDN still converts both ways.
check('u@xn--4ca.example' === \Tachyon\Util\IDN::emailToAscii('u@ä.example'),
	'an internationalised domain no longer converts to ascii: '.\Tachyon\Util\IDN::emailToAscii('u@ä.example'));

echo "idn-partial-address: ok\n";
