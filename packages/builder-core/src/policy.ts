/** Every tool of agent-tools.v1.json (a test keeps both equal). Which ones a turn offers depends on its mode. */
export const ALLOWED_TOOLS = ["list_blocks", "get_block", "get_page", "write_page"] as const;

export type AllowedTool = (typeof ALLOWED_TOOLS)[number];
