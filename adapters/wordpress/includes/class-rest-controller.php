<?php
declare(strict_types=1);

/**
 * Same-origin WP REST → Session proxy (PagePort + sessions + draft Latte).
 * Capability: edit_pages. Nonces via cookie auth + X-WP-Nonce.
 */
final class Buildytech_Si_Chat_Rest_Controller {
	private const NS = 'buildytech/v1';

	public function register_routes(): void {
		register_rest_route(self::NS, '/health', [
			'methods' => 'GET',
			'callback' => [$this, 'health'],
			'permission_callback' => [$this, 'can_edit'],
		]);
		register_rest_route(self::NS, '/capabilities', [
			'methods' => 'GET',
			'callback' => [$this, 'capabilities'],
			'permission_callback' => [$this, 'can_edit'],
		]);
		register_rest_route(self::NS, '/pages', [
			[
				'methods' => 'GET',
				'callback' => [$this, 'list_pages'],
				'permission_callback' => [$this, 'can_edit'],
			],
			[
				'methods' => 'POST',
				'callback' => [$this, 'create_page'],
				'permission_callback' => [$this, 'can_edit'],
			],
		]);
		register_rest_route(self::NS, '/pages/(?P<id>[a-z][a-z0-9-]{0,62})', [
			[
				'methods' => 'GET',
				'callback' => [$this, 'get_page'],
				'permission_callback' => [$this, 'can_edit'],
			],
			[
				'methods' => 'PUT',
				'callback' => [$this, 'save_page'],
				'permission_callback' => [$this, 'can_edit'],
			],
		]);
		register_rest_route(self::NS, '/pages/by-slug/(?P<slug>[a-z0-9]+(?:-[a-z0-9]+)*)', [
			'methods' => 'GET',
			'callback' => [$this, 'get_by_slug'],
			'permission_callback' => [$this, 'can_edit'],
		]);
		register_rest_route(self::NS, '/pages/(?P<id>[a-z][a-z0-9-]{0,62})/publish', [
			'methods' => 'POST',
			'callback' => [$this, 'publish_blocked'],
			'permission_callback' => [$this, 'can_edit'],
		]);
		register_rest_route(self::NS, '/pages/(?P<id>[a-z][a-z0-9-]{0,62})/unpublish', [
			'methods' => 'POST',
			'callback' => [$this, 'unpublish'],
			'permission_callback' => [$this, 'can_edit'],
		]);
		register_rest_route(self::NS, '/pages/(?P<id>[a-z][a-z0-9-]{0,62})/preview', [
			'methods' => 'GET',
			'callback' => [$this, 'preview'],
			'permission_callback' => [$this, 'can_edit'],
		]);
		register_rest_route(self::NS, '/pages/(?P<id>[a-z][a-z0-9-]{0,62})/latte-render', [
			'methods' => 'GET',
			'callback' => [$this, 'latte_render'],
			'permission_callback' => [$this, 'can_edit'],
		]);
		register_rest_route(self::NS, '/sessions', [
			[
				'methods' => 'GET',
				'callback' => [$this, 'list_sessions'],
				'permission_callback' => [$this, 'can_edit'],
			],
			[
				'methods' => 'POST',
				'callback' => [$this, 'create_session'],
				'permission_callback' => [$this, 'can_edit'],
			],
		]);
		register_rest_route(self::NS, '/sessions/(?P<id>[a-z][a-z0-9-]{0,62})', [
			'methods' => 'GET',
			'callback' => [$this, 'get_session'],
			'permission_callback' => [$this, 'can_edit'],
		]);
		register_rest_route(self::NS, '/sessions/(?P<id>[a-z][a-z0-9-]{0,62})/messages', [
			[
				'methods' => 'GET',
				'callback' => [$this, 'list_messages'],
				'permission_callback' => [$this, 'can_edit'],
			],
			[
				'methods' => 'POST',
				'callback' => [$this, 'post_message'],
				'permission_callback' => [$this, 'can_edit'],
			],
		]);
		register_rest_route(self::NS, '/binding', [
			'methods' => 'GET',
			'callback' => [$this, 'binding'],
			'permission_callback' => [$this, 'can_edit'],
		]);
	}

