/**
 * @miu2d/ui - 超级通用的 UI 组件包
 *
 * 此包包含不依赖任何业务逻辑的纯 UI 组件，可在任何 React 项目中使用。
 * 特点：
 * - 不依赖 @miu2d/engine 或其他业务包
 * - 仅依赖 React 和通用 UI 库（如 framer-motion）
 * - 高度可复用的视觉组件
 */

// ============= Avatar 头像 =============
export { Avatar, type AvatarProps } from "./Avatar";

// ============= Icons 图标 =============
export {
  GitHubIcon,
  TwitterIcon,
  DiscordIcon,
  SunIcon,
  MoonIcon,
  GlobeIcon,
  BookIcon,
  CloseIcon,
  MenuIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  SearchIcon,
  LoadingIcon,
  CheckIcon,
  PlayIcon,
  PauseIcon,
  type IconProps,
} from "./Icons";

// ============= Landing Page 官网专用组件 =============
// 这些组件专门用于官网首页的视觉效果
export {
  // 动画
  FadeIn,
  FadeInView,
  ScaleIn,
  Stagger,
  StaggerItem,
  HoverScale,
  Pulse,
  Slide,
  type FadeInProps,
  type FadeInViewProps,
  type ScaleInProps,
  type StaggerProps,
  type StaggerItemProps,
  type HoverScaleProps,
  type PulseProps,
  type SlideProps,
  // 背景效果
  FloatingOrb,
  GridBackground,
  GridLine,
  GridNode,
  GridPattern,
  type GridBackgroundProps,
} from "./landing";

