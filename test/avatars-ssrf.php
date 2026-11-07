<?php

// Run with: php test/avatars-ssrf.php
// Covers GHSA-2r3w-3qmp-ppf2: the avatars plugin answered without a session and
// fetched a caller-chosen URL with the SSRF gate switched off.

function check(bool $condition, string $message): void
{
	if (!$condition) {
		throw new RuntimeException($message);
	}
}

// Comments are dropped before anything below indexes the source. Every check
// here is about the order code runs in, and strpos() cannot tell a call from
// prose: a comment above the account check that merely names getAvatar() was
// enough to report the guard as coming last. Each comment leaves its newlines
// behind so the function-body regex still sees the same line structure.
function code_only(string $sSource): string
{
	$sOut = '';
	foreach (token_get_all($sSource) as $mToken) {
		if (!\is_array($mToken)) {
			$sOut .= $mToken;
		} else if (\in_array($mToken[0], [T_COMMENT, T_DOC_COMMENT], true)) {
			$sOut .= str_repeat("\n", substr_count($mToken[1], "\n"));
		} else {
			$sOut .= $mToken[1];
		}
	}
	return $sOut;
}

$src = code_only(file_get_contents(dirname(__DIR__).'/plugins/avatars/index.php'));

// ServiceAvatar and DoAvatar must each refuse without an account, before they
// reach getAvatar() and therefore before any lookup or fetch happens.
foreach (['ServiceAvatar', 'DoAvatar'] as $sEntry) {
	preg_match('/function '.$sEntry.'\s*\([^)]*\)[^{]*\{(.*?)\n\t\}/s', $src, $m);
	check(!empty($m[1]), "{$sEntry}: could not read the function body");
	$iGuard = strpos($m[1], 'getAccountFromToken(false)');
	$iUse   = strpos($m[1], 'getAvatar(');
	check(false !== $iGuard, "{$sEntry}: no account check");
	check(false !== $iUse, "{$sEntry}: getAvatar call not found");
	check($iGuard < $iUse, "{$sEntry}: account is checked after the lookup, not before");
}

// getUrl is the one place that fetches, and it must ask for the SSRF gate.
preg_match('/function getUrl\s*\([^)]*\)[^{]*\{(.*?)\n\t\}/s', $src, $m);
check(!empty($m[1]), 'getUrl: could not read the function body');
$body = $m[1];
check(str_contains($body, 'block_private_ips = true'), 'getUrl: SSRF gate not enabled');
check(preg_match('/block_private_ips\s*=\s*true/', $body)
	&& strpos($body, 'block_private_ips') < strpos($body, 'doRequest'),
	'getUrl: gate set after the request');
check(str_contains($body, "'https://'"), 'getUrl: no scheme restriction');
check(strpos($body, "'https://'") < strpos($body, 'doRequest'),
	'getUrl: scheme checked after the request');

// The selector reaches dns_get_record() and a cache key.
preg_match('/function ServiceAvatar\s*\([^)]*\)[^{]*\{(.*?)\n\t\}/s', $src, $m);
check(preg_match('/preg_match\([^)]*A-Za-z0-9/', $m[1]) === 1,
	'ServiceAvatar: BIMI selector is not validated');

// And the selector pattern itself must reject what matters.
$sPattern = '/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/D';
foreach (['default', 'v1', 'a-b'] as $ok) {
	check(1 === preg_match($sPattern, $ok), "selector '{$ok}' wrongly rejected");
}
foreach (['a.b', '../x', 'a b', '', 'x;y', "a\nb", str_repeat('a', 64)] as $bad) {
	check(0 === preg_match($sPattern, $bad), "selector '{$bad}' wrongly accepted");
}

echo "avatars-ssrf: ok\n";
