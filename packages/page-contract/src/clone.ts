/** A deep copy through JSON: drops `undefined` fields and functions, so the copy is exactly what `JSON.stringify` would write. The one clone of the repo. */
export function cloneJson<T>(value: T): T {
	return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}
