<?php
declare(strict_types=1);

/**
 * WP admin UI for SI Chat.
 * Prefer router-free Svelte mount (app/wp-embed.js) so Kit client routing cannot
 * fight /wp-admin/admin.php?page=buildytech-si-chat (infinite reload, t144u).
 */
final class Buildytech_Si_Chat_Admin {
	/**
	 * Path-absolute URL (/, same host as request). Avoids 127.0.0.1 embeds breaking
	 * when admin is opened via ngrok/public reverse proxy.
	 */
	public static function host_relative_url(string $url): string {
		$path = wp_make_link_relative($url);
		if ($path === '' || $path[0] !== '/') {
			$parts = wp_parse_url($url);
			$path = isset($parts['path']) ? (string) $parts['path'] : $url;
			if (isset($parts['query'])) {
				$path .= '?' . $parts['query'];
			}
		}
		return $path;
	}

	public static function register(): void {
		add_action('admin_menu', [self::class, 'menu']);
		add_action('admin_enqueue_scripts', [self::class, 'enqueue']);
		add_action('admin_footer', [self::class, 'print_module_boot'], 5);
		add_filter('style_loader_src', [self::class, 'filter_asset_src'], 10, 2);
		add_filter('script_loader_src', [self::class, 'filter_asset_src'], 10, 2);
	}

