import { z } from "zod";

export const emailSchema = z.email("Enter a valid email address.").max(254).trim().toLowerCase();

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(128, "Use at most 128 characters.")
  .refine((v) => /[a-zA-Z]/.test(v) && /[0-9]/.test(v), "Include at least one letter and one number.");

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a name.")
  .max(60, "Keep it under 60 characters.")
  .refine((v) => !/[<>\u0000-\u001f]/.test(v), "Name contains unsupported characters.");

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password.").max(128),
    newPassword: passwordSchema,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: "Choose a password you haven't used here.",
    path: ["newPassword"],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const deviceIdSchema = z.string().max(200).optional();

export const updateProfileSchema = z.object({
  displayName: displayNameSchema.optional(),
  avatarUrl: z
    .union([z.url({ protocol: /^https$/ }).max(500), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" ? null : v)),
  theme: z.enum(["SYSTEM", "DARK", "LIGHT"]).optional(),
  preferences: z
    .object({
      cameraId: deviceIdSchema,
      microphoneId: deviceIdSchema,
      speakerId: deviceIdSchema,
      noiseSuppression: z.boolean().optional(),
      echoCancellation: z.boolean().optional(),
    })
    .optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
