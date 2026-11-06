<?php
declare(strict_types=1);
/**
 * Plugin → real Session HTTP + Latte same-revision evidence.
 * Run: /workspace/bin/php adapters/wordpress/tests/plugin-http-integration.php
 */
require __DIR__ . '/wp-stubs.php';

$outDir = getenv('M7_OUT') ?: '/workspace/var/phpingineer/logs/m7-e2e';
@mkdir($outDir, 0775, true);

$sessionUrl = getenv('SESSION_API_URL') ?: 'http://127.0.0.1:18090';
$preservedSession = getenv('M7_SESSION_ID') ?: 'sess-dcfe3398319aee1e';
$preservedPage = getenv('M7_PAGE_ID') ?: 'page-5975af4003592b2c';
$authUser = getenv('BUILDY_BASIC_AUTH_USER') ?: '';
$authPass = getenv('BUILDY_BASIC_AUTH_PASS') ?: '';

$GLOBALS['__BUILDY_OPTS'] = [
	'buildytech_si_chat_settings' => [
		'session_base_url' => $sessionUrl,
		'basic_auth_user' => $authUser,
		'basic_auth_pass' => $authPass,
		'agent_page_slug' => 'buildy-agent-chat',
		'bound_session_id' => $preservedSession,
		'bound_page_id' => $preservedPage,
		'node_bin' => getenv('NODE_BIN') ?: 'node',
		'php_bin' => getenv('PHP_BIN') ?: '/workspace/bin/php',
		'latte_vendor_autoload' => getenv('M5_LATTE_VENDOR')
			? rtrim(getenv('M5_LATTE_VENDOR'), '/') . '/autoload.php'
			: '/workspace/wpfasty-agpl/themes/latte/vendor/autoload.php',
		'allow_public_publish' => false,
	],
];

define('BUILDYTECH_SI_CHAT_VERSION', '0.1.0');
define('BUILDYTECH_SI_CHAT_FILE', dirname(__DIR__) . '/buildytech-si-chat.php');
define('BUILDYTECH_SI_CHAT_DIR', dirname(__DIR__) . '/');
define('BUILDYTECH_SI_CHAT_URL', 'http://127.0.0.1:8088/wp-content/plugins/buildytech-si-chat/');

require BUILDYTECH_SI_CHAT_DIR . 'includes/class-settings.php';
require BUILDYTECH_SI_CHAT_DIR . 'includes/class-session-client.php';
require BUILDYTECH_SI_CHAT_DIR . 'includes/class-rest-controller.php';
require BUILDYTECH_SI_CHAT_DIR . 'includes/class-latte-renderer.php';

$results = ['ok' => true, 'steps' => []];
function step(array &$results, string $name, bool $pass, $detail = null): void {
	$results['steps'][] = ['name' => $name, 'pass' => $pass, 'detail' => $detail];
	if (!$pass) {
		$results['ok'] = false;
	}
	echo ($pass ? 'PASS' : 'FAIL') . " $name " . json_encode($detail, JSON_UNESCAPED_UNICODE) . "\n";
}

$ctrl = new Buildytech_Si_Chat_Rest_Controller();

// 1) health / capabilities via plugin client
$health = $ctrl->health();
step($results, 'plugin_health', $health->status === 200, $health->data);

// 2) get preserved session (conversation reload)
$sess = $ctrl->get_session(new WP_REST_Request(['id' => $preservedSession]));
$sessOk = $sess->status === 200
	&& ($sess->data['session']['id'] ?? '') === $preservedSession
	&& ($sess->data['session']['pageId'] ?? '') === $preservedPage;
step($results, 'reload_preserved_session', $sessOk, [
	'status' => $sess->status,
	'pageId' => $sess->data['session']['pageId'] ?? null,
	'revision' => $sess->data['page']['revision'] ?? null,
]);

