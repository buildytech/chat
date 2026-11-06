<?php
declare(strict_types=1);

/**
 * One ordinary WP page (unique slug) paired with a persistent Session chat.
 * Draft status only — never auto-publish.
 */
final class Buildytech_Si_Chat_Draft_Binding {
	public static function register(): void {
		add_action('init', [self::class, 'maybe_ensure']);
	}

	public static function maybe_ensure(): void {
		if (!is_admin() || !current_user_can('edit_pages')) {
			return;
		}
		// Lazy ensure on admin; activation hook also calls ensure_agent_page.
	}

	public static function ensure_agent_page(): int {
		$s = Buildytech_Si_Chat_Settings::get();
		$slug = $s['agent_page_slug'] !== '' ? $s['agent_page_slug'] : 'buildy-agent-chat';
		$existing = get_page_by_path($slug);
		if ($existing instanceof WP_Post) {
			update_option('buildytech_si_chat_wp_page_id', (int) $existing->ID, false);
			// Keep draft.
			if ($existing->post_status !== 'draft') {
				wp_update_post([
					'ID' => $existing->ID,
					'post_status' => 'draft',
				]);
			}
			return (int) $existing->ID;
		}
		// Slug collision with non-page? force unique.
		$unique = $slug;
		$i = 2;
		while (get_page_by_path($unique) || get_posts(['name' => $unique, 'post_type' => 'any', 'numberposts' => 1])) {
			$unique = $slug . '-' . $i;
			$i++;
			if ($i > 50) {
				break;
			}
		}
		$id = wp_insert_post([
			'post_title' => 'BuildY Agent Chat',
			'post_name' => $unique,
			'post_status' => 'draft',
			'post_type' => 'page',
			'post_content' => '<!-- buildytech-si-chat agent page; edit via SI Chat admin, not public publish -->',
		], true);
		if (is_wp_error($id)) {
			return 0;
		}
		update_option('buildytech_si_chat_wp_page_id', (int) $id, false);
		if ($unique !== $slug) {
			$s['agent_page_slug'] = $unique;
			update_option(Buildytech_Si_Chat_Settings::OPTION, $s, false);
		}
		return (int) $id;
	}
}
