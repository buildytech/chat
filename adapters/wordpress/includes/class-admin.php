<?php
declare(strict_types=1);

final class Buildytech_Si_Chat_Admin {
	public static function register(): void {
		add_action('admin_menu', [self::class, 'menu']);
		add_action('admin_enqueue_scripts', [self::class, 'enqueue']);
	}

	public static function menu(): void {
		add_menu_page(
			'SI Chat',
			'SI Chat',
			'edit_pages',
			'buildytech-si-chat',
			[self::class, 'render'],
			'dashicons-format-chat',
			58
		);
		add_submenu_page(
			'buildytech-si-chat',
			'SI Chat Settings',
			'Settings',
			'manage_options',
			'buildytech-si-chat-settings',
			[self::class, 'render_settings']
		);
	}

	public static function enqueue(string $hook): void {
		if ($hook !== 'toplevel_page_buildytech-si-chat') {
			return;
		}
		$app = BUILDYTECH_SI_CHAT_DIR . 'app/';
		$base = BUILDYTECH_SI_CHAT_URL . 'app/';
		// Prefer built SPA assets when present (release copies apps/chat-web/build).
		$entry_js = $app . 'assets/index.js';
		$entry_css = $app . 'assets/index.css';
		if (is_readable($entry_js)) {
			wp_enqueue_script(
				'buildytech-si-chat-app',
				$base . 'assets/index.js',
				[],
				BUILDYTECH_SI_CHAT_VERSION,
				true
			);
		}
		if (is_readable($entry_css)) {
			wp_enqueue_style(
				'buildytech-si-chat-app',
				$base . 'assets/index.css',
				[],
				BUILDYTECH_SI_CHAT_VERSION
			);
		}
		$cfg = [
			'restBase' => esc_url_raw(rest_url('buildytech/v1')),
			'nonce' => wp_create_nonce('wp_rest'),
			'binding' => [
				'sessionId' => Buildytech_Si_Chat_Settings::get()['bound_session_id'],
				'pageId' => Buildytech_Si_Chat_Settings::get()['bound_page_id'],
				'slug' => Buildytech_Si_Chat_Settings::get()['agent_page_slug'],
			],
			'publishPolicy' => 'draft_only',
			// Secrets intentionally omitted.
		];
		wp_add_inline_script(
			'buildytech-si-chat-app',
			'window.__BUILDYTECH_SI_CHAT__=' . wp_json_encode($cfg) . ';',
			'before'
		);
		// If SPA not built yet, still expose config for shell.
		if (!is_readable($entry_js)) {
			wp_register_script('buildytech-si-chat-shell', false, [], BUILDYTECH_SI_CHAT_VERSION, true);
			wp_enqueue_script('buildytech-si-chat-shell');
			wp_add_inline_script(
				'buildytech-si-chat-shell',
				'window.__BUILDYTECH_SI_CHAT__=' . wp_json_encode($cfg) . ';'
			);
		}
	}

	public static function render(): void {
		if (!current_user_can('edit_pages')) {
			wp_die(esc_html__('Insufficient capabilities.', 'buildytech-si-chat'));
		}
		echo '<div class="wrap"><h1>' . esc_html__('SI Chat', 'buildytech-si-chat') . '</h1>';
		echo '<p class="description">' . esc_html__('Creator chat — draft only. Secrets stay server-side.', 'buildytech-si-chat') . '</p>';
		echo '<div id="buildytech-si-chat-root"></div></div>';
	}

	public static function render_settings(): void {
		if (!current_user_can('manage_options')) {
			wp_die(esc_html__('Insufficient capabilities.', 'buildytech-si-chat'));
		}
		$s = Buildytech_Si_Chat_Settings::get();
		if (isset($_POST['buildytech_si_chat_save']) && check_admin_referer('buildytech_si_chat_settings')) {
			$next = Buildytech_Si_Chat_Settings::sanitize([
				'session_base_url' => wp_unslash((string) ($_POST['session_base_url'] ?? '')),
				'basic_auth_user' => wp_unslash((string) ($_POST['basic_auth_user'] ?? '')),
				'basic_auth_pass' => wp_unslash((string) ($_POST['basic_auth_pass'] ?? '')),
				'site_id' => wp_unslash((string) ($_POST['site_id'] ?? '')),
				'site_token' => wp_unslash((string) ($_POST['site_token'] ?? '')),
				'allowed_session_hosts' => wp_unslash((string) ($_POST['allowed_session_hosts'] ?? '')),
				'agent_page_slug' => wp_unslash((string) ($_POST['agent_page_slug'] ?? '')),
				'bound_session_id' => wp_unslash((string) ($_POST['bound_session_id'] ?? '')),
				'bound_page_id' => wp_unslash((string) ($_POST['bound_page_id'] ?? '')),
				'node_bin' => wp_unslash((string) ($_POST['node_bin'] ?? '')),
				'php_bin' => wp_unslash((string) ($_POST['php_bin'] ?? '')),
				'latte_vendor_autoload' => wp_unslash((string) ($_POST['latte_vendor_autoload'] ?? '')),
			]);
			update_option(Buildytech_Si_Chat_Settings::OPTION, $next, false);
			$s = $next;
			echo '<div class="updated"><p>' . esc_html__('Saved.', 'buildytech-si-chat') . '</p></div>';
		}
		echo '<div class="wrap"><h1>SI Chat Settings</h1>';
		echo '<form method="post">';
		wp_nonce_field('buildytech_si_chat_settings');
		echo '<table class="form-table">';
		self::row('session_base_url', 'Session base URL', $s['session_base_url'], 'text');
		self::row('basic_auth_user', 'BasicAuth user (dev)', $s['basic_auth_user'], 'text');
		self::row('basic_auth_pass', 'BasicAuth pass (dev)', '', 'password');
		self::row('site_id', 'Site ID (auto if empty)', $s['site_id'], 'text');
		self::row('site_token', 'Site token (server-side)', '', 'password');
		echo '<tr><th><label for="allowed_session_hosts">Allowed Session hosts</label></th><td><textarea class="large-text" rows="3" id="allowed_session_hosts" name="allowed_session_hosts">' . esc_textarea($s['allowed_session_hosts']) . '</textarea><p class="description">One host per line. Loopback always allowed. Non-loopback requires https.</p></td></tr>';
		self::row('agent_page_slug', 'WP agent page slug', $s['agent_page_slug'], 'text');
		self::row('bound_session_id', 'Bound session id', $s['bound_session_id'], 'text');
		self::row('bound_page_id', 'Bound page id', $s['bound_page_id'], 'text');
		self::row('node_bin', 'Node binary', $s['node_bin'], 'text');
		self::row('php_bin', 'PHP binary', $s['php_bin'], 'text');
		self::row('latte_vendor_autoload', 'Latte autoload.php', $s['latte_vendor_autoload'], 'text');
		echo '</table>';
		echo '<p><strong>Publish policy:</strong> draft only (public publish disabled).</p>';
		submit_button('Save', 'primary', 'buildytech_si_chat_save');
		echo '</form></div>';
	}

	private static function row(string $name, string $label, string $value, string $type): void {
		printf(
			'<tr><th><label for="%1$s">%2$s</label></th><td><input class="regular-text" type="%3$s" id="%1$s" name="%1$s" value="%4$s" autocomplete="off" /></td></tr>',
			esc_attr($name),
			esc_html($label),
			esc_attr($type),
			esc_attr($value)
		);
	}
}
