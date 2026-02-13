/**
 * 带颜色的日志工具，替代 NestJS Logger
 *
 * 提供与 NestJS Logger 兼容的 API：
 * - logger.log(message)    → 绿色 LOG
 * - logger.debug(message)  → 紫色 DEBUG（仅开发模式）
 * - logger.warn(message)   → 黄色 WARN
 * - logger.error(message)  → 红色 ERROR
 */

const isDev = process.env.NODE_ENV !== "production";

// ANSI 颜色码
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const MAGENTA = "\x1b[35m";
const CYAN = "\x1b[36m";

function timestamp(): string {
	const now = new Date();
	const h = String(now.getHours()).padStart(2, "0");
	const m = String(now.getMinutes()).padStart(2, "0");
	const s = String(now.getSeconds()).padStart(2, "0");
	const ms = String(now.getMilliseconds()).padStart(3, "0");
	return `${h}:${m}:${s}.${ms}`;
}

function formatLevel(level: string, color: string): string {
	return `${color}${BOLD}${level.padEnd(5)}${RESET}`;
}

function formatContext(context: string): string {
	return `${YELLOW}[${context}]${RESET}`;
}

function formatTime(): string {
	return `${DIM}${timestamp()}${RESET}`;
}

export class Logger {
	constructor(private readonly context: string) {}

	log(message: unknown, ...args: unknown[]) {
		console.log(
			`${formatLevel("LOG", GREEN)} ${formatTime()} ${formatContext(this.context)} ${CYAN}${String(message)}${RESET}`,
			...args
		);
	}

	debug(message: unknown, ...args: unknown[]) {
		if (isDev) {
			console.debug(
				`${formatLevel("DEBUG", MAGENTA)} ${formatTime()} ${formatContext(this.context)} ${String(message)}`,
				...args
			);
		}
	}

	warn(message: unknown, ...args: unknown[]) {
		console.warn(
			`${formatLevel("WARN", YELLOW)} ${formatTime()} ${formatContext(this.context)} ${YELLOW}${String(message)}${RESET}`,
			...args
		);
	}

	error(message: unknown, ...args: unknown[]) {
		console.error(
			`${formatLevel("ERROR", RED)} ${formatTime()} ${formatContext(this.context)} ${RED}${String(message)}${RESET}`,
			...args
		);
	}
}
