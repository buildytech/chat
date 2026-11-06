<?php
declare(strict_types=1);

final class Buildytech_Si_Chat_Admin {
	public static function register(): void {
		add_action('admin_menu', [self::class, 'menu']);
		add_action('admin_enqueue_scripts', [self::class, 'enqueue']);
		add_action('admin_footer', [self::class, 'print_module_boot'], 5);
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

	/** @return array{appBase:string,start:string,app:string,css:string,kitGlobal:string}|null */
	public static function resolve_spa_entries(): ?array {
		$app_dir = BUILDYTECH_SI_CHAT_DIR . 'app/';
		$app_url = untrailingslashit(BUILDYTECH_SI_CHAT_URL . 'app');
		$starts = glob($app_dir . '_app/immutable/entry/start.*.js') ?: [];
		$apps = glob($app_dir . '_app/immutable/entry/app.*.js') ?: [];
		$css = glob($app_dir . '_app/immutable/assets/*.css') ?: [];
		if ($starts === [] || $apps === []) {
			return null;
		}
		sort($starts);
		sort($apps);
		sort($css);
		$kit_global = '__sveltekit_wp';
		$html = $app_dir . '200.html';
		if (is_readable($html)) {
			$raw = (string) file_get_contents($html);
			if (preg_match('/__sveltekit_([a-z0-9]+)/', $raw, $m)) {
				$kit_global = '__sveltekit_' . $m[1];
			}
		}
		return [
			'appBase' => $app_url,
			'start' => basename($starts[0]),
			'app' => basename($apps[0]),
			'css' => $css !== [] ? basename($css[0]) : '',
			'kitGlobal' => $kit_global,
		];
	}

	public static function enqueue(string $hook): void {
		if ($hook !== 'toplevel_page_buildytech-si-chat') {
			return;
		}
		$spa = self::resolve_spa_entries();
		$rest_v1 = untrailingslashit(esc_url_raw(rest_url('buildytech/v1')));
		// apiBase + /v1/... → .../buildytech/v1/...
		$api_base = preg_replace('#/v1$#', '', $rest_v1) ?: $rest_v1;
		$cfg = [
			'restBase' => $rest_v1,
			'apiBase' => $api_base,
			'nonce' => wp_create_nonce('wp_rest'),
			'appBase' => $spa['appBase'] ?? '',
			'entryStart' => $spa['start'] ?? '',
			'entryApp' => $spa['app'] ?? '',
			'kitGlobal' => $spa['kitGlobal'] ?? '__sveltekit_wp',
			'spaReady' => $spa !== null,
			'binding' => [
				'sessionId' => Buildytech_Si_Chat_Settings::get()['bound_session_id'],
				'pageId' => Buildytech_Si_Chat_Settings::get()['bound_page_id'],
				'slug' => Buildytech_Si_Chat_Settings::get()['agent_page_slug'],
			],
			'publishPolicy' => 'draft_only',
		];
		if ($spa && $spa['css'] !== '') {
			wp_enqueue_style(
				'buildytech-si-chat-app',
				$spa['appBase'] . '/_app/immutable/assets/' . $spa['css'],
				[],
				BUILDYTECH_SI_CHAT_VERSION
			);
		}
		// Config must exist before module boot (printed in footer as type=module).
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
		$start_url = $spa['appBase'] . '/_app/immutable/entry/' . $spa['start'];
		$app_url = $spa['appBase'] . '/_app/immutable/entry/' . $spa['app'];
		$kit = $spa['kitGlobal'];
		// ESM boot: set Kit base to plugin app URL, mount into #buildytech-si-chat-root.
		// Shell must appear even when Session/backend is unconfigured.
		?>
<script type="module">
(async () => {
  const cfg = window.__BUILDYTECH_SI_CHAT__ || {};
  const status = document.getElementById('buildytech-si-chat-mount-status');
  const root = document.getElementById('buildytech-si-chat-root');
  if (!root) {
    if (status) status.textContent = 'Mount root #buildytech-si-chat-root missing.';
    return;
  }
  const base = (cfg.appBase || <?php echo wp_json_encode($spa['appBase'], JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>).replace(/\/$/, '');
  const kitName = cfg.kitGlobal || <?php echo wp_json_encode($kit, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>;
  globalThis[kitName] = { base, assets: base };
  try {
    if (status) status.textContent = 'Loading Creator…';
    const [kit, app] = await Promise.all([
      import(<?php echo wp_json_encode($start_url, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>),
      import(<?php echo wp_json_encode($app_url, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>)
    ]);
    await kit.start(app, root);
    if (status) status.remove();
  } catch (err) {
    console.error('buildytech-si-chat mount failed', err);
    if (status) {
      status.textContent = 'Creator failed to load: ' + (err && err.message ? err.message : String(err));
      status.hidden = false;
    }
    root.setAttribute('data-mount-error', '1');
  }
})();
</script>
		<?php
	}

	public static function render(): void {
		if (!current_user_can('edit_pages')) {
			wp_die(esc_html__('Insufficient capabilities.', 'buildytech-si-chat'));
		}
		$spa = self::resolve_spa_entries();
		echo '<div class="wrap"><h1>' . esc_html__('SI Chat', 'buildytech-si-chat') . '</h1>';
		echo '<p class="description">' . esc_html__('Creator chat — draft only. Secrets stay server-side.', 'buildytech-si-chat') . '</p>';
		if (!$spa) {
			echo '<div class="notice notice-error"><p>' .
				esc_html__('Creator SPA build missing (app/_app/immutable/entry). Reinstall the release ZIP.', 'buildytech-si-chat') .
				'</p></div>';
		}
		echo '<p id="buildytech-si-chat-mount-status" class="description" role="status">' .
			esc_html($spa ? __('Loading Creator…', 'buildytech-si-chat') : __('Creator unavailable — assets missing.', 'buildytech-si-chat')) .
			'</p>';
		echo '<div id="buildytech-si-chat-root" data-spa-ready="' . ($spa ? '1' : '0') . '"></div></div>';
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
