/**
 * @miu2d/shared - 跨包共享的上下文、hooks、工具库
 *
 * 提供 trpc 客户端、认证/主题/设备/Toast 上下文，以及通用 hooks。
 * packages/game、packages/dashboard、packages/web 均依赖此包。
 */

export type { Theme, ToastType } from "./contexts";
// ============= Contexts =============
export {
  AuthProvider,
  DeviceProvider,
  ThemeProvider,
  ToastProvider,
  TRPCProvider,
  useAuth,
  useDevice,
  useTheme,
  useToast,
} from "./contexts";
export type { MobileState } from "./hooks";
// ============= Hooks =============
export { useAnimatedVisibility, useMobile } from "./hooks";
export type { Locale } from "./i18n";

// ============= i18n =============
export { supportedLanguages } from "./i18n";
// ============= Lib =============
export { trpc, trpcClient } from "./lib";
export type { TranslationSchema } from "./locales";
// ============= Server Locales =============
export { en, zh } from "./locales";
