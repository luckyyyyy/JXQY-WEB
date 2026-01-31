/**
 * 美化的日志系统
 * - 带毫秒级时间戳
 * - 自动高亮 [xxx] 标签
 * - 彩色输出
 */

type LogLevel = "debug" | "info" | "warn" | "error";

// 日志级别对应的颜色
const LEVEL_STYLES: Record<LogLevel, string> = {
  debug: "color: #888; font-weight: normal",
  info: "color: #2196F3; font-weight: normal",
  warn: "color: #FF9800; font-weight: bold",
  error: "color: #F44336; font-weight: bold",
};

// 时间戳颜色
const TIME_STYLE = "color: #9E9E9E; font-weight: normal";

// 标签颜色 - 用于 [xxx] 格式
const TAG_STYLE = "color: #4CAF50; font-weight: bold";

// 默认文本颜色
const TEXT_STYLE = "color: inherit; font-weight: normal";

/**
 * 获取带毫秒的时间戳
 */
function getTimestamp(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  return `${hours}:${minutes}:${seconds}.${ms}`;
}

/**
 * 解析消息中的 [xxx] 标签，返回格式化字符串和样式数组
 */
function parseMessage(message: string): { format: string; styles: string[] } {
  const styles: string[] = [];
  // 匹配 [xxx] 格式的标签
  const tagRegex = /\[([^\]]+)\]/g;

  let format = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(message)) !== null) {
    // 添加标签前的普通文本
    if (match.index > lastIndex) {
      format += `%c${message.slice(lastIndex, match.index)}`;
      styles.push(TEXT_STYLE);
    }
    // 添加高亮的标签
    format += `%c${match[0]}`;
    styles.push(TAG_STYLE);
    lastIndex = match.index + match[0].length;
  }

  // 添加剩余的普通文本
  if (lastIndex < message.length) {
    format += `%c${message.slice(lastIndex)}`;
    styles.push(TEXT_STYLE);
  }

  // 如果没有找到任何标签，直接返回原消息
  if (styles.length === 0) {
    return { format: message, styles: [] };
  }

  return { format, styles };
}

/**
 * 格式化日志输出
 */
function formatLog(
  level: LogLevel,
  message: string,
  ...args: unknown[]
): { format: string; styles: string[]; args: unknown[] } {
  const timestamp = getTimestamp();
  const levelLabel = level.toUpperCase().padEnd(5);

  const { format: parsedFormat, styles: messageStyles } = parseMessage(message);

  // 构建格式化字符串
  const format = `%c${timestamp} %c${levelLabel} ${parsedFormat}`;
  const styles = [TIME_STYLE, LEVEL_STYLES[level], ...messageStyles];

  return { format, styles, args };
}

/**
 * 日志类
 */
class Logger {
  private enabled = true;
  private minLevel: LogLevel = "debug";

  private readonly levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  /**
   * 设置是否启用日志
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * 设置最小日志级别
   */
  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * 检查日志级别是否应该输出
   */
  private shouldLog(level: LogLevel): boolean {
    return this.enabled && this.levelPriority[level] >= this.levelPriority[this.minLevel];
  }

  /**
   * 输出日志
   */
  private output(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!this.shouldLog(level)) return;

    const { format, styles, args: restArgs } = formatLog(level, message, ...args);

    const consoleMethod =
      level === "error" ? console.error : level === "warn" ? console.warn : console.log;

    if (styles.length > 0) {
      consoleMethod(format, ...styles, ...restArgs);
    } else {
      consoleMethod(format, ...restArgs);
    }
  }

  /**
   * 调试日志
   */
  debug(message: string, ...args: unknown[]): void {
    this.output("debug", message, ...args);
  }

  /**
   * 信息日志
   */
  info(message: string, ...args: unknown[]): void {
    this.output("info", message, ...args);
  }

  /**
   * 普通日志 (info 的别名)
   */
  log(message: string, ...args: unknown[]): void {
    this.output("info", message, ...args);
  }

  /**
   * 警告日志
   */
  warn(message: string, ...args: unknown[]): void {
    this.output("warn", message, ...args);
  }

  /**
   * 错误日志
   */
  error(message: string, ...args: unknown[]): void {
    this.output("error", message, ...args);
  }
}

// 导出单例
export const logger = new Logger();

// 默认导出
export default logger;
