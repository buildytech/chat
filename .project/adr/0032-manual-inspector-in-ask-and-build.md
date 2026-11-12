# ADR 0032: Manual inspector independent of model mode

Status: accepted, 2026-11-12. Revises ADR 0024's Build-only inspector presentation.

Ask / Build restricts model tools, not the author's manual editor. Preview picks and Sections picks already requested an inspector, but Workspace, header controls and Ctrl+I hid/refused it in Ask, leaving an invisible open state. Render and expose the manual inspector in both modes. A click never changes the selected chat mode and Ask tools remain read-only.

Manual undo/redo follows the same rule. Ctrl+I outside CodeMirror opens Preview when Code is selected. Opening from Sections on narrow screens reveals the workspace through an explicit inspector request counter; it does not continuously force the active surface. Escape inside the iframe closes the panel unless the event was already handled. Clean mode hides service chrome rather than manual editing controls; standalone preview remains read-only.

Inspector controls wait for the shared lazy validator, show loading/failure, and retry on reopen. Field selection waits for validation and DOM readiness before focusing its control. No registry edits, model calls or new persisted session fields.
