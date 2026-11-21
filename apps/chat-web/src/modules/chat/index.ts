/**
 * The chat module (ADR 0041): Ask / Build conversation with the model, the proposals it makes, its settings and
 * `ext.chat` of a project. The only file the app loads (`src/modules/index.ts`); everything else of the module is
 * reached through this definition.
 */
import "./chat.css";
import { retainTraces } from "./core/trace-retention.ts";
import { MessageSquare } from "$lib/shell-icons";
import { t } from "$lib/i18n/dictionary";
import type { BuilderModule } from "$lib/modules/types";
import enMessages from "./i18n/en.json";
import ruMessages from "./i18n/ru.json";
import { getSelectedModelId, setSelectedModelId } from "./browser/models.svelte.ts";
import { hydrateSessionContext } from "./browser/onboarding.svelte.ts";
import { beforeHydrate, beforeProjectChange, getChatMode, projectOpened, recoverInterruptedRuns, run, setChatMode } from "./core/chat.svelte.ts";
import { chatOf } from "./core/view";
import BlockScopeAction from "./ui/BlockScopeAction.svelte";
import ChatPanel from "./ui/ChatPanel.svelte";
import MediaInspector from "./ui/MediaInspector.svelte";
import ProposalReview from "./ui/ProposalReview.svelte";

export const chatModule: BuilderModule = {
	id: "chat",
	prepareProjectSave: retainTraces,
	messages: { en: enMessages.messages, ru: ruMessages.messages },
	messageOverrides: { en: enMessages.overrides, ru: ruMessages.overrides },
	newProject: () => ({ title: t("thread.untitled"), ext: { chat: { messages: [], mode: run.pendingMode } } }),
	tabs: [{ id: "chat", labelKey: "leftPanel.chat", icon: MessageSquare, panel: ChatPanel }],
	leftSurface: { icon: MessageSquare, tabKey: "shell.tabChat", regionKey: "shell.chatColumn", hideKey: "workspace.hideChat", showKey: "workspace.showChat" },
	slots: { "preview.review": ProposalReview, "block.actions": BlockScopeAction, "inspector.block": MediaInspector },
	hasActivity: (project) => Boolean(project && chatOf(project)?.messages?.length),
	editorMode: getChatMode,
	sessionSettings: {
		read: () => ({ selectedModelId: getSelectedModelId() }),
		apply: (settings) => {
			if (settings.selectedModelId) setSelectedModelId(settings.selectedModelId);
		}
	},
	hooks: {
		beforeProjectChange,
		projectOpened,
		beforeHydrate,
		afterHydrate: () => recoverInterruptedRuns(),
		pageStarted: (screenId) => {
			setChatMode("build");
			hydrateSessionContext({ scenarioId: null, screenId });
		}
	}
};
