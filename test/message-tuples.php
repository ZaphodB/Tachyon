<?php

// Run with: php test/message-tuples.php
//
// The contract MessageListByTuples() documents for plugin authors (#140): what
// it accepts, what it refuses, and that the caller's order survives. Only the
// pure part is covered here; the fetch itself needs a server.
spl_autoload_register(static function (string $class): void {
	$file = dirname(__DIR__).'/tachyon/v/0.0.0/app/libraries/'.str_replace('\\', '/', $class).'.php';
	if (is_file($file)) {
		require_once $file;
	}
});

function check(bool $condition, string $message): void
{
	if (!$condition) {
		throw new RuntimeException($message);
	}
}

$normalize = (new ReflectionMethod(\MailSo\Mail\MailClient::class, 'normalizeMessageTuples'));
$normalize->setAccessible(true);
$call = fn(array $aTuples) => array_values($normalize->invoke(null, $aTuples));

// Order is the caller's, across folders, not grouped by folder.
check($call([['INBOX', 3], ['Sent', 9], ['INBOX', 1]])
	=== [['INBOX', 3], ['Sent', 9], ['INBOX', 1]], 'Interleaved order is kept');

// A repeat is fetched once and keeps its first position.
check($call([['INBOX', 1], ['Sent', 2], ['INBOX', 1]])
	=== [['INBOX', 1], ['Sent', 2]], 'Duplicate pair collapses to its first position');

// Uids are forced to integers in the entry point, not left to the caller.
check($call([['INBOX', '7']]) === [['INBOX', 7]], 'Uid is cast to int');
check($call([['INBOX', '7 UID FETCH 1 BODY[]']]) === [['INBOX', 7]], 'Uid casting strips anything trailing');

// Nothing addressable is dropped silently, but unusable pairs are.
check($call([['INBOX', 0], ['INBOX', -1], ['', 5], ['INBOX', 2]]) === [['INBOX', 2]],
	'Zero, negative and empty-folder pairs are dropped');

// A folder name is refused rather than cleaned, so no command can be smuggled.
foreach (["INBOX\r\nX", "INBOX\nX", "INBOX\x00X", "INBOX\rX"] as $sFolderName) {
	$bThrew = false;
	try {
		$call([[$sFolderName, 1]]);
	} catch (\ValueError $e) {
		$bThrew = true;
	}
	check($bThrew, 'Folder name '.json_encode($sFolderName).' must be refused');
}

// A malformed pair is an error, not something to guess at.
foreach ([[['INBOX']], [['INBOX', 1, 'extra-is-fine']], ['INBOX'], [[]]] as $i => $aTuples) {
	$bThrew = false;
	try {
		$call($aTuples);
	} catch (\ValueError $e) {
		$bThrew = true;
	}
	check($bThrew === (1 !== $i), 'Pair shape '.json_encode($aTuples).' handled');
}

check(1000 === \MailSo\Mail\MailClient::MESSAGE_TUPLES_LIMIT, 'The documented ceiling is 1000');

echo "Message tuple contract checks passed.\n";
