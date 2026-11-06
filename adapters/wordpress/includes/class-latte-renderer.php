<?php
declare(strict_types=1);

/**
 * Latte HTML for a page id at the Session revision (exact latteFromPage emitter via Node).
 */
final class Buildytech_Si_Chat_Latte_Renderer {
	/**
	 * @return array<string,mixed>
	 */
	public static function render_page_id(string $pageId): array {
		if (!preg_match('/^[a-z][a-z0-9-]{0,62}$/', $pageId)) {
			throw new InvalidArgumentException('invalid page id');
		}
		$client = new Buildytech_Si_Chat_Session_Client();
		$r = $client->request('GET', '/v1/pages/' . rawurlencode($pageId));
		if ($r['code'] !== 200 || !isset($r['json']['page'])) {
			throw new RuntimeException('page fetch failed: HTTP ' . $r['code']);
		}
		$page = $r['json']['page'];
		$revision = $r['json']['revision'] ?? null;
		$settings = Buildytech_Si_Chat_Settings::get();
		$emit = BUILDYTECH_SI_CHAT_DIR . 'bin/emit-latte.mjs';
		if (!is_readable($emit)) {
			throw new RuntimeException('emit-latte.mjs missing');
		}
		$tmp = sys_get_temp_dir() . '/buildytech-latte-' . $pageId . '-' . getmypid();
		if (!mkdir($tmp) && !is_dir($tmp)) {
			throw new RuntimeException('tmpdir');
		}
		$pageJson = $tmp . '/page.json';
		file_put_contents($pageJson, wp_json_encode([
			'page' => $page,
			'revision' => $revision,
		]));
		$outDir = $tmp . '/out';
		mkdir($outDir);
		$node = $settings['node_bin'] ?: 'node';
		$php = $settings['php_bin'] ?: PHP_BINARY;
		$autoload = $settings['latte_vendor_autoload'];
		if ($autoload === '' || !is_readable($autoload)) {
			$candidates = [
				BUILDYTECH_SI_CHAT_DIR . 'vendor/autoload.php',
				'/workspace/wpfasty-agpl/themes/latte/vendor/autoload.php',
			];
			foreach ($candidates as $c) {
				if (is_readable($c)) {
					$autoload = $c;
					break;
				}
			}
		}
		if ($autoload === '' || !is_readable($autoload)) {
			throw new RuntimeException('Latte vendor autoload not found');
		}
		$cmd = [
			$node,
			$emit,
			'--page-json', $pageJson,
			'--out', $outDir,
			'--php', $php,
			'--latte-autoload', $autoload,
		];
		$descriptors = [
			0 => ['pipe', 'r'],
			1 => ['pipe', 'w'],
			2 => ['pipe', 'w'],
		];
		$proc = proc_open($cmd, $descriptors, $pipes, BUILDYTECH_SI_CHAT_DIR, null);
		if (!is_resource($proc)) {
			throw new RuntimeException('failed to start emit-latte');
		}
		fclose($pipes[0]);
		$stdout = stream_get_contents($pipes[1]);
		$stderr = stream_get_contents($pipes[2]);
		fclose($pipes[1]);
		fclose($pipes[2]);
		$code = proc_close($proc);
		$metaPath = $outDir . '/render-meta.json';
		if ($code !== 0 || !is_readable($metaPath)) {
			throw new RuntimeException('emit failed code=' . $code . ' stderr=' . substr((string) $stderr, 0, 500));
		}
		$meta = json_decode((string) file_get_contents($metaPath), true);
		if (!is_array($meta)) {
			throw new RuntimeException('bad render-meta');
		}
		$meta['stdout'] = trim((string) $stdout);
		$meta['pluginPageId'] = $pageId;
		$meta['sessionRevision'] = $revision;
		$meta['sameRevision'] = isset($meta['revision']) && (int) $meta['revision'] === (int) $revision;
		$meta['ok'] = !empty($meta['ok']) && !empty($meta['sameRevision']);
		return $meta;
	}
}
