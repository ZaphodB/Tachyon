(rl => {

	const i18n = key => rl.i18n('MAIL_TEMPLATES/' + key),

		templates = ko.observableArray(),
		loading = ko.observable(false),
		busy = ko.observable(false);

	// The composer is built once and kept, so one reference is enough. It is
	// also how the popup reaches the message being written.
	let composeView = null;

	const request = (action, params) => new Promise((resolve, reject) =>
		rl.pluginRemoteRequest(
			(iError, oData) => iError ? reject(iError) : resolve(oData?.Result),
			action,
			params
		)
	);

	const loadList = () => {
		loading(true);
		return request('MailTemplatesList')
			.then(result => templates(result?.templates || []))
			.finally(() => loading(false));
	};

	/**
	 * The template goes above what is already in the editor, so the signature a
	 * new message starts with survives. Mode follows the editor, not the
	 * template, because switching it would throw away whichever of the two is
	 * not plain text.
	 */
	const insertBody = (editor, body) => {
		const isHtml = body.startsWith(':HTML:'),
			text = isHtml ? body.slice(6) : body;
		if (editor.isHtml()) {
			editor.setHtml((isHtml ? text : rl.Utils.plainToHtml(text)) + editor.getData());
		} else {
			editor.setPlain((isHtml ? rl.Utils.htmlToPlain(text) : text) + '\n' + editor.getData());
		}
	};

	class MailTemplatesPopupView extends rl.pluginPopupView {
		constructor() {
			super('MailTemplates');

			this.templates = templates;
			this.loading = loading;
			this.busy = busy;
			this.name = ko.observable('');
			this.error = ko.observable('');
		}

		beforeShow() {
			this.error('');
			this.name(composeView?.subject() || '');
			loadList();
		}

		insert(template) {
			composeView.subject() || composeView.subject(template.subject);
			busy(true);
			request('MailTemplateGet', { uid: template.uid })
				.then(result => {
					if (result) {
						composeView.editor(editor => insertBody(editor, result.body || ''));
						this.close();
					} else {
						this.error(i18n('ERROR_READ'));
					}
				})
				.catch(() => this.error(i18n('ERROR_READ')))
				.finally(() => busy(false));
		}

		remove(template) {
			busy(true);
			request('MailTemplateDelete', { uid: template.uid })
				.then(() => loadList())
				.catch(() => this.error(i18n('ERROR_DELETE')))
				.finally(() => busy(false));
		}

		/**
		 * Written by the core SaveMessage action, the one that already knows how
		 * to turn the composer into a message. messageFolder and messageUid are
		 * cleared because SaveMessage deletes that pair once it has appended, and
		 * getMessageRequestParams() fills them with the draft this message came
		 * from: saving a template would have deleted that draft.
		 */
		save() {
			const name = this.name().trim();
			if (!name) {
				this.error(i18n('ERROR_NO_NAME'));
				return;
			}

			this.error('');
			busy(true);
			request('MailTemplatesFolder')
				.then(folder => {
					if (!folder) {
						throw new Error('no folder');
					}
					return composeView.getMessageRequestParams(folder, 1).then(params => {
						params.messageFolder = '';
						params.messageUid = 0;
						params.subject = name;
						return new Promise((resolve, reject) =>
							rl.app.Remote.request('SaveMessage',
								(iError, oData) => iError || !oData?.Result ? reject(iError) : resolve(),
								params,
								200000
							)
						);
					});
				})
				.then(() => loadList())
				.catch(() => this.error(i18n('ERROR_SAVE')))
				.finally(() => busy(false));
		}
	}

	rl.addComposeButton('ComposeMailTemplates');

	addEventListener('rl-view-model.create', e => {
		if ('PopupsCompose' === e.detail.viewModelTemplateID) {
			composeView = e.detail;
			composeView.mailTemplates = () => MailTemplatesPopupView.showModal();
		}
	});

})(window.rl);