	public function can_edit(): bool {
		return current_user_can('edit_pages');
	}

	public function health(): WP_REST_Response {
		try {
			$c = new Buildytech_Si_Chat_Session_Client();
			$r = $c->request('GET', '/v1/capabilities');
			return new WP_REST_Response([
				'ok' => $r['code'] === 200,
				'sessionCode' => $r['code'],
				'plugin' => BUILDYTECH_SI_CHAT_VERSION,
				'publishPolicy' => 'draft_only',
			], $r['code'] === 200 ? 200 : 502);
		} catch (Throwable $e) {
			return new WP_REST_Response(['ok' => false, 'error' => $e->getMessage()], 500);
		}
	}

	public function capabilities(WP_REST_Request $req): WP_REST_Response {
		return $this->proxy('GET', '/v1/capabilities');
	}

	public function list_pages(WP_REST_Request $req): WP_REST_Response {
		// Session has no list-all yet; expose bound page + slug lookup only.
		$s = Buildytech_Si_Chat_Settings::get();
		$out = [];
		if ($s['bound_page_id'] !== '') {
			$r = $this->client()->request('GET', '/v1/pages/' . rawurlencode($s['bound_page_id']));
			if ($r['code'] === 200 && is_array($r['json']['page'] ?? null)) {
				$p = $r['json']['page'];
				$out[] = [
					'id' => $p['id'] ?? '',
					'slug' => $p['slug'] ?? '',
					'title' => $p['title'] ?? '',
					'status' => $p['status'] ?? 'draft',
				];
			}
		}
		return new WP_REST_Response($out, 200);
	}

	public function create_page(WP_REST_Request $req): WP_REST_Response {
		$body = $req->get_json_params();
		if (!is_array($body)) {
			return new WP_REST_Response(['error' => 'invalid_json'], 400);
		}
		$page = $body['page'] ?? $body;
		if (!is_array($page)) {
			return new WP_REST_Response(['error' => 'invalid_page'], 400);
		}
		// Force draft — no public publish via create.
		$page['status'] = 'draft';
		return $this->proxy('POST', '/v1/pages', ['page' => $page]);
	}

	public function get_page(WP_REST_Request $req): WP_REST_Response {
		$id = (string) $req['id'];
		$r = $this->client()->request('GET', '/v1/pages/' . rawurlencode($id));
		if ($r['code'] === 200 && isset($r['json']['page'])) {
			return new WP_REST_Response($r['json']['page'], 200);
		}
		return $this->forward($r);
	}

	public function save_page(WP_REST_Request $req): WP_REST_Response {
		$id = (string) $req['id'];
		$body = $req->get_json_params();
		if (!is_array($body)) {
			return new WP_REST_Response(['error' => 'invalid_json'], 400);
		}
		$page = $body['page'] ?? $body;
		if (!is_array($page)) {
			return new WP_REST_Response(['error' => 'invalid_page'], 400);
		}
		$page['status'] = 'draft';
		$page['id'] = $id;
		$payload = ['page' => $page];
		if (isset($body['revision'])) {
			$payload['revision'] = $body['revision'];
		}
		$headers = [];
		$idem = $req->get_header('idempotency-key');
		if (is_string($idem) && $idem !== '') {
			$payload['idempotencyKey'] = $idem;
		}
		return $this->proxy('PUT', '/v1/pages/' . rawurlencode($id), $payload, $headers);
	}

	public function get_by_slug(WP_REST_Request $req): WP_REST_Response {
		$slug = (string) $req['slug'];
		$r = $this->client()->request('GET', '/v1/slugs/' . rawurlencode($slug));
		if ($r['code'] === 200 && isset($r['json']['page'])) {
			return new WP_REST_Response($r['json']['page'], 200);
		}
		return $this->forward($r);
	}

	public function publish_blocked(): WP_REST_Response {
		return new WP_REST_Response([
			'error' => [
				'code' => 'publish_disabled',
				'message' => 'Public WP publish is disabled. Draft acceptance only (t137u).',
			],
		], 403);
	}

