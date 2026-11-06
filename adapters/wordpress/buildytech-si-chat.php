<?php
/**
 * Plugin Name: BuildYtech SI Chat
 * Description: Thin shell that will embed the SI Chat Svelte bundle and expose PagePort REST. No full PHP yet.
 * Author: BuildYtech
 * License: Apache-2.0
 * Version: 0.0.0
 *
 * @package BuildYtech\SiChat
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Placeholder admin page. The production plugin will enqueue the chat-web
 * static build (adapter-static 200.html + assets) and talk PagePort REST.
 */
function buildytech_si_chat_register_menu(): void {
	add_menu_page(
		'SI Chat',
		'SI Chat',
		'edit_pages',
		'buildytech-si-chat',
		'buildytech_si_chat_render_shell',
		'dashicons-format-chat',
		58
	);
}
add_action('admin_menu', 'buildytech_si_chat_register_menu');

function buildytech_si_chat_render_shell(): void {
	echo '<div id="buildytech-si-chat-root" class="wrap"></div>';
}
