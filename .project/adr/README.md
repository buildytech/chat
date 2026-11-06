# Architecture Decision Records

Нумерация: `NNNN-kebab-title.md`. Номера монотонно возрастают, файлы не переименовываем.

| ADR | Title | Status |
| --- | --- | --- |
| [0001](0001-cms-agnostic-chat-builder.md) | CMS-agnostic chat builder (dual builders + Page Store ports) | Accepted |
| [0002](0002-supply-chain-slsa.md) | Verifiable technical supply via SLSA-aligned CI | Accepted |
| [0003](0003-creator-surfaces-preview-code.md) | Creator surfaces & Preview/Code ports | Accepted |
| [0004](0004-agent-runtime-adapters.md) | Agent runtime adapters & VPS cursor-sdk opt-in | Accepted |

Status values: Proposed, Accepted, Superseded, Deprecated.

0003/0004 extend 0001 (surfaces + agent channel); they do not replace Page Store ports or SLSA.
