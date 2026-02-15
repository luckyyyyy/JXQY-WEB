import { Button, Section, Text } from "@react-email/components";
import type * as React from "react";
import { baseStyles, colors, EmailLayout, OrangeAccentLine } from "./EmailLayout";

interface VerifyEmailProps {
  userName: string;
  verifyUrl: string;
  expiresIn?: string;
  appName?: string;
}

export function VerifyEmail({
  userName = "用户",
  verifyUrl = "https://miu2d.com/verify?token=xxx",
  expiresIn = "24 小时",
  appName = "Miu2D Engine",
}: VerifyEmailProps) {
  return (
    <EmailLayout preview={`验证你的邮箱 - ${appName}`} appName={appName}>
      {/* 标题区 */}
      <Text style={baseStyles.heading}>验证你的邮箱</Text>
      <Text style={baseStyles.subheading}>只需一步，即可解锁完整功能</Text>
      <OrangeAccentLine />

      <Text style={baseStyles.greeting}>你好，{userName}</Text>
      <Text style={baseStyles.text}>
        请点击下方按钮验证你的邮箱地址。验证后你将获得完整的账号功能。
      </Text>

      {/* CTA */}
      <Section style={baseStyles.buttonSection}>
        <Button style={verifyButton} href={verifyUrl}>
          验证邮箱 →
        </Button>
      </Section>

      <Text style={baseStyles.text}>如果按钮无法点击，请复制以下链接到浏览器中打开：</Text>
      <Text style={baseStyles.linkText}>{verifyUrl}</Text>

      <Text style={baseStyles.expireText}>⏰ 此链接将在 {expiresIn} 后失效</Text>

      {/* 安全提示 */}
      <Section style={safetyNote}>
        <Text style={safetyText}>如果你没有进行此操作，请忽略此邮件。</Text>
      </Section>
    </EmailLayout>
  );
}

export default VerifyEmail;

const verifyButton: React.CSSProperties = {
  ...baseStyles.primaryButton,
  backgroundColor: colors.green500,
};

const safetyNote: React.CSSProperties = {
  backgroundColor: "rgba(113, 113, 122, 0.08)",
  borderRadius: "8px",
  border: `1px solid rgba(113, 113, 122, 0.15)`,
  padding: "12px 16px",
  marginTop: "20px",
};

const safetyText: React.CSSProperties = {
  fontSize: "12px",
  color: colors.textMuted,
  margin: "0",
  lineHeight: "18px",
};
