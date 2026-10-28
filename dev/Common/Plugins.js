import { settingsAddViewModel } from 'Screen/AbstractSettings';
import { SettingsGet } from 'Common/Globals';
import { AbstractViewPopup } from 'Knoin/AbstractViews';

const USER_VIEW_MODELS_HOOKS = [],
	ADMIN_VIEW_MODELS_HOOKS = [];

/**
 * @param {Function} callback
 * @param {string} action
 * @param {Object=} parameters
 * @param {?number=} timeout
 */
rl.pluginRemoteRequest = (callback, action, parameters, timeout) => {
	rl.app.Remote.request('Plugin' + action, callback, parameters, timeout);
};

/**
 * @param {Function} SettingsViewModelClass
 * @param {string} labelName
 * @param {string} template
 * @param {string} route
 */
rl.addSettingsViewModel = (SettingsViewModelClass, template, labelName, route) => {
	USER_VIEW_MODELS_HOOKS.push([SettingsViewModelClass, template, labelName, route]);
};

/**
 * @param {Function} SettingsViewModelClass
 * @param {string} labelName
 * @param {string} template
 * @param {string} route
 */
rl.addSettingsViewModelForAdmin = (SettingsViewModelClass, template, labelName, route) => {
	ADMIN_VIEW_MODELS_HOOKS.push([SettingsViewModelClass, template, labelName, route]);
};

/**
 * @param {boolean} admin
 */
export function runSettingsViewModelHooks(admin) {
	(admin ? ADMIN_VIEW_MODELS_HOOKS : USER_VIEW_MODELS_HOOKS).forEach(view =>
		settingsAddViewModel(...view)
	);
}

/**
 * @param {string} pluginSection
 * @param {string} name
 * @returns {?}
 */
rl.pluginSettingsGet = (pluginSection, name) =>
	SettingsGet('Plugins')?.[pluginSection]?.[name];

rl.pluginPopupView = AbstractViewPopup;

const COMPOSE_HEADER_ROWS = [],
	COMPOSE_BUTTONS = [],
	MESSAGE_VIEW_MENU_ITEMS = [],
	MESSAGE_VIEW_TOOLBAR_BUTTONS = [];

/**
 * Renders a plugin template as a row of the compose header table.
 * The template holds a <tr> and is bound to the ComposePopupView.
 * @param {string} template
 */
rl.addComposeHeaderRow = template => COMPOSE_HEADER_ROWS.push(template);

/**
 * Renders a plugin template beside the attach button of the compose window.
 * The template is bound to the ComposePopupView.
 * @param {string} template
 */
rl.addComposeButton = template => COMPOSE_BUTTONS.push(template);

/**
 * Renders a plugin template in the message view's menu.
 * The template holds an <li> and is bound to the MessageViewUserView, so the
 * message itself is $data.message().
 * @param {string} template
 */
rl.addMessageViewMenuItem = template => MESSAGE_VIEW_MENU_ITEMS.push(template);

/**
 * Renders a plugin template in the message view's top toolbar, after the
 * previous/next buttons.
 * The template holds a <div class="btn-group"> and is bound to the
 * MessageViewUserView, so the message itself is $data.message().
 * @param {string} template
 */
rl.addMessageViewToolbarButton = template => MESSAGE_VIEW_TOOLBAR_BUTTONS.push(template);

export const composeHeaderRows = COMPOSE_HEADER_ROWS,
	composeButtons = COMPOSE_BUTTONS,
	messageViewMenuItems = MESSAGE_VIEW_MENU_ITEMS,
	messageViewToolbarButtons = MESSAGE_VIEW_TOOLBAR_BUTTONS;
