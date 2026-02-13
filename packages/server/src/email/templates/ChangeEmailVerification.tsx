import { Button, Section, Text } from "@react-email/components";
import type * as React from "react";
import {
  EmailLayout,
  OrangeAccentLine,
  baseStyles,
  colors,
} from "./EmailLayout";

interface ChangeEmailVerificationProps {
  userName: string;
  newEmail: string;
  verifyUrl: string;
  expiresIn?: string;
  appName?: string;
}

export function ChangeEmailVerification({
  userName = "用户",
  newEmail = "new@example.com",
  verifyUrl = "https://miu2d.com/verify-change-email?token=xxx",
  expiresIn = "1 小时",
  appName = "Miu2D Engine",
}: ChangeEmailVerificationProps) {
  return (
    <EmailLayout preview={`确认修改邮箱 - ${appName}`} appName={appName}>
      {/* 标题区 */}
      <Text style={baseStyles.heading}>修改邮箱确认</Text>
      <Text style={baseStyles.subheading}>
        你正在修改账号绑定的邮箱地址
      </Text>
      <OrangeAccentLine />

      <Text style={baseStyles.greeting}>你好，{userName}</Text>
      <Text style={baseStyles.text}>你正在将账号邮箱修改为：</Text>

      {/* 新邮箱展示 */}
      <Section style={emailHighlight}>
        <Text style={emailLabel}>新邮箱地址</Text>
        <Text style={emailValue}>{newEmail}</Text>
      </Section>

      <Text style={baseStyles.text}>
        请点击下方按钮确认此修改。确认后你的账号将使用新邮箱登录。
      </Text>

      {/* CTA */}
      <Section style={baseStyles.buttonSection}>
        <Button style={confirmButton} href={verifyUrl}>
          确认修改邮箱 →
        </Button>
      </Section>

      <Text style={baseStyles.text}>
        如果按钮无法点击，请复制以下链接到浏览器中打开：
      </Text>
      <Text style={baseStyles.linkText}>{verifyUrl}</Text>

      <Text style={baseStyles.expireText}>⏰ 此链接将在 {expiresIn} 后失效</Text>

      {/* 安全提示 */}
      <Section style={safetyNote}>
        <Text style={safetyText}>
          如果你没有请求此修改，请忽略此邮件，你的邮箱地址不会改变。
        </Text>
      </Section>
    </EmailLayout>
  );
}

export default ChangeEmailVerification;

const emailHighlight: React.CSSProperties = {
  backgroundColor: colors.infoBg,
  borderRadius: "12px",
  border: `1px solid ${colors.infoBorder}`,
  padding: "16px 20px",
  margin: "16px 0",
  textAlign: "center",
};

const emailLabel: React.CSSProperties = {
  fontSize: "11px",
  color: colors.textMuted,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  margin: "0 0 4px",
  fontWeight: "600",
};

const emailValue: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: "600",
  color: colors.orange500,
  margin: "0",
};

const confirmButton: React.CSSProperties = {
  ...baseStyles.primaryButton,
  backgroundColor: colors.amber500,
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
