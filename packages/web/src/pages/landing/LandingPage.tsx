/**
 * LandingPage - 官网首页
 *
 * 特点:
 * - 大气现代的设计风格
 * - 支持明/暗主题切换
 * - 支持多语言 (中/英/日)
 * - 使用 framer-motion 动画
 */

import { CrossPlatformSection } from "./CrossPlatformSection";
import { CTA } from "./CTA";
import { DemoSection } from "./DemoSection";
import { Features } from "./Features";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { Hero } from "./Hero";
import { Highlights } from "./Highlights";
import { MobileShowcase } from "./MobileShowcase";
import { TechStack } from "./TechStack";

export default function LandingPage() {
  return (
      <div className="h-screen overflow-y-auto bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white transition-colors">
        <Header />
        <main>
          <Hero />
          <DemoSection />
          <MobileShowcase />
          <Features />
          <CrossPlatformSection />
          <Highlights />
          <TechStack />
          <CTA />
        </main>
        <Footer />
      </div>
  );
}
