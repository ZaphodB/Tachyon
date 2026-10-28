(rl => {

	const
		// FilterAppDataPluginSection() puts the section under Plugins, keyed by the
		// plugin folder name, which is what rl.pluginSettingsGet reads from too.
		cfg = () => rl.settings.get('Plugins')?.['deepl-translate'] || {},
		i18n = (key, replace) => rl.i18n('DEEPL/' + key, replace),

		// DeepL answers 413 over 128 KiB of request body. A body is split into
		// entries below this, which leaves room for the JSON around them.
		BUDGET = 100000,

		request = (action, params) => new Promise((resolve, reject) =>
			rl.pluginRemoteRequest(
				(iError, oData) => iError ? reject(iError) : resolve(oData?.Result),
				action,
				params
			)
		),

		// The hook answers a string instead of an object when DeepL refused, so
		// the one place that reads a result also names the reason.
		errorText = result => 'string' == typeof result ? i18n('ERROR_' + result.toUpperCase().replace(/-/g, '_')) : '',

		/**
		 * Split a run of text with no tags in it. Cuts on a space so a word is
		 * never halved.
		 */
		splitText = (text, budget) => {
			const parts = [];
			while (text.length > budget) {
				const space = text.lastIndexOf(' ', budget),
					cut = 1 > space ? budget : space + 1;
				parts.push(text.slice(0, cut));
				text = text.slice(cut);
			}
			text && parts.push(text);
			return parts;
		},

		/**
		 * Cut a body into segments small enough for one request, with every tag
		 * left whole. A segment is either text to translate or literal markup to
		 * put back untouched: when an element is too big on its own, its own tags
		 * become literal and its children are cut the same way, so the wrapper
		 * never reaches DeepL and cannot come back altered or missing.
		 *
		 * childNodes, not children, or a bare text node between two blocks would
		 * be dropped.
		 */
		collect = (html, budget, segments) => {
			if (html.length <= budget) {
				segments.push({ text: html });
				return;
			}
			const tpl = document.createElement('template');
			tpl.innerHTML = html;
			tpl.content.childNodes.forEach(node => {
				const isElement = 1 === node.nodeType,
					source = isElement ? node.outerHTML : (node.textContent || '');
				if (!source) {
					return;
				}
				if (source.length <= budget) {
					segments.push({ text: source });
				} else if (isElement && node.childNodes.length) {
					// The empty clone is exactly the open and close tags, so the
					// open tag survives an attribute value holding a '>'.
					const shell = node.cloneNode(false).outerHTML,
						close = '</' + node.localName + '>';
					segments.push({ raw: shell.slice(0, shell.length - close.length) });
					collect(node.innerHTML, budget, segments);
					segments.push({ raw: close });
				} else {
					splitText(source, budget).forEach(text => segments.push({ text: text }));
				}
			});
		},

		/**
		 * Entries are translated in the order they are sent, so a batch comes back
		 * in order and the body is the segments put back in place.
		 */
		translateBody = async (source, target, isHtml) => {
			const segments = [];
			if (isHtml) {
				collect(source, BUDGET, segments);
			} else {
				splitText(source, BUDGET).forEach(text => segments.push({ text: text }));
			}

			let out = [],
				batch = [],
				size = 0,
				detected = '';

			const flush = async () => {
				if (!batch.length) {
					return;
				}
				const result = await request('DeeplTranslate', { texts: batch, target: target, html: isHtml ? 1 : 0 });
				if (!result || !result.texts) {
					throw new Error(errorText(result) || i18n('ERROR_FAILED'));
				}
				detected = detected || result.detected || '';
				out = out.concat(result.texts);
				batch = [];
				size = 0;
			};

			for (const segment of segments) {
				if (undefined !== segment.raw) {
					continue;
				}
				if (size && size + segment.text.length > BUDGET) {
					await flush();
				}
				batch.push(segment.text);
				size += segment.text.length;
			}
			await flush();

			let i = 0;
			return {
				text: segments.map(segment => undefined !== segment.raw ? segment.raw : out[i++]).join(''),
				detected: detected
			};
		};

	let composeView = null;

	/**
	 * The message view's menu item. The body source is translated and put back
	 * through html()/plain(), so viewBody() runs it through cleanHtml() exactly
	 * as it does the original. Nothing is written into the DOM directly.
	 */
	const
		originals = new Map,
		msgKey = msg => msg.folder + '/' + msg.uid,

		translateMessage = async view => {
			const msg = view.message();
			if (!msg) {
				return;
			}

			const key = msgKey(msg),
				kept = originals.get(key);

			if (kept) {
				originals.delete(key);
				msg.subject(kept.subject);
				kept.html && msg.html(kept.html);
				kept.plain && msg.plain(kept.plain);
				kept.isHtml ? msg.viewHtml() : msg.viewPlain();
				view.deeplBusy(false);
				view.deeplTranslated(false);
				return;
			}

			view.deeplBusy(true);
			view.deeplError('');
			try {
				const isHtml = msg.isHtml(),
					source = isHtml ? msg.html() : msg.plain(),
					target = cfg().target_lang || '',
					subject = msg.subject();

				originals.set(key, {
					html: msg.html(),
					plain: msg.plain(),
					subject: subject,
					isHtml: isHtml
				});

				const body = await translateBody(source, target, isHtml);
				if (subject) {
					const translated = await translateBody(subject, target, false);
					msg.subject(translated.text);
				}

				isHtml ? msg.html(body.text) : msg.plain(body.text);
				isHtml ? msg.viewHtml() : msg.viewPlain();
				view.deeplTranslated(true);
			} catch (e) {
				originals.delete(key);
				view.deeplError(e.message || i18n('ERROR_FAILED'));
			} finally {
				view.deeplBusy(false);
			}
		};

	/**
	 * The composer's header row. Replaces what is in the editor, and keeps it so
	 * the same button puts it back.
	 */
	let composeOriginal = null;

	const translateCompose = async view => {
		view.editor(async editor => {
			if (null !== composeOriginal) {
				editor.isHtml() ? editor.setHtml(composeOriginal) : editor.setPlain(composeOriginal);
				composeOriginal = null;
				view.deeplTranslated(false);
				return;
			}

			view.deeplBusy(true);
			view.deeplError('');
			try {
				const isHtml = editor.isHtml(),
					source = editor.getData();
				if (!source.trim()) {
					return;
				}
				composeOriginal = source;
				const result = await translateBody(source, view.deeplTarget(), isHtml);
				isHtml ? editor.setHtml(result.text) : editor.setPlain(result.text);
				view.deeplTranslated(true);
			} catch (e) {
				composeOriginal = null;
				view.deeplError(e.message || i18n('ERROR_FAILED'));
			} finally {
				view.deeplBusy(false);
			}
		});
	};

	class DeeplSettingsTab {
		constructor() {
			this.target = ko.observable(cfg().target_lang || '');
			this.authKey = ko.observable('');
			this.languages = ko.observableArray([]);
			this.allowUserKey = ko.observable(!!cfg().allow_user_key);
			this.hasUserKey = ko.observable(!!cfg().has_user_key);
			this.usage = ko.observable('');
			this.saved = ko.observable(false);
			this.error = ko.observable('');
		}

		onShow() {
			request('DeeplLanguages')
				.then(result => {
					// An empty list with nothing said is indistinguishable from a
					// DeepL that refused, so say which one it was
					Array.isArray(result)
						? this.languages(result)
						: this.error(errorText(result) || i18n('ERROR_FAILED'));
				})
				.catch(() => this.error(i18n('ERROR_FAILED')));
			request('DeeplUsage')
				.then(result => {
					const text = errorText(result);
					if (text) {
						this.error(text);
					} else if (result && undefined !== result.character_count) {
						this.usage(i18n('USAGE', {
							COUNT: result.character_count.toLocaleString(),
							LIMIT: result.character_limit.toLocaleString()
						}));
					}
				})
				.catch(() => {});
		}

		save() {
			this.error('');
			request('DeeplSettings', {
				save: 1,
				target_lang: this.target(),
				auth_key: this.authKey()
			}).then(result => {
				if (result) {
					this.authKey('');
					this.hasUserKey(!!result.has_user_key);
					this.saved(true);
					setTimeout(() => this.saved(false), 3000);
				}
			}).catch(() => this.error(i18n('ERROR_FAILED')));
		}

		clearKey() {
			request('DeeplSettings', { save: 1, clear_key: 1, target_lang: this.target() })
				.then(result => result && this.hasUserKey(!!result.has_user_key))
				.catch(() => this.error(i18n('ERROR_FAILED')));
		}
	}

	rl.addMessageViewMenuItem('MessageViewDeeplTranslate');
	rl.addComposeHeaderRow('ComposeDeeplTranslate');
	rl.addSettingsViewModel(DeeplSettingsTab, 'STabDeeplTranslate', 'DeepL', 'deepl');

	addEventListener('rl-view-model.create', e => {
		const view = e.detail;

		if ('MailMessageView' === view.viewModelTemplateID) {
			view.deeplBusy = ko.observable(false);
			view.deeplError = ko.observable('');
			view.deeplTranslated = ko.observable(false);
			view.deeplConfigured = !!cfg().configured;
			view.deeplTranslate = () => translateMessage(view);
			// A different message in the same view is not the one that was
			// translated, so the menu item goes back to offering a translation.
			view.message.subscribe(() => {
				view.deeplError('');
				view.deeplTranslated(view.message() ? originals.has(msgKey(view.message())) : false);
			});
		}

		if ('PopupsCompose' === view.viewModelTemplateID) {
			composeView = view;
			view.deeplBusy = ko.observable(false);
			view.deeplError = ko.observable('');
			view.deeplTranslated = ko.observable(false);
			view.deeplConfigured = !!cfg().configured;
			view.deeplTarget = ko.observable(cfg().target_lang || '');
			view.deeplLanguages = ko.observableArray([]);
			view.deeplTranslate = () => translateCompose(view);
			request('DeeplLanguages')
				.then(result => Array.isArray(result) && view.deeplLanguages(result))
				.catch(() => {});
		}
	});

	addEventListener('rl-vm-visible', e => {
		if (composeView === e.detail) {
			// A new message is a new body, so there is nothing to undo any more
			composeOriginal = null;
			composeView.deeplTranslated(false);
			composeView.deeplError('');
		}
	});

})(window.rl);