// 3) get page by id
$page = $ctrl->get_page(new WP_REST_Request(['id' => $preservedPage]));
$pageOk = $page->status === 200 && ($page->data['id'] ?? '') === $preservedPage
	&& ($page->data['status'] ?? '') === 'draft';
step($results, 'get_draft_page', $pageOk, [
	'status' => $page->status,
	'slug' => $page->data['slug'] ?? null,
	'pageStatus' => $page->data['status'] ?? null,
]);

// 4) publish blocked
$pub = $ctrl->publish_blocked();
step($results, 'publish_blocked', $pub->status === 403, $pub->data);

// 5) conversation vs save: create acceptance session, chat-only message, ensure no page bind
$created = $ctrl->create_session(new WP_REST_Request([], [
	'slugIntent' => 'm7-accept-' . substr(bin2hex(random_bytes(3)), 0, 6),
	'title' => 'M7 acceptance',
]));
$newId = $created->data['session']['id'] ?? '';
step($results, 'create_acceptance_session', $created->status === 201 && $newId !== '', [
	'status' => $created->status,
	'id' => $newId,
]);
if ($newId) {
	$msg = $ctrl->post_message(new WP_REST_Request(
		['id' => $newId],
		['content' => 'chat only — do not save page'],
		['idempotency-key' => 'm7-chat-' . $newId]
	));
	$after = $ctrl->get_session(new WP_REST_Request(['id' => $newId]));
	$bound = (bool)($after->data['session']['pageBound'] ?? false);
	step($results, 'conversation_no_page', $msg->status < 300 && !$bound, [
		'msgStatus' => $msg->status,
		'pageBound' => $bound,
	]);
}

// 6) idempotent retry of same chat key
if ($newId) {
	$msg2 = $ctrl->post_message(new WP_REST_Request(
		['id' => $newId],
		['content' => 'chat only — do not save page'],
		['idempotency-key' => 'm7-chat-' . $newId]
	));
	step($results, 'idempotent_retry', $msg2->status < 300, ['status' => $msg2->status]);
}

// 7) slug collision via plugin create
$slug = 'm7-slug-collision';
$doc1 = $page->data;
$doc1['id'] = 'page-m7a' . substr(bin2hex(random_bytes(2)), 0, 4);
$doc1['slug'] = $slug;
$doc1['status'] = 'draft';
$c1 = $ctrl->create_page(new WP_REST_Request([], ['page' => $doc1]));
$doc2 = $doc1;
$doc2['id'] = 'page-m7b' . substr(bin2hex(random_bytes(2)), 0, 4);
$c2 = $ctrl->create_page(new WP_REST_Request([], ['page' => $doc2]));
step($results, 'slug_collision', $c1->status === 201 && $c2->status === 409, [
	'first' => $c1->status,
	'second' => $c2->status,
]);

// 8) Latte same revision as Session draft
try {
	$latte = Buildytech_Si_Chat_Latte_Renderer::render_page_id($preservedPage);
	step($results, 'latte_same_revision', !empty($latte['ok']) && !empty($latte['sameRevision']), [
		'pageId' => $latte['pageId'] ?? null,
		'revision' => $latte['revision'] ?? null,
		'sessionRevision' => $latte['sessionRevision'] ?? null,
		'htmlSha256' => $latte['htmlSha256'] ?? null,
		'pageLatteSha256' => $latte['pageLatteSha256'] ?? null,
		'draftId' => $latte['draftId'] ?? null,
		'status' => $latte['status'] ?? null,
	]);
	file_put_contents($outDir . '/plugin-latte-meta.json', json_encode($latte, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n");
} catch (Throwable $e) {
	step($results, 'latte_same_revision', false, ['error' => $e->getMessage()]);
}

file_put_contents($outDir . '/plugin-http-integration.json', json_encode($results, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n");
echo json_encode(['ok' => $results['ok'], 'out' => $outDir], JSON_UNESCAPED_UNICODE) . "\n";
exit($results['ok'] ? 0 : 1);
