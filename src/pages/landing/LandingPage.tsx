/**
 * LandingPage - 官网首页
 *
 * 特点:
 * - 大气现代的设计风格
 * - 支持明/暗主题切换
 * - 支持多语言 (中/英/日)
 * - 使用 framer-motion 动画
 */

import { ThemeProvider } from "@/contexts";
import { Header } from "./Header";
import { Hero } from "./Hero";
import { DemoSection } from "./DemoSection";
import { MobileShowcase } from "./MobileShowcase";
import { Features } from "./Features";
import { Highlights } from "./Highlights";
import { CrossPlatformSection } from "./CrossPlatformSection";
import { TechStack } from "./TechStack";
import { CTA } from "./CTA";
import { Footer } from "./Footer";

export default function LandingPage() {
  return (
    <ThemeProvider>
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
    </ThemeProvider>
  );
}
