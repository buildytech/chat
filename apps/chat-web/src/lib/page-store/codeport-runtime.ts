/**
 * CodePort Latte dependency pack (browser-safe).
 * Source of truth on disk: apps/chat-web/codeport-pack/
 * Keep in sync — smoke asserts sha256 match.
 */
export const COIMPORT_PACK_FILES: { path: string; content: string }[] = [
	{
		path: "Main/page.latte",
		content: "{* CodePort runtime layout \u2014 required by latteFromPage `{layout 'Main/page.latte'}`. *}\n<!DOCTYPE html>\n<html lang=\"{$page->locale}\">\n<head>\n\t<meta charset=\"utf-8\">\n\t<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n\t<title>{$pageTitle}</title>\n\t{ifset $page->seo}\n\t\t{ifset $page->seo['description']}<meta name=\"description\" content=\"{$page->seo['description']}\">{/ifset}\n\t{/ifset}\n</head>\n<body>\n\t<main data-codeport=\"page\" data-page-id=\"{$page->id}\" data-slug=\"{$page->slug}\" data-status=\"{$page->status}\">\n\t\t{block content}{/block}\n\t</main>\n</body>\n</html>\n"
	},
	{
		path: "codeport-pack/README.md",
		content: "# CodePort Latte runtime pack\n\nTemplates required to **compile** exact `latteFromPage` / CodePane ZIP output with PHP Latte 3.\n\n| Path | Role |\n| --- | --- |\n| `Main/page.latte` | Layout referenced by `{layout 'Main/page.latte'}` in emitted `page.latte` |\n\nPackaged into downloads via `packFilesFromPage` under `runtime/` (see GENERATOR.json).\n"
	}
];
