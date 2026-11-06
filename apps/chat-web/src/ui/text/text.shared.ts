import { cn } from "../../utils/cn";

export function textClasses(opts: { className?: string } = {}): string {
	return cn(opts.className);
}