	/** Keep plugin assets on the request host (ngrok/public proxy safe). */
	public static function filter_asset_src(string $src, string $handle): string {
		if (str_starts_with($handle, 'buildytech-si-chat')) {
			return self::host_relative_url($src);
		}
		return $src;
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

	/**
	 * Prefer embed mount (no Kit router). Missing embed fails visibly; legacy Kit entries are never started in wp-admin.
	 *
	 * @return array{mode:string,appBase:string,embedJs:string,embedCss:string,start:string,app:string,css:string,kitGlobal:string}|null
	 */
	public static function resolve_spa_entries(): ?array {
		$app_dir = BUILDYTECH_SI_CHAT_DIR . 'app/';
		$app_url = untrailingslashit(BUILDYTECH_SI_CHAT_URL . 'app');

		$embed_js = $app_dir . 'wp-embed.js';
		$embed_css = $app_dir . 'wp-embed.css';
		if (is_readable($embed_js)) {
			return [
				'mode' => 'embed',
				'appBase' => $app_url,
				'embedJs' => 'wp-embed.js',
				'embedCss' => is_readable($embed_css) ? 'wp-embed.css' : '',
				'start' => '',
				'app' => '',
				'css' => '',
				'kitGlobal' => '',
			];
		}

		return null;
	}

	public static function enqueue(string $hook): void {
		if ($hook !== 'toplevel_page_buildytech-si-chat') {
			return;
		}
		$spa = self::resolve_spa_entries();
		$rest_v1 = untrailingslashit(esc_url_raw(rest_url('buildytech/v1')));
		$api_base = preg_replace('#/v1$#', '', $rest_v1) ?: $rest_v1;
		$cfg = [
			'restBase' => self::host_relative_url($rest_v1),
			'apiBase' => self::host_relative_url($api_base),
			'nonce' => wp_create_nonce('wp_rest'),
			'appBase' => self::host_relative_url($spa['appBase'] ?? ''),
			'mountMode' => $spa['mode'] ?? 'missing',
			'entryStart' => $spa['start'] ?? '',
			'entryApp' => $spa['app'] ?? '',
			'embedJs' => $spa['embedJs'] ?? '',
			'kitGlobal' => $spa['kitGlobal'] ?? '',
			'spaReady' => $spa !== null,
			'binding' => [
				'sessionId' => Buildytech_Si_Chat_Settings::get()['bound_session_id'],
				'pageId' => Buildytech_Si_Chat_Settings::get()['bound_page_id'],
				'slug' => Buildytech_Si_Chat_Settings::get()['agent_page_slug'],
			],
			'publishPolicy' => 'draft_only',
		];
		if ($spa && ($spa['mode'] ?? '') === 'embed' && ($spa['embedCss'] ?? '') !== '') {
			wp_enqueue_style(
				'buildytech-si-chat-app',
				self::host_relative_url($spa['appBase'] . '/' . $spa['embedCss']),
				[],
				BUILDYTECH_SI_CHAT_VERSION
			);
		} elseif ($spa && ($spa['css'] ?? '') !== '') {
			wp_enqueue_style(
				'buildytech-si-chat-app',
				self::host_relative_url($spa['appBase'] . '/_app/immutable/assets/' . $spa['css']),
				[],
				BUILDYTECH_SI_CHAT_VERSION
			);
		}
		wp_register_script('buildytech-si-chat-cfg', false, [], BUILDYTECH_SI_CHAT_VERSION, true);
		wp_enqueue_script('buildytech-si-chat-cfg');
		wp_add_inline_script(
			'buildytech-si-chat-cfg',
			'window.__BUILDYTECH_SI_CHAT__=' . wp_json_encode($cfg, JSON_UNESCAPED_SLASHES) . ';',
			'before'
		);
		$GLOBALS['buildytech_si_chat_spa'] = $spa;
	}

	public static function print_module_boot(): void {
		$screen = function_exists('get_current_screen') ? get_current_screen() : null;
		if (!$screen || $screen->id !== 'toplevel_page_buildytech-si-chat') {
			return;
		}
		$spa = $GLOBALS['buildytech_si_chat_spa'] ?? self::resolve_spa_entries();
		if (!$spa) {
			echo '<script>document.getElementById("buildytech-si-chat-mount-status")&&(document.getElementById("buildytech-si-chat-mount-status").textContent=' .
				wp_json_encode(__('Creator SPA assets missing in plugin/app. Reinstall the ZIP build.', 'buildytech-si-chat')) .
				');</script>';
			return;
		}

		// Preferred: single ESM import of router-free embed (no kit.start / no history ownership).
		if (($spa['mode'] ?? '') === 'embed') {
			$embed_url = self::host_relative_url($spa['appBase'] . '/' . $spa['embedJs']) . '?ver=' . rawurlencode(BUILDYTECH_SI_CHAT_VERSION);
			$flags = JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT;
			?>
<script type="module">
import(<?php echo wp_json_encode($embed_url, $flags); ?>).catch((err) => {
  console.error('buildytech-si-chat embed import failed', err);
  const status = document.getElementById('buildytech-si-chat-mount-status');
  const root = document.getElementById('buildytech-si-chat-root');
  if (status) {
    status.textContent = 'Creator failed to load: ' + (err && err.message ? err.message : String(err));
    status.hidden = false;
  }
  if (root) root.setAttribute('data-mount-error', '1');
});
</script>
			<?php
			return;
		}

	}

	public static function render(): void {
		if (!current_user_can('edit_pages')) {
			wp_die(esc_html__('Insufficient capabilities.', 'buildytech-si-chat'));
		}
		$spa = self::resolve_spa_entries();
		$mode = $spa['mode'] ?? 'missing';
		echo '<div class="wrap"><h1>' . esc_html__('SI Chat', 'buildytech-si-chat') . '</h1>';
		echo '<p class="description">' . esc_html__('Creator chat — draft only. Secrets stay server-side.', 'buildytech-si-chat') . '</p>';
		if (!$spa) {
			echo '<div class="notice notice-error"><p>' .
				esc_html__('Creator embed missing (app/wp-embed.js). Reinstall the release ZIP.', 'buildytech-si-chat') .
				'</p></div>';
		}
		echo '<p id="buildytech-si-chat-mount-status" class="description" role="status">' .
			esc_html($spa ? __('Loading Creator…', 'buildytech-si-chat') : __('Creator unavailable — assets missing.', 'buildytech-si-chat')) .
			'</p>';
		echo '<div id="buildytech-si-chat-root" data-spa-ready="' . ($spa ? '1' : '0') . '" data-mount-mode="' . esc_attr($mode) . '"></div></div>';
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
