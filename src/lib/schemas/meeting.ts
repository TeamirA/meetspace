import { z } from "zod";
import { displayNameSchema } from "./auth";

export const meetingCodeSchema = z.string().regex(/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/, "Invalid meeting code.");

export const createMeetingSchema = z
  .object({
    title: z.string().trim().min(1, "Give your meeting a title.").max(120),
    description: z.string().trim().max(2000).optional().nullable(),
    scheduledFor: z.iso.datetime({ offset: true }).optional().nullable(),
    durationMinutes: z
      .number()
      .int()
      .min(5)
      .max(24 * 60)
      .default(60),
    allowGuests: z.boolean().default(false),
    waitingRoom: z.boolean().default(true),
    e2eeMedia: z.boolean().default(false),
  })
  .refine((v) => !v.scheduledFor || new Date(v.scheduledFor).getTime() > Date.now() - 5 * 60_000, {
    message: "Pick a time in the future.",
    path: ["scheduledFor"],
  });
export type CreateMeetingInput = z.input<typeof createMeetingSchema>;

export const updateMeetingSchema = z.object({
  locked: z.boolean().optional(),
  waitingRoom: z.boolean().optional(),
  allowGuests: z.boolean().optional(),
});

export const joinMeetingSchema = z.object({
  /** Required for guests; signed-in users default to their profile name. */
  displayName: displayNameSchema.optional(),
});

export const hostActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("admit"), participantId: z.uuid() }),
  z.object({ action: z.literal("deny"), participantId: z.uuid() }),
  z.object({ action: z.literal("admit-all") }),
  z.object({ action: z.literal("remove"), participantId: z.uuid() }),
  z.object({ action: z.literal("mute"), participantId: z.uuid() }),
  z.object({ action: z.literal("transfer-host"), participantId: z.uuid() }),
  z.object({ action: z.literal("end") }),
]);
export type HostAction = z.infer<typeof hostActionSchema>;

export const listMeetingsQuerySchema = z.object({
  scope: z.enum(["upcoming", "recent", "history"]).default("upcoming"),
  cursor: z.uuid().optional(),
});
