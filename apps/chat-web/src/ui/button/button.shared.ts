import { cn } from "../../utils/cn";

export function buttonClasses(opts: { className?: string } = {}): string {
	return cn(opts.className);
}
