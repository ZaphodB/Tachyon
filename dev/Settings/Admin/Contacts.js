import ko from 'ko';

import { SettingsGet } from 'Common/Globals';
import { defaultOptionsAfterRender } from 'Common/Utils';
import { addObservablesTo } from 'External/ko';

import Remote from 'Remote/Admin/Fetch';
import { decorateKoCommands } from 'Knoin/Knoin';
import { AbstractViewSettings } from 'Knoin/AbstractViews';

export class AdminSettingsContacts extends AbstractViewSettings {
	constructor() {
		super();
		this.defaultOptionsAfterRender = defaultOptionsAfterRender;

		this.addSetting('contactsPdoDsn');
		this.addSetting('contactsPdoUser');
		this.addSetting('contactsPdoPassword');
		this.addSetting('contactsPdoType', () => this.resetContactsTest());

		this.addSettings(['contactsEnable','contactsSync']);

		this.addSetting('contactsMySQLSSLCA');
		this.addSetting('contactsMySQLSSLVerify');
		this.addSetting('contactsMySQLSSLCiphers');

		this.addSetting('contactsSQLiteGlobal');

		addObservablesTo(this, {
			testing: false,
			testContactsSuccess: false,
			/**
			 * The database answered, but contacts are switched off, so nothing
			 * here is reachable by anyone. A plain green result was read as
			 * "contacts work" and sent someone hunting elsewhere for a week (#145).
			 */
			testContactsDisabled: false,
			testContactsError: false,
			testContactsErrorMessage: ''
		});

		this.addSetting('contactsSuggestionsLimit');
		this.addSetting('contactsComposeLimit');
		this.addSetting('contactsBccLimit');

		const supportedTypes = SettingsGet('supportedPdoDrivers') || [],
			types = [{
				id:'sqlite',
				name:'SQLite'
			},{
				id:'mysql',
				name:'MySQL'
			},{
				id:'pgsql',
				name:'PostgreSQL'
			}].filter(type => supportedTypes.includes(type.id));

		this.contactsSupported = 0 < types.length;

		this.contactsTypesOptions = types;

		this.mainContactsType = ko
			.computed({
				read: this.contactsPdoType,
				write: value => {
					if (value !== this.contactsPdoType()) {
						if (supportedTypes.includes(value)) {
							this.contactsPdoType(value);
						} else if (types.length) {
							this.contactsPdoType('');
						}
					} else {
						this.contactsPdoType.valueHasMutated();
					}
				}
			})
			.extend({ notify: 'always' });

		decorateKoCommands(this, {
			testContactsCommand: self => self.contactsPdoDsn() && self.contactsPdoUser()
		});
	}

	resetContactsTest() {
		this.testContactsSuccess(false);
		this.testContactsDisabled(false);
		this.testContactsError(false);
		this.testContactsErrorMessage('');
	}

	testContactsCommand() {
		this.resetContactsTest();
		this.testing(true);

		Remote.request('AdminContactsTest',
			(iError, data) => {
				this.resetContactsTest();

				if (!iError && data.Result.Result) {
					// The test only ever asked the database. Whether contacts are
					// switched on is the other half of the answer, and without it
					// a success here says less than it appears to.
					this.contactsEnable()
						? this.testContactsSuccess(true)
						: this.testContactsDisabled(true);
				} else {
					this.testContactsError(true);
					this.testContactsErrorMessage(data?.Result?.Message || '');
				}

				this.testing(false);
			}, {
				PdoType: this.contactsPdoType(),
				PdoDsn: this.contactsPdoDsn(),
				PdoUser: this.contactsPdoUser(),
				PdoPassword: this.contactsPdoPassword(),
				MySQLSSLCA: this.contactsMySQLSSLCA(),
				MySQLSSLVerify: this.contactsMySQLSSLVerify(),
				MySQLSSLCiphers: this.contactsMySQLSSLCiphers(),
				SQLiteGlobal: this.contactsSQLiteGlobal()
			}
		);
	}

	onShow() {
		this.testContactsSuccess(false);
		this.testContactsError(false);
		this.testContactsErrorMessage('');
	}
}
