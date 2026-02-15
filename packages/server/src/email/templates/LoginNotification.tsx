import { Section, Text } from "@react-email/components";
import type * as React from "react";
import { baseStyles, colors, EmailLayout, OrangeAccentLine } from "./EmailLayout";

interface LoginNotificationProps {
  userName: string;
  loginTime: string;
  ipAddress: string;
  appName?: string;
}

export function LoginNotification({
  userName = "用户",
  loginTime = "2026-01-01 12:00:00",
  ipAddress = "127.0.0.1",
  appName = "Miu2D Engine",
}: LoginNotificationProps) {
  return (
    <EmailLayout preview={`新的登录活动 - ${appName}`} appName={appName}>
      {/* 标题区 */}
      <Text style={baseStyles.heading}>登录通知</Text>
      <Text style={baseStyles.subheading}>检测到你的账号有新的登录活动</Text>
      <OrangeAccentLine />

      <Text style={baseStyles.greeting}>你好，{userName}</Text>
      <Text style={baseStyles.text}>
        你的账号刚刚完成了一次登录操作，以下是本次登录的详细信息：
      </Text>

      {/* 登录信息卡片 */}
      <Section style={baseStyles.infoBox}>
        <Text style={baseStyles.infoLabel}>登录时间</Text>
        <Text style={baseStyles.infoValue}>{loginTime}</Text>
        <Text style={baseStyles.infoLabel}>登录 IP</Text>
        <Text style={{ ...baseStyles.infoValue, margin: "0" }}>{ipAddress}</Text>
      </Section>

      <Text style={warningText}>如果这不是你本人的操作，请立即修改密码以确保账号安全。</Text>
    </EmailLayout>
  );
}

export default LoginNotification;

const warningText: React.CSSProperties = {
  fontSize: "13px",
  lineHeight: "22px",
  color: colors.amber500,
  margin: "20px 0 0",
  padding: "12px 16px",
  backgroundColor: "rgba(245, 158, 11, 0.08)",
  borderRadius: "8px",
  border: `1px solid rgba(245, 158, 11, 0.15)`,
};
