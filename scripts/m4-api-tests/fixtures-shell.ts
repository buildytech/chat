/**
 * Recorded live tool arguments (2026-11-09, local runtime, xAI API) for the owner's shell prompts
 * and English / Spanish variants, one entry per enabled model. Copy fields are omitted; intent
 * fields, search args and the screen the model proposed are kept verbatim.
 */
export type ShellFixture = {
	model: string;
	prompt: "owner_ru" | "owner_followup" | "en" | "es";
	brief: string;
	search: Array<Record<string, unknown>>;
	propose: { screenId?: string; locale: string; demoData?: boolean; requireBlocks?: string[]; remove?: string[]; newPage?: boolean };
};

export const SHELL_FIXTURES: ShellFixture[] = [
	{
		"model": "grok-4.20-0309-non-reasoning",
		"prompt": "owner_ru",
		"brief": "\u043d\u0430\u0439\u0434\u0438 \u0432 \u0431\u0438\u0431\u043b\u0438\u043e\u0442\u0435\u043a\u0435 \u043f\u043e\u0434\u0445\u043e\u0434\u044f\u0449\u0438\u0439 \u043c\u0430\u043a\u0435\u0442 \u0434\u043b\u044f dashboard \u043f\u0430\u043d\u0435\u043b\u0438 \u0437\u0430\u0434\u0430\u0447 \u0438 \u043f\u0440\u043e\u0435\u043a\u0442\u043e\u0432. \u0437\u0430\u043f\u043e\u043b\u043d\u0438 \u0435\u0435 \u0444\u0435\u0439\u043a\u043e\u0432\u044b\u043c\u0438 \u0434\u0430\u043d\u043d\u044b\u043c\u0438 \u043d\u0430 \u0440\u0443\u0441\u0441\u043a\u043e\u043c \u044f\u0437\u044b\u043a\u0435. \u0441\u043a\u043e\u0440\u0435\u0435 \u0432\u0441\u0435\u0433\u043e \u043d\u0443\u0436\u043d\u043e \u0432\u044b\u0431\u0438\u0440\u0430\u0442\u044c \u0438\u0437 \u0442\u0435\u0445, \u0433\u0434\u0435 \u0443\u0436\u0435 \u0432\u0441\u0442\u0440\u043e\u0435\u043d Shell \u0441\u0430\u0439\u0434\u0431\u0430\u0440",
		"search": [
			{
				"q": "dashboard tasks projects shell sidenav kanban",
				"section": "dashboard",
				"blocks": [
					"dashshell",
					"sidenav",
					"kanban",
					"overview",
					"metrics",
					"chart",
					"activity"
				]
			}
		],
		"propose": {
			"screenId": "screen.theme-dashboard-console/home",
			"locale": "ru",
			"demoData": true,
			"requireBlocks": [
				"sidenav",
				"kanban"
			],
			"remove": [
				"bottomnav",
				"footer"
			],
			"newPage": true
		}
	},
	{
		"model": "grok-4.20-0309-non-reasoning",
		"prompt": "owner_followup",
		"brief": "\u0438\u0449\u0438 \u043f\u043e \u0437\u0430\u043f\u0440\u043e\u0441\u0443 `shell`",
		"search": [
			{
				"q": "shell"
			}
		],
		"propose": {
			"screenId": "screen.theme-dashboard-console/home",
			"locale": "ru",
			"demoData": false
		}
	},
	{
		"model": "grok-4.20-0309-non-reasoning",
		"prompt": "en",
		"brief": "Find a dashboard layout for tasks and projects that already has an app shell with a sidebar, and fill it with fake data in English.",
		"search": [
			{
				"q": "dashboard tasks projects app shell sidebar",
				"section": "dashboard",
				"blocks": [
					"dashshell",
					"sidenav",
					"kanban",
					"projects",
					"overview",
					"metrics",
					"chart",
					"activity"
				]
			}
		],
		"propose": {
			"screenId": "screen.theme-dashboard-console/home",
			"locale": "en",
			"demoData": true,
			"requireBlocks": [
				"sidenav",
				"dashshell",
				"kanban",
				"projects"
			],
			"newPage": true
		}
	},
	{
		"model": "grok-4.20-0309-non-reasoning",
		"prompt": "es",
		"brief": "Busca una plantilla de panel para tareas y proyectos que ya tenga barra lateral de navegaci\u00f3n y ll\u00e9nala con datos de ejemplo en espa\u00f1ol.",
		"search": [
			{
				"q": "dashboard tasks projects kanban sidenav",
				"section": "dashboard",
				"job": "dashboard",
				"blocks": [
					"sidenav",
					"kanban"
				]
			}
		],
		"propose": {
			"screenId": "screen.theme-dashboard-console/home",
			"locale": "es",
			"demoData": true,
			"requireBlocks": [
				"sidenav",
				"kanban"
			],
			"remove": [
				"bottomnav",
				"footer"
			],
			"newPage": true
		}
	},
	{
		"model": "grok-4.20-0309-reasoning",
		"prompt": "owner_ru",
		"brief": "\u043d\u0430\u0439\u0434\u0438 \u0432 \u0431\u0438\u0431\u043b\u0438\u043e\u0442\u0435\u043a\u0435 \u043f\u043e\u0434\u0445\u043e\u0434\u044f\u0449\u0438\u0439 \u043c\u0430\u043a\u0435\u0442 \u0434\u043b\u044f dashboard \u043f\u0430\u043d\u0435\u043b\u0438 \u0437\u0430\u0434\u0430\u0447 \u0438 \u043f\u0440\u043e\u0435\u043a\u0442\u043e\u0432. \u0437\u0430\u043f\u043e\u043b\u043d\u0438 \u0435\u0435 \u0444\u0435\u0439\u043a\u043e\u0432\u044b\u043c\u0438 \u0434\u0430\u043d\u043d\u044b\u043c\u0438 \u043d\u0430 \u0440\u0443\u0441\u0441\u043a\u043e\u043c \u044f\u0437\u044b\u043a\u0435. \u0441\u043a\u043e\u0440\u0435\u0435 \u0432\u0441\u0435\u0433\u043e \u043d\u0443\u0436\u043d\u043e \u0432\u044b\u0431\u0438\u0440\u0430\u0442\u044c \u0438\u0437 \u0442\u0435\u0445, \u0433\u0434\u0435 \u0443\u0436\u0435 \u0432\u0441\u0442\u0440\u043e\u0435\u043d Shell \u0441\u0430\u0439\u0434\u0431\u0430\u0440",
		"search": [
			{
				"q": "dashboard tasks projects kanban shell sidenav",
				"section": "dashboard",
				"blocks": [
					"dashshell",
					"sidenav",
					"kanban",
					"projects"
				],
				"page": 1
			}
		],
		"propose": {
			"screenId": "screen.theme-dashboard-console/home",
			"locale": "ru",
			"demoData": true,
			"requireBlocks": [
				"sidenav",
				"dashshell",
				"kanban",
				"projects"
			],
			"newPage": true
		}
	},
	{
		"model": "grok-4.20-0309-reasoning",
		"prompt": "owner_followup",
		"brief": "\u0438\u0449\u0438 \u043f\u043e \u0437\u0430\u043f\u0440\u043e\u0441\u0443 `shell`",
		"search": [
			{
				"q": "shell"
			}
		],
		"propose": {
			"screenId": "screen.theme-dashboard-console/home",
			"locale": "ru"
		}
	},
	{
		"model": "grok-4.20-0309-reasoning",
		"prompt": "en",
		"brief": "Find a dashboard layout for tasks and projects that already has an app shell with a sidebar, and fill it with fake data in English.",
		"search": [
			{
				"q": "dashboard tasks projects sidebar shell",
				"section": "dashboard",
				"blocks": [
					"dashshell",
					"sidenav",
					"kanban"
				]
			}
		],
		"propose": {
			"screenId": "screen.theme-dashboard-console/layouts",
			"locale": "en",
			"demoData": true,
			"requireBlocks": [
				"sidenav",
				"dashshell"
			],
			"newPage": true
		}
	},
	{
		"model": "grok-4.20-0309-reasoning",
		"prompt": "es",
		"brief": "Busca una plantilla de panel para tareas y proyectos que ya tenga barra lateral de navegaci\u00f3n y ll\u00e9nala con datos de ejemplo en espa\u00f1ol.",
		"search": [
			{
				"q": "dashboard kanban sidenav tasks projects",
				"section": "dashboard",
				"job": "dashboard",
				"blocks": [
					"sidenav",
					"kanban"
				]
			}
		],
		"propose": {
			"screenId": "screen.theme-dashboard-console/home",
			"locale": "es",
			"demoData": true,
			"requireBlocks": [
				"sidenav"
			],
			"newPage": true
		}
	},
	{
		"model": "grok-build-0.1",
		"prompt": "owner_ru",
		"brief": "\u043d\u0430\u0439\u0434\u0438 \u0432 \u0431\u0438\u0431\u043b\u0438\u043e\u0442\u0435\u043a\u0435 \u043f\u043e\u0434\u0445\u043e\u0434\u044f\u0449\u0438\u0439 \u043c\u0430\u043a\u0435\u0442 \u0434\u043b\u044f dashboard \u043f\u0430\u043d\u0435\u043b\u0438 \u0437\u0430\u0434\u0430\u0447 \u0438 \u043f\u0440\u043e\u0435\u043a\u0442\u043e\u0432. \u0437\u0430\u043f\u043e\u043b\u043d\u0438 \u0435\u0435 \u0444\u0435\u0439\u043a\u043e\u0432\u044b\u043c\u0438 \u0434\u0430\u043d\u043d\u044b\u043c\u0438 \u043d\u0430 \u0440\u0443\u0441\u0441\u043a\u043e\u043c \u044f\u0437\u044b\u043a\u0435. \u0441\u043a\u043e\u0440\u0435\u0435 \u0432\u0441\u0435\u0433\u043e \u043d\u0443\u0436\u043d\u043e \u0432\u044b\u0431\u0438\u0440\u0430\u0442\u044c \u0438\u0437 \u0442\u0435\u0445, \u0433\u0434\u0435 \u0443\u0436\u0435 \u0432\u0441\u0442\u0440\u043e\u0435\u043d Shell \u0441\u0430\u0439\u0434\u0431\u0430\u0440",
		"search": [
			{
				"q": "dashboard shell sidenav kanban projects tasks overview metrics activity",
				"section": "dashboard",
				"job": "dashboard",
				"blocks": [
					"dashshell",
					"sidenav",
					"kanban",
					"projects",
					"overview",
					"metrics",
					"activity"
				],
				"page": 1
			}
		],
		"propose": {
			"screenId": "screen.theme-dashboard-console/home",
			"locale": "ru",
			"demoData": true,
			"requireBlocks": [
				"sidenav",
				"overview",
				"metrics",
				"activity",
				"dashshell",
				"kanban",
				"projects"
			],
			"newPage": true
		}
	},
	{
		"model": "grok-build-0.1",
		"prompt": "owner_followup",
		"brief": "\u0438\u0449\u0438 \u043f\u043e \u0437\u0430\u043f\u0440\u043e\u0441\u0443 `shell`",
		"search": [
			{
				"q": "shell",
				"page": 1
			}
		],
		"propose": {
			"screenId": "screen.theme-dashboard-console/home",
			"locale": "ru",
			"newPage": true
		}
	},
	{
		"model": "grok-build-0.1",
		"prompt": "en",
		"brief": "Find a dashboard layout for tasks and projects that already has an app shell with a sidebar, and fill it with fake data in English.",
		"search": [
			{
				"q": "dashboard tasks projects shell sidenav kanban",
				"section": "dashboard",
				"job": "dashboard",
				"blocks": [
					"sidenav",
					"dashshell",
					"overview",
					"kanban",
					"projects"
				],
				"page": 1
			}
		],
		"propose": {
			"screenId": "screen.theme-dashboard-console/layouts",
			"locale": "en",
			"demoData": true,
			"requireBlocks": [
				"sidenav"
			],
			"newPage": true
		}
	},
	{
		"model": "grok-build-0.1",
		"prompt": "es",
		"brief": "Busca una plantilla de panel para tareas y proyectos que ya tenga barra lateral de navegaci\u00f3n y ll\u00e9nala con datos de ejemplo en espa\u00f1ol.",
		"search": [
			{
				"q": "dashboard tasks projects kanban sidenav",
				"section": "dashboard",
				"job": "dashboard",
				"blocks": [
					"sidenav",
					"kanban",
					"projects"
				],
				"page": 1
			}
		],
		"propose": {
			"screenId": "screen.theme-dashboard-console/home",
			"locale": "es",
			"demoData": true,
			"requireBlocks": [
				"sidenav"
			],
			"newPage": true
		}
	}
];
