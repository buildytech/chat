/**
 * Shared demo fixtures. Russian text is written as \u escapes (repo rule: no Cyrillic in code).
 */

// "naidi v biblioteke podkhodyashchii maket dlya dashboard paneli zadach i proektov i zapolni ee
//  feikovymi dannymi na russkom yazyke" (the owner's real prompt).
export const RU_DEMO_PROMPT =
	"\u043d\u0430\u0439\u0434\u0438 \u0432 \u0431\u0438\u0431\u043b\u0438\u043e\u0442\u0435\u043a\u0435 \u043f\u043e\u0434\u0445\u043e\u0434\u044f\u0449\u0438\u0439 \u043c\u0430\u043a\u0435\u0442 \u0434\u043b\u044f dashboard \u043f\u0430\u043d\u0435\u043b\u0438 \u0437\u0430\u0434\u0430\u0447 \u0438 \u043f\u0440\u043e\u0435\u043a\u0442\u043e\u0432 \u0438 \u0437\u0430\u043f\u043e\u043b\u043d\u0438 \u0435\u0435 \u0444\u0435\u0439\u043a\u043e\u0432\u044b\u043c\u0438 \u0434\u0430\u043d\u043d\u044b\u043c\u0438 \u043d\u0430 \u0440\u0443\u0441\u0441\u043a\u043e\u043c \u044f\u0437\u044b\u043a\u0435";

// Same request without the demo-data clause.
export const RU_PLAIN_PROMPT =
	"\u043d\u0430\u0439\u0434\u0438 \u0432 \u0431\u0438\u0431\u043b\u0438\u043e\u0442\u0435\u043a\u0435 \u043f\u043e\u0434\u0445\u043e\u0434\u044f\u0449\u0438\u0439 \u043c\u0430\u043a\u0435\u0442 \u0434\u043b\u044f dashboard \u043f\u0430\u043d\u0435\u043b\u0438 \u0437\u0430\u0434\u0430\u0447 \u0438 \u043f\u0440\u043e\u0435\u043a\u0442\u043e\u0432";

// "zapolni testovymi dannymi" (fill with test data)
export const RU_TEST_DATA = "\u0437\u0430\u043f\u043e\u043b\u043d\u0438 \u0442\u0435\u0441\u0442\u043e\u0432\u044b\u043c\u0438 \u0434\u0430\u043d\u043d\u044b\u043c\u0438";
// "sdelai demo-dannye" (make demo data)
export const RU_DEMO_DATA = "\u0441\u0434\u0435\u043b\u0430\u0439 \u0434\u0435\u043c\u043e-\u0434\u0430\u043d\u043d\u044b\u0435";
// "dlya testov" (for tests) - not a data request on its own
export const RU_FOR_TESTS = "\u0441\u0434\u0435\u043b\u0430\u0439 \u0434\u0430\u0448\u0431\u043e\u0440\u0434 \u0434\u043b\u044f \u0442\u0435\u0441\u0442\u043e\u0432 \u043a\u043e\u043c\u0430\u043d\u0434\u044b";

// Model copy: "Zadachi i proekty", "Aktivnye zadachi", "Proekty", "Demo-dannye", ...
export const RU = {
	title: "\u0417\u0430\u0434\u0430\u0447\u0438 \u0438 \u043f\u0440\u043e\u0435\u043a\u0442\u044b",
	activeTasks: "\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0435 \u0437\u0430\u0434\u0430\u0447\u0438",
	projects: "\u041f\u0440\u043e\u0435\u043a\u0442\u044b",
	tasks: "\u0417\u0430\u0434\u0430\u0447\u0438",
	team: "\u041a\u043e\u043c\u0430\u043d\u0434\u0430",
	demo: "\u0414\u0435\u043c\u043e-\u0434\u0430\u043d\u043d\u044b\u0435",
	monday: "\u041f\u043d",
	tuesday: "\u0412\u0442",
	wednesday: "\u0421\u0440",
	done: "\u0417\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u043e",
	overdue: "\u041f\u0440\u043e\u0441\u0440\u043e\u0447\u0435\u043d\u043e",
	event: "\u0417\u0430\u0434\u0430\u0447\u0430 \u0437\u0430\u043a\u0440\u044b\u0442\u0430",
	ago: "2 \u0447 \u043d\u0430\u0437\u0430\u0434",
	lede: "\u0421\u0432\u043e\u0434\u043a\u0430 \u043f\u043e \u0437\u0430\u0434\u0430\u0447\u0430\u043c \u0438 \u043f\u0440\u043e\u0435\u043a\u0442\u0430\u043c"
} as const;

