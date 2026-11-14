# ADR 0044: The chat keys live in `ext.chat` of the session document; the left pane is `side`

Status: accepted, 2026-11-14. Owner decision (t189u, t190u: nobody but the owner has old data, a clean format is fine). Follows ADR 0040 and 0041.

## Decision

1. **Contract session 1.10.0** ([ui8kit/contract 34de2e1](https://github.com/ui8kit/contract/commit/34de2e1), additive). A session has `ext`: extensions of the project by name (`^[a-z][a-z0-9-]{0,31}$`,
   each an object a module owns; a host keeps the ones it does not know). `ext.chat` (`$defs/chatExt`, closed) holds `mode`, `selectedModelId`, `usage`, `messages`. The flat keys of the
   same names are deprecated and stay valid, so every 1.0.0 to 1.9.0 file validates unchanged. `prefs.layout` gets `sideWidth` and `sideCollapsed`; `chatWidth` and `chatCollapsed`
   are deprecated and stay valid.
2. **The app writes the new shape only.** `docOfProject` stores `project.ext` under `ext` as it is (the core does not know what a module keeps there), and no chat key is written flat.
   `Project.ext` was already the in-memory shape (ADR 0040); the stored document now matches it. The core no longer lists chat keys at all: `registerProjectExtension` is gone.
3. **Reading old documents is a read, not a migration.** A module may declare `legacyKeys` (the chat: `mode`, `selectedModelId`, `usage`, `messages`). A document that has such keys and no
   `ext.<id>` gets them as its `ext.<id>` on load; the next save writes `ext`. With the module off nothing claims the keys, so they stay as they are (`Project.extra`) and the document
   keeps them byte for byte. No counter, no second code path: this is the one place that knows the old names, and ADR 0045 can delete it with the other old-data reads.
4. **Prefs.** The left panel (Blocks, Sections, module tabs) is the pane and panel `side` (`PANE_RANGE.side`, `sideWidth`, `sideCollapsed`, the `Ctrl+B` action `side`, DOM id `creator-side-column`,
   `fitWidths().side`). The old `chatWidth` and `chatCollapsed` in a stored blob or file are not read: the layout falls back to the default width and open state (a preference, nothing is lost that matters).

## Consequences

- A session file written by this app shows no messages to a host that only reads the flat keys (Lab before 1.10.0): it is the format change the owner asked for. Files of every older version still open here.
- ADR 0041 said the keys and the `chat` pane id stay in the core as contract and prefs names; this ADR removes both.
- The no-trace check stays green: the core carries no chat key name (the only list is in the chat module).
