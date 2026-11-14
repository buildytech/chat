const SECRET_HEADER = /^(authorization|proxy-authorization|x-api-key|x-user-api-key|cookie|set-cookie)$/i;
const SECRET_KEY = /(api[_-]?key|authorization|secret|token|password|credential|cursor_api_key|xai_api_key)/i;
const BEARER = /\bBearer\s+[A-Za-z0-9._\-+/=]+/gi;
const CANARY_HINT = /\bsk-[A-Za-z0-9]{8,}\b/g;

export function redactValue(value: unknown, key = ""): unknown {
	if (SECRET_KEY.test(key) || SECRET_HEADER.test(key)) return "[redacted]";
	if (typeof value === "string") {
		return value.replace(BEARER, "Bearer [redacted]").replace(CANARY_HINT, "[redacted]");
	}
	if (Array.isArray(value)) return value.map((item) => redactValue(item));
	if (value && typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			out[k] = redactValue(v, k);
		}
		return out;
	}
	return value;
}

export function safeErrorMessage(err: unknown): { code: string; message: string } {
	const raw = err instanceof Error ? err.message : String(err);
	const code =
		err && typeof err === "object" && "code" in err && typeof (err as { code: unknown }).code === "string"
			? (err as { code: string }).code
			: "error";
	const message = String(redactValue(raw)).slice(0, 280);
	return { code, message };
}

export function assertNoSecret(payload: unknown, canary: string): void {
	if (!canary) return;
	const blob = JSON.stringify(payload);
	if (blob.includes(canary)) {
		throw Object.assign(new Error("secret_leaked"), { code: "secret_leaked" });
	}
}
