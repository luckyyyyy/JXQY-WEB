/**
 * EmailLayout - 统一邮件布局
 *
 * 匹配 Miu2D Engine 首页视觉风格：
 * - 深色背景 (zinc-950)
 * - 橙色渐变主色调
 * - ⚡ Miu2D Engine 品牌标识
 * - 现代卡片布局
 */

import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type * as React from "react";

// ==================== 色彩体系 ====================
// 与首页 theme.ts / cssVars 保持一致

export const colors = {
  // 背景
  bodyBg: "#09090b", // zinc-950
  cardBg: "#18181b", // zinc-900
  cardBorder: "#27272a", // zinc-800
  subtleBg: "#1c1917", // warm subtle bg

  // 文字
  textPrimary: "#fafafa", // zinc-50
  textSecondary: "#a1a1aa", // zinc-400
  textMuted: "#71717a", // zinc-500
  textLink: "#fb923c", // orange-400

  // 主色调 - 橙色
  orange500: "#f97316",
  amber500: "#f59e0b",
  yellow500: "#eab308",

  // 功能色
  green500: "#22c55e",
  red500: "#ef4444",
  blue500: "#3b82f6",

  // 信息区域
  infoBg: "#1a1a2e",
  infoBorder: "#2d2d44",

  // 分隔线
  divider: "#27272a",
} as const;

// ==================== 共享样式 ====================

export const baseStyles = {
  body: {
    backgroundColor: colors.bodyBg,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans SC", "Microsoft YaHei", sans-serif',
    margin: "0",
    padding: "0",
  } satisfies React.CSSProperties,

  outerContainer: {
    maxWidth: "560px",
    margin: "0 auto",
    padding: "40px 16px",
  } satisfies React.CSSProperties,

  card: {
    backgroundColor: colors.cardBg,
    borderRadius: "16px",
    border: `1px solid ${colors.cardBorder}`,
    padding: "40px 32px",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
  } satisfies React.CSSProperties,

  heading: {
    fontSize: "24px",
    fontWeight: "700",
    color: colors.textPrimary,
    margin: "0 0 8px",
    lineHeight: "1.3",
  } satisfies React.CSSProperties,

  subheading: {
    fontSize: "14px",
    color: colors.textSecondary,
    margin: "0 0 28px",
    lineHeight: "1.5",
  } satisfies React.CSSProperties,

  text: {
    fontSize: "14px",
    lineHeight: "24px",
    color: colors.textSecondary,
    margin: "0 0 16px",
  } satisfies React.CSSProperties,

  greeting: {
    fontSize: "15px",
    color: colors.textPrimary,
    margin: "0 0 16px",
    fontWeight: "500",
  } satisfies React.CSSProperties,

  infoBox: {
    backgroundColor: colors.infoBg,
    borderRadius: "12px",
    border: `1px solid ${colors.infoBorder}`,
    padding: "16px 20px",
    margin: "20px 0",
  } satisfies React.CSSProperties,

  infoRow: {
    fontSize: "13px",
    color: colors.textSecondary,
    margin: "6px 0",
    lineHeight: "22px",
  } satisfies React.CSSProperties,

  infoLabel: {
    color: colors.textMuted,
    fontSize: "12px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
    margin: "0 0 2px",
    fontWeight: "600",
  } satisfies React.CSSProperties,

  infoValue: {
    color: colors.textPrimary,
    fontSize: "14px",
    margin: "0 0 12px",
    fontWeight: "500",
  } satisfies React.CSSProperties,

  // 橙色渐变按钮（邮件中用纯色模拟渐变）
  primaryButton: {
    backgroundColor: colors.orange500,
    borderRadius: "12px",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: "600",
    textDecoration: "none",
    textAlign: "center" as const,
    display: "inline-block",
    padding: "14px 36px",
    letterSpacing: "0.3px",
  } satisfies React.CSSProperties,

  // 次要按钮
  secondaryButton: {
    backgroundColor: "transparent",
    borderRadius: "12px",
    color: colors.textSecondary,
    fontSize: "14px",
    fontWeight: "500",
    textDecoration: "none",
    textAlign: "center" as const,
    display: "inline-block",
    padding: "12px 28px",
    border: `1px solid ${colors.cardBorder}`,
  } satisfies React.CSSProperties,

  buttonSection: {
    textAlign: "center" as const,
    margin: "28px 0",
  } satisfies React.CSSProperties,

  linkText: {
    fontSize: "12px",
    color: colors.textLink,
    wordBreak: "break-all" as const,
    lineHeight: "20px",
    margin: "0 0 16px",
  } satisfies React.CSSProperties,

  expireText: {
    fontSize: "13px",
    color: colors.amber500,
    margin: "0 0 16px",
    fontWeight: "500",
  } satisfies React.CSSProperties,

  hr: {
    borderColor: colors.divider,
    margin: "28px 0 20px",
    borderTop: `1px solid ${colors.divider}`,
    borderBottom: "none",
    borderLeft: "none",
    borderRight: "none",
  } satisfies React.CSSProperties,

  footer: {
    fontSize: "12px",
    color: colors.textMuted,
    textAlign: "center" as const,
    lineHeight: "20px",
    margin: "0",
  } satisfies React.CSSProperties,
} as const;

// ==================== Logo 组件 ====================

export function EmailLogo() {
  return (
    <Section style={{ textAlign: "center", marginBottom: "32px" }}>
      <Text
        style={{
          fontSize: "22px",
          fontWeight: "700",
          color: colors.orange500,
          margin: "0",
          letterSpacing: "-0.5px",
        }}
      >
        ⚡ Miu2D Engine
      </Text>
    </Section>
  );
}

// ==================== 分隔橙色装饰线 ====================

export function OrangeAccentLine() {
  return (
    <Section style={{ textAlign: "center", margin: "0 0 28px" }}>
      <div
        style={{
          width: "60px",
          height: "3px",
          backgroundColor: colors.orange500,
          borderRadius: "2px",
          margin: "0 auto",
        }}
      />
    </Section>
  );
}

// ==================== 页脚 ====================

export function EmailFooter({ appName = "Miu2D Engine" }: { appName?: string }) {
  const year = new Date().getFullYear();

  return (
    <>
      <Hr style={baseStyles.hr} />
      <Text style={baseStyles.footer}>此邮件由 {appName} 自动发送，请勿直接回复。</Text>
      <Section style={{ textAlign: "center", marginTop: "16px" }}>
        {/* 社交链接 */}
        <Link
          href="https://github.com/luckyyyyy/miu2d"
          style={{
            color: colors.textMuted,
            fontSize: "12px",
            textDecoration: "none",
            margin: "0 8px",
          }}
        >
          GitHub
        </Link>
        <span style={{ color: colors.divider }}>·</span>
        <Link
          href="https://miu2d.com"
          style={{
            color: colors.textMuted,
            fontSize: "12px",
            textDecoration: "none",
            margin: "0 8px",
          }}
        >
          官网
        </Link>
      </Section>
      <Text
        style={{
          ...baseStyles.footer,
          marginTop: "12px",
          fontSize: "11px",
        }}
      >
        © {year} {appName}. Made with ❤️ and AI ✨
      </Text>
    </>
  );
}

// ==================== 主布局 ====================

interface EmailLayoutProps {
  preview: string;
  children: React.ReactNode;
  appName?: string;
}

export function EmailLayout({ preview, children, appName = "Miu2D Engine" }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={baseStyles.body}>
        <Container style={baseStyles.outerContainer}>
          <Section style={baseStyles.card}>
            <EmailLogo />
            {children}
            <EmailFooter appName={appName} />
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
