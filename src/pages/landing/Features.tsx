/**
 * Features - 功能特性介绍
 */

import React, { useRef } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

// 图标组件
function MapIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z"
      />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
      />
    </svg>
  );
}

function CodeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
      />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
      />
    </svg>
  );
}

function WindowIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  );
}

function SpeakerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"
      />
    </svg>
  );
}

// 存档图标
function SaveIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
      />
    </svg>
  );
}

// 寻路图标
function PathIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z"
      />
    </svg>
  );
}

// 战斗图标
function SwordIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z"
      />
    </svg>
  );
}

// 物品图标
function BackpackIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
      />
    </svg>
  );
}

// 天气图标
function WeatherIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z"
      />
    </svg>
  );
}

// 调试图标
function DebugIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 12.75c1.148 0 2.278.08 3.383.237 1.037.146 1.866.966 1.866 2.013 0 3.728-2.35 6.75-5.25 6.75S6.75 18.728 6.75 15c0-1.046.83-1.867 1.866-2.013A24.204 24.204 0 0112 12.75zm0 0c2.883 0 5.647.508 8.207 1.44a23.91 23.91 0 01-1.152 6.06M12 12.75c-2.883 0-5.647.508-8.208 1.44.125 2.104.52 4.136 1.153 6.06M12 12.75a2.25 2.25 0 002.248-2.354M12 12.75a2.25 2.25 0 01-2.248-2.354M12 8.25c.995 0 1.971-.08 2.922-.236.403-.066.74-.358.795-.762a3.778 3.778 0 00-.399-2.25M12 8.25c-.995 0-1.97-.08-2.922-.236-.402-.066-.74-.358-.795-.762a3.734 3.734 0 01.4-2.253M12 8.25a2.25 2.25 0 00-2.248 2.146M12 8.25a2.25 2.25 0 012.248 2.146M8.683 5a6.032 6.032 0 01-1.155-1.002c.07-.63.27-1.222.574-1.747m.581 2.749A3.75 3.75 0 0112 3.75a3.75 3.75 0 013.317 1.25m-6.634 0V5zm6.634 0V5zm0 0c.408.364.78.767 1.155 1.002.309.525.504 1.116.574 1.747M12 3v-.75"
      />
    </svg>
  );
}

// 更多图标
function MoreIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
      />
    </svg>
  );
}

const features = [
  {
    icon: MapIcon,
    titleKey: "feature.map.title" as const,
    descKey: "feature.map.desc" as const,
    gradient: "from-emerald-500 to-teal-500",
    bgGradient: "from-emerald-500/10 to-teal-500/10",
    // 光源颜色 - 使用更亮的色阶让发光更明显
    spotlightColor: "52, 211, 153", // emerald-400 (更亮)
  },
  {
    icon: UserIcon,
    titleKey: "feature.character.title" as const,
    descKey: "feature.character.desc" as const,
    gradient: "from-emerald-500 to-green-500",
    bgGradient: "from-emerald-500/10 to-green-500/10",
    spotlightColor: "74, 222, 128", // green-400 (更亮)
  },
  {
    icon: CodeIcon,
    titleKey: "feature.script.title" as const,
    descKey: "feature.script.desc" as const,
    gradient: "from-orange-500 to-amber-500",
    bgGradient: "from-orange-500/10 to-amber-500/10",
    spotlightColor: "251, 146, 60", // orange-400 (更亮)
  },
  {
    icon: SparklesIcon,
    titleKey: "feature.magic.title" as const,
    descKey: "feature.magic.desc" as const,
    gradient: "from-orange-500 to-amber-500",
    bgGradient: "from-orange-500/10 to-amber-500/10",
    spotlightColor: "251, 191, 36", // amber-400 (更亮)
  },
  {
    icon: WindowIcon,
    titleKey: "feature.ui.title" as const,
    descKey: "feature.ui.desc" as const,
    gradient: "from-pink-500 to-rose-500",
    bgGradient: "from-pink-500/10 to-rose-500/10",
    spotlightColor: "244, 114, 182", // pink-400 (更亮)
  },
  {
    icon: SpeakerIcon,
    titleKey: "feature.audio.title" as const,
    descKey: "feature.audio.desc" as const,
    gradient: "from-rose-500 to-pink-500",
    bgGradient: "from-rose-500/10 to-pink-500/10",
    spotlightColor: "251, 113, 133", // rose-400 (更亮)
  },
  {
    icon: BackpackIcon,
    titleKey: "feature.items.title" as const,
    descKey: "feature.items.desc" as const,
    gradient: "from-yellow-500 to-amber-500",
    bgGradient: "from-yellow-500/10 to-amber-500/10",
    spotlightColor: "250, 204, 21", // yellow-400
  },
  {
    icon: SaveIcon,
    titleKey: "feature.save.title" as const,
    descKey: "feature.save.desc" as const,
    gradient: "from-cyan-500 to-blue-500",
    bgGradient: "from-cyan-500/10 to-blue-500/10",
    spotlightColor: "34, 211, 238", // cyan-400
  },
  {
    icon: DebugIcon,
    titleKey: "feature.debug.title" as const,
    descKey: "feature.debug.desc" as const,
    gradient: "from-violet-500 to-purple-500",
    bgGradient: "from-violet-500/10 to-purple-500/10",
    spotlightColor: "167, 139, 250", // violet-400
  },
];

