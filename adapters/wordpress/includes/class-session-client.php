<?php
declare(strict_types=1);

/**
 * Server-side Session HTTP client. Holds BasicAuth; never exposed to browser.
 */
final class Buildytech_Si_Chat_Session_Client {
	private string $base;
	private string $user;
	private string $pass;
	private string $siteId;
	private string $siteToken;

	public function __construct(?array $settings = null) {
		$s = $settings ?? Buildytech_Si_Chat_Settings::get();
		$this->base = rtrim((string) ($s['session_base_url'] ?? ''), '/');
		$this->user = (string) ($s['basic_auth_user'] ?? '');
		$this->pass = (string) ($s['basic_auth_pass'] ?? '');
		$this->siteId = (string) ($s['site_id'] ?? '');
		if ($this->siteId === '' && class_exists('Buildytech_Si_Chat_Settings')) {
			$this->siteId = Buildytech_Si_Chat_Settings::ensure_site_id();
		}
		$this->siteToken = (string) ($s['site_token'] ?? '');
		if (!Buildytech_Si_Chat_Settings::is_allowed_session_url($this->base)) {
			throw new RuntimeException('session_base_url not allowed');
		}
	}

	/**
	 * @return array{code:int,body:string,json:?array}
	 */
	public function request(string $method, string $path, ?array $json = null, array $extra_headers = []): array {
		$path = '/' . ltrim($path, '/');
		if (!str_starts_with($path, '/v1/') && $path !== '/healthz') {
			throw new InvalidArgumentException('only /v1/* and /healthz allowed');
		}
		$url = $this->base . $path;
		$headers = [
			'Accept' => 'application/json',
			'Host' => $this->host_header(),
		];
		if ($this->user !== '' && $this->pass !== '') {
			$headers['Authorization'] = 'Basic ' . base64_encode($this->user . ':' . $this->pass);
		}
		if ($this->siteId !== '') {
			$headers['X-BuildY-Site-Id'] = $this->siteId;
		}
		if ($this->siteToken !== '') {
			$headers['X-BuildY-Site-Token'] = $this->siteToken;
		}
		foreach ($extra_headers as $k => $v) {
			$headers[$k] = $v;
		}
		$args = [
			'method' => strtoupper($method),
			'timeout' => 30,
			'redirection' => 0,
			'headers' => $headers,
		];
		if ($json !== null) {
			$args['headers']['Content-Type'] = 'application/json';
			$args['body'] = wp_json_encode($json);
		}
		$res = wp_remote_request($url, $args);
		if (is_wp_error($res)) {
			return ['code' => 502, 'body' => $res->get_error_message(), 'json' => null];
		}
		$code = (int) wp_remote_retrieve_response_code($res);
		$body = (string) wp_remote_retrieve_body($res);
		$decoded = null;
		if ($body !== '') {
			$decoded = json_decode($body, true);
			if (!is_array($decoded)) {
				$decoded = null;
			}
		}
		return ['code' => $code, 'body' => $body, 'json' => $decoded];
	}

	private function host_header(): string {
		$p = wp_parse_url($this->base);
		$host = (string) ($p['host'] ?? '127.0.0.1');
		if (!empty($p['port'])) {
			$host .= ':' . $p['port'];
		}
		return $host;
	}
}
