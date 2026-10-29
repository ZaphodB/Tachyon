'use strict';
// Run with: node --test test/reply-quote-nested-body.test.js
//
// snappymail#2089: replying quoted only the message that was already quoted
// inside the one being answered, dropping everything the sender had written.
// cleanHtml() turns every <body> into <div class="mail-body">, a nested one
// included, and bodyAsHTML() quotes the first .mail-body in document order.
// A reply is usually a fragment with no <body> of its own, so when someone
// pastes or forwards a whole HTML document inside a blockquote, that nested
// body is the only .mail-body there is, and it wins.
//
// Upstream marks only the first <body> and leaves the rest plain. That breaks
// snappymail#1641 instead: the merge of sibling bodies looks for
// '.mail-body + .mail-body', which then matches nothing and silently drops the
// second body from the quote. So the class stays on every body and a nested one
// is unmarked after parsing, where the tree is known.
//
// There is no DOM in node and no dom library in the dependencies, so the
// document-order behaviour was measured in headless Chrome against the real
// bundled cleanHtml. What this file pins is the three places that have to keep
// agreeing, because each of them alone looks reasonable and breaks the fix.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const html = read('dev/Common/Html.js');
const message = read('dev/Model/Message.js');

// The <body> rewrite, taken from the source rather than copied, so that
// rewriting it the upstream way fails here instead of in someone's reply.
const bodyRewriteLine = html.split('\n').find(l => l.includes('class="mail-body"$'));

test('every <body> still becomes a .mail-body, not just the first', () => {
	assert.ok(bodyRewriteLine, 'no <body> rewrite found in dev/Common/Html.js');
	const m = bodyRewriteLine.match(/\/((?:[^/\\]|\\.)+)\/([gimsuy]*)/);
	assert.ok(m, 'no regex literal on the <body> rewrite line');
	assert.ok(m[2].includes('g'),
		'the <body> rewrite lost its g flag, so only the first body is marked and the '
		+ 'snappymail#1641 sibling merge has nothing left to match');

	// Two sibling bodies have to produce two markers for that merge to fire.
	// Only the opening tags are counted: the rewrite hits </body> as well, which
	// becomes a closing tag carrying an attribute the parser throws away.
	const re = new RegExp(m[1], m[2]);
	const replacement = bodyRewriteLine.match(/,\s*'([^']*)'\s*\)/)[1];
	const out = '<html><body>mine</body><body>theirs</body></html>'.replace(re, replacement);
	assert.strictEqual(out.match(/<div class="mail-body"/g).length, 2,
		'two sibling bodies no longer yield two .mail-body elements');
});

test('a <body> inside a blockquote is unmarked before the body is looked up', () => {
	const cleanup = html.indexOf("'blockquote .mail-body'");
	const lookup = html.indexOf("querySelector('.mail-body')");
	const merge = html.indexOf("'.mail-body + .mail-body'");

	assert.notStrictEqual(cleanup, -1,
		'nothing unmarks a .mail-body inside a blockquote, so a reply to a message '
		+ 'carrying a whole HTML document in a blockquote quotes only that document');
	assert.notStrictEqual(lookup, -1, 'the .mail-body lookup is gone from dev/Common/Html.js');
	assert.notStrictEqual(merge, -1, 'the snappymail#1641 sibling merge is gone');
	assert.ok(cleanup < lookup,
		'the blockquote cleanup runs after the .mail-body lookup, so the lookup can '
		+ 'still land on a nested body');
});

test('bodyAsHTML() keeps the fallback the fix relies on', () => {
	// With the nested body unmarked, a fragment has no .mail-body at all and the
	// whole cloned body is the quote. Without the fallback it would be empty.
	assert.match(message, /querySelector\('\.mail-body'\)\s*\|\|\s*clone/,
		'bodyAsHTML() no longer falls back to the whole body, so a message with no '
		+ '.mail-body of its own now quotes nothing');
});
