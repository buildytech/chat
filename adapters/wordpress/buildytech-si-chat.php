<?php
/**
 * Plugin Name: BuildYtech SI Chat
 * Description: CMS-agnostic Creator chat adapter for WordPress. Same-origin REST proxy to Session; embeds chat-web; draft-only publish; Latte same revision.
 * Author: BuildYtech
 * License: Apache-2.0
 * Version: 0.1.0
 * Requires at least: 6.4
 * Requires PHP: 8.2
 *
 * @package BuildYtech\SiChat
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
	exit;
}

define('BUILDYTECH_SI_CHAT_VERSION', '0.1.0');
define('BUILDYTECH_SI_CHAT_FILE', __FILE__);
define('BUILDYTECH_SI_CHAT_DIR', plugin_dir_path(__FILE__));
define('BUILDYTECH_SI_CHAT_URL', plugin_dir_url(__FILE__));

require_once BUILDYTECH_SI_CHAT_DIR . 'includes/class-settings.php';
require_once BUILDYTECH_SI_CHAT_DIR . 'includes/class-session-client.php';
require_once BUILDYTECH_SI_CHAT_DIR . 'includes/class-rest-controller.php';
require_once BUILDYTECH_SI_CHAT_DIR . 'includes/class-admin.php';
require_once BUILDYTECH_SI_CHAT_DIR . 'includes/class-draft-binding.php';
require_once BUILDYTECH_SI_CHAT_DIR . 'includes/class-latte-renderer.php';

final class Buildytech_Si_Chat_Plugin {
	public static function init(): void {
		Buildytech_Si_Chat_Settings::register();
		Buildytech_Si_Chat_Admin::register();
		Buildytech_Si_Chat_Draft_Binding::register();
		add_action('rest_api_init', static function (): void {
			(new Buildytech_Si_Chat_Rest_Controller())->register_routes();
		});
	}
}

add_action('plugins_loaded', ['Buildytech_Si_Chat_Plugin', 'init']);

register_activation_hook(__FILE__, static function (): void {
	Buildytech_Si_Chat_Draft_Binding::ensure_agent_page();
});
