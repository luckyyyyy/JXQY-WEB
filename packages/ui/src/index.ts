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
  BookIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
  DiscordIcon,
  GitHubIcon,
  GlobeIcon,
  type IconProps,
  LoadingIcon,
  MenuIcon,
  MoonIcon,
  PauseIcon,
  PlayIcon,
  SearchIcon,
  SunIcon,
  TwitterIcon,
} from "./Icons";

// ============= Landing Page 官网专用组件 =============
// 这些组件专门用于官网首页的视觉效果
export {
  // 动画
  FadeIn,
  type FadeInProps,
  FadeInView,
  type FadeInViewProps,
  // 背景效果
  FloatingOrb,
  GridBackground,
  type GridBackgroundProps,
  GridLine,
  GridNode,
  GridPattern,
  HoverScale,
  type HoverScaleProps,
  Pulse,
  type PulseProps,
  ScaleIn,
  type ScaleInProps,
  Slide,
  type SlideProps,
  Stagger,
  StaggerItem,
  type StaggerItemProps,
  type StaggerProps,
} from "./landing";

// ============= NumberInput 数字输入框 =============
export { NumberInput, type NumberInputProps } from "./NumberInput";

// ============= ResponsiveGrid 自适应栅格 =============
export { ResponsiveGrid } from "./ResponsiveGrid";
