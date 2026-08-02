import { Button, Section, Text } from "@react-email/components";
import type * as React from "react";
import { baseStyles, colors, EmailLayout, OrangeAccentLine } from "./EmailLayout";

interface ResetPasswordEmailProps {
  userName: string;
  resetUrl: string;
  expiresIn?: string;
  appName?: string;
}

export function ResetPasswordEmail({
  userName = "用户",
  resetUrl = "https://miu2d.com/reset-password?token=xxx",
  expiresIn = "1 小时",
  appName = "Miu2D Engine",
}: ResetPasswordEmailProps) {
  return (
    <EmailLayout preview={`重置你的密码 - ${appName}`} appName={appName}>
      {/* 标题区 */}
      <Text style={baseStyles.heading}>重置你的密码</Text>
      <Text style={baseStyles.subheading}>我们收到了你的密码重置请求</Text>
      <OrangeAccentLine />

      <Text style={baseStyles.greeting}>你好，{userName}</Text>
      <Text style={baseStyles.text}>
        请点击下方按钮设置新密码。为了你的账号安全，重置成功后当前所有登录会话将会失效，需要重新登录。
      </Text>

      {/* CTA */}
      <Section style={baseStyles.buttonSection}>
        <Button style={resetButton} href={resetUrl}>
          重置密码 →
        </Button>
      </Section>

      <Text style={baseStyles.text}>如果按钮无法点击，请复制以下链接到浏览器中打开：</Text>
      <Text style={baseStyles.linkText}>{resetUrl}</Text>

      <Text style={baseStyles.expireText}>⏰ 此链接将在 {expiresIn} 后失效</Text>

      {/* 安全提示 */}
      <Section style={safetyNote}>
        <Text style={safetyText}>
          如果你没有请求重置密码，请忽略此邮件，你的密码不会发生任何改变。
        </Text>
      </Section>
    </EmailLayout>
  );
}

export default ResetPasswordEmail;

const resetButton: React.CSSProperties = {
  ...baseStyles.primaryButton,
  backgroundColor: colors.orange500,
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
