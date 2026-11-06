import { cn } from "../../utils/cn";

export function boxClasses(opts: { className?: string } = {}): string {
	return cn(opts.className);
}