/** propose_layout args a model would send for the Russian demo prompt. */
export function ruDashboardArgs(): Record<string, unknown> {
	return {
		brief: "Dashboard for tasks and projects with demo data in Russian",
		scenarioId: "dashboard",
		screenId: "screen.theme-dashboard-console/home",
		title: RU.title,
		locale: "ru",
		demoData: true,
		demoLabel: RU.demo,
		blocks: [
			{
				kind: "nav",
				brand: RU.title,
				items: [{ label: RU.projects }, { label: RU.tasks }, { label: RU.team }]
			},
			{ kind: "pagehead", headline: RU.title, lede: RU.lede },
			{
				kind: "overview",
				title: RU.projects,
				items: [
					{ label: RU.projects, value: "12" },
					{ label: RU.activeTasks, value: "148" }
				]
			},
			{
				kind: "metrics",
				items: [
					{ label: RU.done, value: "94%", note: "+6%" },
					{ label: RU.overdue, value: "7", note: "-2" }
				]
			},
			{
				kind: "chart",
				lede: RU.lede,
				items: [
					{ label: RU.monday, value: "18" },
					{ label: RU.tuesday, value: "24" },
					{ label: RU.wednesday, value: "9" }
				]
			},
			{ kind: "activity", items: [{ label: RU.event, detail: RU.team, note: RU.ago }] },
			{ kind: "invented-widget", headline: "should be dropped" }
		]
	};
}

// Follow-up turns (round 3): sidebar add/remove, demo opt-out, footer request, sidenav copy.
export const RU_ADD_SIDEBAR = "\u043d\u0435\u0442\u0443 \u0441\u0430\u0439\u0434\u0431\u0430\u0440\u0430 \u0432 dashboard. \u0434\u043e\u0431\u0430\u0432\u044c";
export const RU_REMOVE_BOTTOM = "\u0443\u0431\u0435\u0440\u0438 \u043d\u0438\u0436\u043d\u0435\u0435 \u043c\u0435\u043d\u044e";
export const RU_NO_DEMO = "\u0443\u0431\u0435\u0440\u0438 \u0434\u0435\u043c\u043e-\u0434\u0430\u043d\u043d\u044b\u0435, \u043d\u0443\u0436\u043d\u044b \u0440\u0435\u0430\u043b\u044c\u043d\u044b\u0435 \u0434\u0430\u043d\u043d\u044b\u0435";
export const RU_ADD_FOOTER = "\u0434\u043e\u0431\u0430\u0432\u044c \u043f\u043e\u0434\u0432\u0430\u043b";
export const RU_NAV_SIDE = "\u041d\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u044f";
export const RU_WORKSPACE = "\u0420\u0430\u0431\u043e\u0447\u0435\u0435 \u043f\u0440\u043e\u0441\u0442\u0440\u0430\u043d\u0441\u0442\u0432\u043e";
export const RU_REPORTS = "\u041e\u0442\u0447\u0451\u0442\u044b";
export const RU_HOME = "\u0413\u043b\u0430\u0432\u043d\u0430\u044f";
export const RU_RENAMED = "\u041b\u0435\u043d\u0442\u0430 \u0441\u043e\u0431\u044b\u0442\u0438\u0439";
