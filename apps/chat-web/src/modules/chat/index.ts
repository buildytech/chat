/**
 * The chat module (ADR 0041): Ask / Build conversation with the model, the proposals it makes, its settings and
 * `ext.chat` of a project. The only file the app loads (`src/modules/index.ts`); everything else of the module is
 * reached through this definition.
 */
import "./chat.css";
import { isCollectionDoc } from "@buildytech/page-contract/collection";
import { MessageSquare } from "$lib/shell-icons";
import { noteMigration } from "$lib/browser/storage-v1.ts";
import { t } from "$lib/i18n/dictionary";
import type { BuilderModule } from "$lib/modules/types";
import enMessages from "./i18n/en.json";
import ruMessages from "./i18n/ru.json";
import { getSelectedModelId, setSelectedModelId } from "./browser/models.svelte.ts";
import { takeCollectionParam } from "./browser/collection-intake";
import { hydrateSessionContext } from "./browser/onboarding.svelte.ts";
import { beforeHydrate, beforeProjectChange, getChatMode, projectOpened, run, setChatMode } from "./core/chat.svelte.ts";
import { openCollectionFile, openCollectionParam } from "./core/intake";
import { startPageFromScreen } from "./core/proposal-flow";
import { CHAT_EXTENSION_KEYS, chatOf, normalizeChatExt } from "./core/view";
import BlockScopeAction from "./ui/BlockScopeAction.svelte";
import ChatPanel from "./ui/ChatPanel.svelte";
import ProposalReview from "./ui/ProposalReview.svelte";

export const chatModule: BuilderModule = {
	id: "chat",
	messages: { en: enMessages.messages, ru: ruMessages.messages },
	messageOverrides: { en: enMessages.overrides, ru: ruMessages.overrides },
	projectKeys: CHAT_EXTENSION_KEYS,
	// Old proposal shape (applied boolean only) -> status, on every load and import; each rewrite is counted for migrationReport.
	normalizeProject: normalizeChatExt(noteMigration),
	newProject: () => ({ title: t("thread.untitled"), ext: { chat: { messages: [], mode: run.pendingMode } } }),
	tabs: [{ id: "chat", labelKey: "leftPanel.chat", icon: MessageSquare, panel: ChatPanel }],
	leftSurface: { icon: MessageSquare, tabKey: "shell.tabChat", regionKey: "shell.chatColumn", hideKey: "workspace.hideChat", showKey: "workspace.showChat" },
	slots: { "preview.review": ProposalReview, "block.actions": BlockScopeAction },
	hasActivity: (project) => Boolean(project && chatOf(project)?.messages?.length),
	editorMode: getChatMode,
	startPageFromScreen,
	sessionSettings: {
		read: () => ({ selectedModelId: getSelectedModelId() }),
		apply: (settings) => {
			if (settings.selectedModelId) setSelectedModelId(settings.selectedModelId);
		}
	},
	fileKinds: [
		{
			detect: isCollectionDoc,
			open: async (parsed) => {
				const result = await openCollectionFile(parsed);
				return { ...result, note: result.ok ? t("settings.collectionOpened").replace("{count}", String(result.items)) : result.message };
			}
		}
	],
	hooks: {
		beforeProjectChange,
		projectOpened,
		// Open in BuildY (?collection=, also on /build) is read once before the session query is synced, opened after the projects load.
		beforeHydrate: () => {
			beforeHydrate();
			return takeCollectionParam();
		},
		afterHydrate: async (collection) => {
			if (typeof collection === "string" && collection) await openCollectionParam(collection);
		},
		pageStarted: (screenId) => {
			setChatMode("build");
			hydrateSessionContext({ scenarioId: null, screenId });
		}
	}
};
