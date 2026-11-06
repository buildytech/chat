import { cn } from "../../utils/cn";

const SIZE: Record<string, string> = {
	xs: "size-3",
	sm: "size-4",
	md: "size-5",
	lg: "size-6",
	xl: "size-8"
};

export function iconClasses(opts: { size?: string; className?: string } = {}): string {
	const size = SIZE[opts.size ?? "sm"] ?? SIZE.sm;
	return cn("inline-flex shrink-0 items-center justify-center", size, opts.className);
}
