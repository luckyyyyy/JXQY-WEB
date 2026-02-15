/**
 * UI components exports
 *
 * 支持两套 UI 风格切换:
 * - classic: ASF-based 经典复古风格
 * - modern: Web-based 现代毛玻璃风格
 */

// ============= Classic UI (ASF-based) =============
export * from "./classic";

// ============= Modern UI (Web-based) =============
export * as ModernUI from "./modern";
export { ModernGameUI } from "./modern";

// ============= UI 主题类型 =============
export type UITheme = "classic" | "modern";
