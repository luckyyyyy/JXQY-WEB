import { Button, Section, Text } from "@react-email/components";
import type * as React from "react";
import { baseStyles, colors, EmailLayout, OrangeAccentLine } from "./EmailLayout";

interface WelcomeEmailProps {
  userName: string;
  loginUrl?: string;
  appName?: string;
}

export function WelcomeEmail({
  userName = "用户",
  loginUrl = "https://miu2d.com",
  appName = "Miu2D Engine",
}: WelcomeEmailProps) {
  return (
    <EmailLayout preview={`欢迎加入 ${appName}！`} appName={appName}>
      {/* 标题区 */}
      <Text style={baseStyles.heading}>欢迎加入 {appName}！</Text>
      <Text style={baseStyles.subheading}>开始你的 2D RPG 游戏开发之旅</Text>
      <OrangeAccentLine />

      <Text style={baseStyles.greeting}>你好，{userName}</Text>
      <Text style={baseStyles.text}>
        感谢你注册 {appName}！我们很高兴你成为社区的一员。现在你可以开始探索引擎的全部功能：
      </Text>

      {/* 功能列表 - 使用卡片网格样式 */}
      <Section style={featureGrid}>
        <table cellPadding="0" cellSpacing="0" style={{ width: "100%" }}>
          <tbody>
            <tr>
              <td style={featureCell}>
                <Text style={featureIcon}>🗺️</Text>
                <Text style={featureLabel}>地图编辑</Text>
              </td>
              <td style={{ width: "12px" }} />
              <td style={featureCell}>
                <Text style={featureIcon}>⚔️</Text>
                <Text style={featureLabel}>武功系统</Text>
              </td>
            </tr>
            <tr>
              <td style={{ height: "12px" }} colSpan={3} />
            </tr>
            <tr>
              <td style={featureCell}>
                <Text style={featureIcon}>🎭</Text>
                <Text style={featureLabel}>NPC 脚本</Text>
              </td>
              <td style={{ width: "12px" }} />
              <td style={featureCell}>
                <Text style={featureIcon}>🎵</Text>
                <Text style={featureLabel}>音效资源</Text>
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      {/* CTA */}
      <Section style={baseStyles.buttonSection}>
        <Button style={baseStyles.primaryButton} href={loginUrl}>
          开始使用 →
        </Button>
      </Section>
    </EmailLayout>
  );
}

export default WelcomeEmail;

const featureGrid: React.CSSProperties = {
  margin: "24px 0",
};

const featureCell: React.CSSProperties = {
  backgroundColor: colors.infoBg,
  border: `1px solid ${colors.infoBorder}`,
  borderRadius: "12px",
  padding: "16px",
  textAlign: "center",
  width: "50%",
};

const featureIcon: React.CSSProperties = {
  fontSize: "24px",
  margin: "0 0 4px",
};

const featureLabel: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: "600",
  color: colors.textPrimary,
  margin: "0",
};
