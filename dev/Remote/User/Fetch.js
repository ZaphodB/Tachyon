import { pString, pInt, b64EncodeJSONSafe } from 'Common/Utils';

import {
	getFolderFromCacheList
} from 'Common/Cache';

import { SettingsGet } from 'Common/Globals';
import { SUB_QUERY_PREFIX } from 'Common/Links';

import { AppUserStore } from 'Stores/User/App';
import { SettingsUserStore } from 'Stores/User/Settings';

import { AbstractFetchRemote } from 'Remote/AbstractFetch';

class RemoteUserFetch extends AbstractFetchRemote {

	/**
	 * @param {?Function} fCallback
	 * @param {string} sFolderFullName
	 * @param {number} iUid
	 * @returns {boolean}
	 */
	message(fCallback, sFolderFullName, iUid) {
		sFolderFullName = pString(sFolderFullName);
		iUid = pInt(iUid);

		// Say so rather than returning false in silence. Twice now a caller has
		// passed a folder hash where the full name belongs, and the message view
		// just stayed empty with nothing anywhere to say why (#153, #155). A
		// stale link to a folder that no longer exists lands here too, which is
		// why this warns rather than throws.
		if (0 < iUid && !getFolderFromCacheList(sFolderFullName)) {
			console.warn(`Remote.message: no such folder ${JSON.stringify(sFolderFullName)}, not fetching uid ${iUid}`);
		}

		if (getFolderFromCacheList(sFolderFullName) && 0 < iUid) {
			this.abort('Message').request('Message',
				fCallback,
				{},
				null,
				'Message/' +
					SUB_QUERY_PREFIX +
					'/' +
					b64EncodeJSONSafe([
						sFolderFullName,
						iUid,
						AppUserStore.threadsAllowed() && SettingsUserStore.useThreads() ? 1 : 0,
						SettingsGet('accountHash')
					])
			);

			return true;
		}

		return false;
	}

	/**
	 * @param {?Function} fCallback
	 * @param {Object} oData
	 */
	saveSettings(fCallback, oData) {
		this.request('SettingsUpdate', fCallback, oData);
	}

	/**
	 * @param {string} key
	 * @param {?scalar} value
	 * @param {?Function} fCallback
	 */
	saveSetting(key, value, fCallback) {
		this.saveSettings(fCallback, {
			[key]: value
		});
	}
}

export default new RemoteUserFetch();
