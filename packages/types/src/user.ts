import { z } from "zod";

export const UserSettingsSchema = z.object({
  avatarUrl: z.string().nullable().optional(),
  langMode: z.enum(["auto", "zh", "en"]).optional(),
  themeMode: z.enum(["auto", "light", "dark"]).optional()
});

export const UserSettingsPatchSchema = UserSettingsSchema.partial();

export type UserSettings = z.infer<typeof UserSettingsSchema>;

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(["admin", "user"]),
  emailVerified: z.boolean(),
  settings: UserSettingsSchema.nullable().optional()
});

export type User = z.infer<typeof UserSchema>;
