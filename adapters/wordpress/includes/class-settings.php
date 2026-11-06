<?php
declare(strict_types=1);

/**
 * Server-side only Session endpoint + BasicAuth. Never localize secrets to JS.
 */
final class Buildytech_Si_Chat_Settings {
	public const OPTION = 'buildytech_si_chat_settings';

	public static function register(): void {
		add_action('admin_init', [self::class, 'register_settings']);
	}

	public static function defaults(): array {
		return [
			'session_base_url' => 'http://127.0.0.1:18090',
			'basic_auth_user' => '',
			'basic_auth_pass' => '',
			'site_id' => '', // auto-filled from home URL hash when empty
			'site_token' => '', // server-side only — never localized to JS / not in ZIP
			'allowed_session_hosts' => "127.0.0.1\nlocalhost\nchat.buildy.tw",
			'agent_page_slug' => 'buildy-agent-chat',
			'bound_session_id' => '',
			'bound_page_id' => '',
			'node_bin' => 'node',
			'php_bin' => PHP_BINARY,
			'latte_vendor_autoload' => '',
			'allow_public_publish' => false, // hard policy: draft only
		];
	}

	public static function get(): array {
		$stored = get_option(self::OPTION, []);
		if (!is_array($stored)) {
			$stored = [];
		}
		return array_merge(self::defaults(), $stored);
	}

	public static function register_settings(): void {
		register_setting('buildytech_si_chat', self::OPTION, [
			'type' => 'array',
			'sanitize_callback' => [self::class, 'sanitize'],
			'default' => self::defaults(),
			'show_in_rest' => false,
		]);
	}

	public static function sanitize($input): array {
		$cur = self::get();
		if (!is_array($input)) {
			return $cur;
		}
		$out = $cur;
		if (isset($input['session_base_url'])) {
			$url = esc_url_raw(trim((string) $input['session_base_url']));
			// Loopback or https only — no open proxy to arbitrary hosts.
			if (self::is_allowed_session_url($url)) {
				$out['session_base_url'] = untrailingslashit($url);
			}
		}
		if (isset($input['basic_auth_user'])) {
			$out['basic_auth_user'] = sanitize_text_field((string) $input['basic_auth_user']);
		}
		if (isset($input['basic_auth_pass']) && (string) $input['basic_auth_pass'] !== '') {
			$out['basic_auth_pass'] = (string) $input['basic_auth_pass'];
		}
		if (isset($input['site_id'])) {
			$sid = preg_replace('/[^a-z0-9\-_]/', '', strtolower((string) $input['site_id'])) ?? '';
			if ($sid !== '') {
				$out['site_id'] = substr($sid, 0, 64);
			}
		}
		if (isset($input['site_token']) && (string) $input['site_token'] !== '') {
			$out['site_token'] = (string) $input['site_token'];
		}
		if (isset($input['allowed_session_hosts'])) {
			$out['allowed_session_hosts'] = sanitize_textarea_field((string) $input['allowed_session_hosts']);
		}
		if (isset($input['agent_page_slug'])) {
			$slug = sanitize_title((string) $input['agent_page_slug']);
			if ($slug !== '') {
				$out['agent_page_slug'] = $slug;
			}
		}
		if (isset($input['bound_session_id'])) {
			$out['bound_session_id'] = preg_replace('/[^a-z0-9-]/', '', (string) $input['bound_session_id']) ?? '';
		}
		if (isset($input['bound_page_id'])) {
			$out['bound_page_id'] = preg_replace('/[^a-z0-9-]/', '', (string) $input['bound_page_id']) ?? '';
		}
		if (isset($input['node_bin'])) {
			$out['node_bin'] = sanitize_text_field((string) $input['node_bin']);
		}
		if (isset($input['php_bin'])) {
			$out['php_bin'] = sanitize_text_field((string) $input['php_bin']);
		}
		if (isset($input['latte_vendor_autoload'])) {
			$path = (string) $input['latte_vendor_autoload'];
			$out['latte_vendor_autoload'] = $path !== '' && is_readable($path) ? $path : $cur['latte_vendor_autoload'];
		}
		// Never allow flipping public publish from settings UI.
		$out['allow_public_publish'] = false;
		return $out;
	}

	public static function is_allowed_session_url(string $url): bool {
		if ($url === '') {
			return false;
		}
		$p = wp_parse_url($url);
		if (!is_array($p) || empty($p['scheme']) || empty($p['host'])) {
			return false;
		}
		$host = strtolower((string) $p['host']);
		$scheme = strtolower((string) $p['scheme']);
		if (!in_array($scheme, ['http', 'https'], true)) {
			return false;
		}
		$loopback = in_array($host, ['127.0.0.1', 'localhost', '::1'], true);
		if ($loopback) {
			return true;
		}
		// Non-loopback requires https AND host on explicit allowlist (no open proxy).
		if ($scheme !== 'https') {
			return false;
		}
		$allowed = self::allowed_hosts();
		return in_array($host, $allowed, true);
	}

	/** @return list<string> */
	public static function allowed_hosts(): array {
		$s = self::get();
		$raw = (string) ($s['allowed_session_hosts'] ?? '');
		$hosts = [];
		foreach (preg_split('/[\s,]+/', $raw) ?: [] as $h) {
			$h = strtolower(trim($h));
			if ($h !== '' && preg_match('/^[a-z0-9.-]+$/', $h)) {
				$hosts[] = $h;
			}
		}
		return array_values(array_unique($hosts));
	}

	public static function ensure_site_id(): string {
		$s = self::get();
		if (!empty($s['site_id'])) {
			return (string) $s['site_id'];
		}
		$home = function_exists('home_url') ? home_url('/') : 'http://localhost/';
		$hash = substr(hash('sha256', $home), 0, 16);
		$id = 'wp-' . $hash;
		$s['site_id'] = $id;
		update_option(self::OPTION, $s, false);
		return $id;
	}
}
