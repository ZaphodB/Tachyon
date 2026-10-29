<?php

// Run with: php test/crypt-cipher-fallback.php
// Covers #121. openssl_get_cipher_methods() lists ciphers the provider will not
// use: on OpenSSL 3 the shipped default aes-256-cbc-hmac-sha1 is one of them.
// Encrypt() then fell through to xxtea while Decrypt() refused xxtea because
// openssl_decrypt() exists, so a server stopped accepting its own tokens and
// nobody could log in.

function check(bool $condition, string $message): void
{
	if (!$condition) {
		throw new RuntimeException($message);
	}
}

$sSrc = file_get_contents(__DIR__.'/../tachyon/v/0.0.0/app/libraries/tachyon_util/crypt.php');

// A cipher that is listed but unusable must not be accepted.
$aListedButBroken = [];
foreach (openssl_get_cipher_methods() as $sCipher) {
	if ($sCipher !== strtolower($sCipher)) {
		continue;
	}
	$iLen = @openssl_cipher_iv_length($sCipher);
	if (!$iLen) {
		continue;
	}
	if (false === @openssl_encrypt('.', $sCipher, 'key', OPENSSL_RAW_DATA, str_repeat("\0", $iLen))) {
		$aListedButBroken[] = $sCipher;
	}
}

check(str_contains($sSrc, 'openssl_encrypt(\'.\', $cipher'),
	'cipherSupported() no longer tries the cipher, only the list');
check(str_contains($sSrc, 'openSSLUsable'),
	'the xxtea refusal no longer asks whether openssl can really be used');
check(!preg_match('/xxtea.*\n.*is_callable\(\'openssl_decrypt\'\)/', $sSrc),
	'the xxtea refusal is back to testing is_callable(openssl_decrypt)');

// Whatever this build offers, at least one CBC cipher has to work, or the
// fallback in setCipher() has nothing to fall back to.
$bUsable = false;
foreach (['aes-256-cbc', 'aes-192-cbc', 'aes-128-cbc'] as $sCipher) {
	$iLen = (int) @openssl_cipher_iv_length($sCipher);
	if ($iLen && false !== @openssl_encrypt('.', $sCipher, 'key', OPENSSL_RAW_DATA, str_repeat("\0", $iLen))) {
		$bUsable = true;
		break;
	}
}
check($bUsable, 'no CBC cipher works on this build, so the fallback cannot help');

printf("crypt-cipher-fallback: ok (%d listed-but-broken cipher%s on this build: %s)\n",
	count($aListedButBroken),
	1 === count($aListedButBroken) ? '' : 's',
	implode(', ', array_slice($aListedButBroken, 0, 4)) ?: 'none');