	public function unpublish(WP_REST_Request $req): WP_REST_Response {
		$id = (string) $req['id'];
		$r = $this->client()->request('GET', '/v1/pages/' . rawurlencode($id));
		if ($r['code'] !== 200 || !isset($r['json']['page'])) {
			return $this->forward($r);
		}
		$page = $r['json']['page'];
		$page['status'] = 'draft';
		$rev = $r['json']['revision'] ?? null;
		$payload = ['page' => $page];
		if ($rev !== null) {
			$payload['revision'] = $rev;
		}
		return $this->proxy('PUT', '/v1/pages/' . rawurlencode($id), $payload);
	}

	public function preview(WP_REST_Request $req): WP_REST_Response {
		$id = sanitize_key((string) $req['id']);
		$url = admin_url('admin.php?page=buildytech-si-chat&preview_page=' . rawurlencode($id));
		return new WP_REST_Response(['url' => $url], 200);
	}

	public function latte_render(WP_REST_Request $req): WP_REST_Response {
		$id = (string) $req['id'];
		try {
			$result = Buildytech_Si_Chat_Latte_Renderer::render_page_id($id);
			return new WP_REST_Response($result, !empty($result['ok']) ? 200 : 500);
		} catch (Throwable $e) {
			return new WP_REST_Response(['ok' => false, 'error' => $e->getMessage()], 500);
		}
	}

	public function list_sessions(): WP_REST_Response {
		return $this->proxy('GET', '/v1/sessions');
	}

	public function create_session(WP_REST_Request $req): WP_REST_Response {
		$body = $req->get_json_params();
		if (!is_array($body)) {
			$body = [];
		}
		$allowed = [];
		if (isset($body['slugIntent'])) {
			$allowed['slugIntent'] = sanitize_title((string) $body['slugIntent']);
		}
		if (isset($body['title'])) {
			$allowed['title'] = sanitize_text_field((string) $body['title']);
		}
		return $this->proxy('POST', '/v1/sessions', $allowed);
	}

	public function get_session(WP_REST_Request $req): WP_REST_Response {
		return $this->proxy('GET', '/v1/sessions/' . rawurlencode((string) $req['id']));
	}

	public function list_messages(WP_REST_Request $req): WP_REST_Response {
		return $this->proxy('GET', '/v1/sessions/' . rawurlencode((string) $req['id']) . '/messages');
	}

	public function post_message(WP_REST_Request $req): WP_REST_Response {
		$id = (string) $req['id'];
		$body = $req->get_json_params();
		if (!is_array($body) || !isset($body['content'])) {
			return new WP_REST_Response(['error' => 'content_required'], 400);
		}
		$content = sanitize_textarea_field((string) $body['content']);
		$headers = [];
		$idem = $req->get_header('idempotency-key');
		if (!is_string($idem) || $idem === '') {
			return new WP_REST_Response(['error' => 'idempotency_key_required'], 400);
		}
		$headers['Idempotency-Key'] = preg_replace('/[^a-zA-Z0-9._:-]/', '', $idem) ?? '';
		return $this->proxy('POST', '/v1/sessions/' . rawurlencode($id) . '/messages', [
			'content' => $content,
		], $headers);
	}

	public function binding(): WP_REST_Response {
		$s = Buildytech_Si_Chat_Settings::get();
		$wp_page_id = (int) get_option('buildytech_si_chat_wp_page_id', 0);
		return new WP_REST_Response([
			'agentPageSlug' => $s['agent_page_slug'],
			'wpPageId' => $wp_page_id,
			'boundSessionId' => $s['bound_session_id'],
			'boundPageId' => $s['bound_page_id'],
			'publishPolicy' => 'draft_only',
		], 200);
	}

	private function client(): Buildytech_Si_Chat_Session_Client {
		return new Buildytech_Si_Chat_Session_Client();
	}

	private function proxy(string $method, string $path, ?array $json = null, array $headers = []): WP_REST_Response {
		try {
			$r = $this->client()->request($method, $path, $json, $headers);
			return $this->forward($r);
		} catch (Throwable $e) {
			return new WP_REST_Response(['error' => $e->getMessage()], 500);
		}
	}

	private function forward(array $r): WP_REST_Response {
		$data = $r['json'] ?? ['raw' => $r['body']];
		return new WP_REST_Response($data, $r['code'] >= 100 ? $r['code'] : 502);
	}
}