// 特性卡片组件 - 纯展示，发光效果由父组件直接操作 DOM
interface FeatureCardProps {
  feature: (typeof features)[number];
  Icon: React.ComponentType<{ className?: string }>;
  t: (key: string) => string;
}

function FeatureCard({ feature, Icon, t }: FeatureCardProps) {
  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.02 }}
      transition={{ duration: 0.2 }}
      className="feature-card relative h-full rounded-2xl"
      data-spotlight-color={feature.spotlightColor}
      style={
        {
          "--spotlight-color": feature.spotlightColor,
          "--spotlight-x": "0px",
          "--spotlight-y": "0px",
          "--spotlight-opacity": "0",
        } as React.CSSProperties
      }
    >
      {/* 默认边框层 - 亮色模式 */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none dark:hidden"
        style={{
          background: `linear-gradient(135deg, rgba(${feature.spotlightColor}, 0.25), rgba(${feature.spotlightColor}, 0.1))`,
        }}
      />
      {/* 暗黑模式下的默认边框 */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none hidden dark:block"
        style={{
          background: `linear-gradient(135deg, rgba(${feature.spotlightColor}, 0.2), rgba(${feature.spotlightColor}, 0.08))`,
        }}
      />

      {/* 发光边框层 - 只在边框区域发光，使用 mask 遮罩，2px 边框 */}
      <div
        className="spotlight-layer absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          opacity: "var(--spotlight-opacity)",
          background: `radial-gradient(
            600px circle at var(--spotlight-x) var(--spotlight-y),
            rgba(var(--spotlight-color), 1) 0%,
            rgba(var(--spotlight-color), 0.9) 15%,
            rgba(var(--spotlight-color), 0.6) 30%,
            transparent 50%
          )`,
          // 使用 mask 只显示边框区域（外圆减去内圆）- 2px 边框
          WebkitMask: `
            linear-gradient(#fff 0 0) content-box,
            linear-gradient(#fff 0 0)
          `,
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          padding: "2px",
        }}
      />

      {/* 卡片内容背景层 - 亮色模式使用更透明的白色背景 */}
      <div
        className={`absolute inset-[2px] rounded-[14px] bg-white/80 dark:bg-transparent backdrop-blur-sm`}
      />
      {/* 暗黑模式背景覆盖层 */}
      <div className="absolute inset-[2px] rounded-[14px] hidden dark:block dark:bg-zinc-900/95 pointer-events-none" />

      {/* 发光背景层 - 在内容背景之上，背景发光效果 */}
      <div
        className="spotlight-layer absolute inset-[2px] rounded-[14px] pointer-events-none"
        style={{
          opacity: "var(--spotlight-opacity)",
          background: `radial-gradient(
            400px circle at calc(var(--spotlight-x) - 2px) calc(var(--spotlight-y) - 2px),
            rgba(var(--spotlight-color), 0.25),
            transparent 50%
          )`,
        }}
      />

      {/* 内容层 */}
      <div className="relative z-20 p-6">
        {/* 图标 */}
        <div
          className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${feature.gradient} shadow-lg`}
        >
          <Icon className="w-6 h-6 text-white" />
        </div>

        {/* 标题 */}
        <h3 className="mt-4 text-xl font-semibold text-zinc-900 dark:text-white">
          {t(feature.titleKey)}
        </h3>

        {/* 描述 */}
        <p className="mt-2 text-zinc-600 dark:text-zinc-400 leading-relaxed">
          {t(feature.descKey)}
        </p>
      </div>
    </motion.div>
  );
}

export function Features() {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  // 使用原生事件监听，完全绕过 React 渲染周期
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSpotlight = (clientX: number, clientY: number) => {
      const cards = container.querySelectorAll<HTMLElement>(".feature-card");
      cards.forEach((card) => {
        const rect = card.getBoundingClientRect();

        // 计算相对于卡片的光源位置
        const relativeX = clientX - rect.left;
        const relativeY = clientY - rect.top;

        // 计算鼠标到卡片中心的距离
        const cardCenterX = rect.width / 2;
        const cardCenterY = rect.height / 2;
        const dx = relativeX - cardCenterX;
        const dy = relativeY - cardCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // 最大发光距离
        const maxDistance = 350;

        if (distance < maxDistance) {
          const opacity = Math.max(0.3, 1 - distance / maxDistance);
          card.style.setProperty("--spotlight-x", `${relativeX}px`);
          card.style.setProperty("--spotlight-y", `${relativeY}px`);
          card.style.setProperty("--spotlight-opacity", opacity.toString());
        } else {
          card.style.setProperty("--spotlight-opacity", "0");
        }
      });
    };

    const handleMouseMove = (e: MouseEvent) => {
      updateSpotlight(e.clientX, e.clientY);
    };

    const handleMouseLeave = () => {
      const cards = container.querySelectorAll<HTMLElement>(".feature-card");
      cards.forEach((card) => {
        card.style.setProperty("--spotlight-opacity", "0");
      });
    };

    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <section id="features" className="relative py-24 sm:py-32 overflow-hidden">
      {/* 背景 */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-zinc-50 to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 标题 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-zinc-900 dark:text-white">
            {t("features.title")}
          </h2>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            {t("features.subtitle")}
          </p>
        </motion.div>

        {/* 功能卡片网格 */}
        <div
          ref={containerRef}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.titleKey}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <FeatureCard feature={feature} Icon={Icon} t={t} />
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
