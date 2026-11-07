'use strict';
// Run with: node --test test/mailbox-hash-route.test.js
//
// #153: clicking a message filled the search box and opened nothing, on any
// folder whose name is not already URL safe. mailBox() was given the folder's
// full name instead of its fullNameHash, and a full name may hold the hierarchy
// delimiter, spaces, anything. The route then read the tail of the path as page
// and search. INBOX hashes to itself, which is why it hid.
//
// The regexes are read out of the sources rather than copied, so that changing
// the character class on either side without the other fails here.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

// The first regex literal on the line holding the needle. Needles are chosen to
// sit on the same line as their regex and to carry no slashes of their own, so
// that a comment cannot be mistaken for the pattern.
function extract(file, needle, label) {
	const line = read(file).split('\n').find(l => l.includes(needle));
	assert.ok(line, `${label}: no line with ${JSON.stringify(needle)} in ${file}`);
	const m = line.match(/\/((?:[^\/\\]|\\.)+)\/([gimsuy]*)/);
	assert.ok(m, `${label}: no regex literal on that line in ${file}`);
	return new RegExp(m[1], m[2]);
}

// get fullNameHash() { return this.fullName.replace(/[^a-z0-9._-]+/giu, ...); }
const unsafeRe = extract('dev/Model/FolderCollection.js', 'this.fullName.replace(', 'fullNameHash');

// The {folder}/m{uid} route, found by its uid group rather than its folder class,
// which is the thing under test.
const messageRoute = extract('dev/Screen/User/MailBox.js', '\\/m([1-9]', 'message route');

// dev/Common/Utils.js: b64EncodeJSONSafe
const b64EncodeJSONSafe = data =>
	Buffer.from(JSON.stringify(data), 'utf8').toString('base64')
		.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fullNameHash = fullName => fullName.replace(unsafeRe, b64EncodeJSONSafe);

// mailBox(folder, page, search, threadUid, messageUid), the message case, with
// the '#/mailbox/' prefix the router has already consumed by the time it routes.
const routedPath = (folderPart, uid) => `${folderPart}/m${uid}`;

const folderNames = [
	'INBOX',
	'Sent',
	'INBOX.sub',                       // Dovecot's default delimiter is already safe
	'00_0 INBOX ✉/00_appzwang.de/ml', // from the report
	'Lists/dev.list',                  // Mailcow and friends use / and it is not safe
	'Arbeit & Co',
	'Überweisungen',
	'faktury/2026',
];

test('a hashed folder name is one route-safe path segment', () => {
	for (const name of folderNames) {
		const hash = fullNameHash(name);
		assert.match(hash, /^[a-zA-Z0-9.~_-]+$/, `${JSON.stringify(name)} hashed to ${JSON.stringify(hash)}`);
		assert.ok(!hash.includes('/'), `${JSON.stringify(name)} hashed to something with a path separator`);
	}
});

test('a message link built from the hash routes back to folder and uid', () => {
	for (const name of folderNames) {
		const hash = fullNameHash(name);
		const m = routedPath(hash, 4211).match(messageRoute);
		assert.ok(m, `no route matched for ${JSON.stringify(name)} as ${JSON.stringify(hash)}`);
		assert.strictEqual(m[1], hash, `wrong folder parsed for ${JSON.stringify(name)}`);
		assert.strictEqual(m[2], '4211', `wrong uid parsed for ${JSON.stringify(name)}`);
	}
});

test('the full name, which #153 passed by mistake, does not route', () => {
	const broken = folderNames.filter(name => !routedPath(name, 4211).match(messageRoute));
	// Every name that is not already hash safe must fail, which is the bug.
	for (const name of folderNames) {
		const safe = name === fullNameHash(name);
		assert.strictEqual(!broken.includes(name), safe,
			`${JSON.stringify(name)}: routing the raw full name should ${safe ? 'work' : 'fail'}`);
	}
	assert.ok(broken.length, 'no unsafe folder name in the sample, so this test proves nothing');
});
