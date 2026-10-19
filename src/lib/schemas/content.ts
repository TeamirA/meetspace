import { z } from "zod";
import { MAX_CHAT_CIPHERTEXT } from "@/core/domain/entities/ChatMessage";
import { GCM_TAG_BYTES, MAX_FILE_BYTES } from "@/core/domain/entities/SharedFile";
import { MAX_BOARD_ELEMENTS, MAX_STROKE_POINTS } from "@/core/domain/entities/Whiteboard";

const base64 = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, "Expected base64.");

/** AES-GCM 96-bit IV, base64-encoded (16 chars). */
export const ivSchema = base64(24);
export const keyIdSchema = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);

export const chatMessageSchema = z.object({
  id: z.uuid(),
  keyId: keyIdSchema,
  iv: ivSchema,
  ciphertext: base64(MAX_CHAT_CIPHERTEXT),
});
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

export const createFileSchema = z.object({
  id: z.uuid(),
  keyId: keyIdSchema,
  iv: ivSchema,
  encryptedMeta: base64(4000),
  metaIv: ivSchema,
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_FILE_BYTES + GCM_TAG_BYTES, "Files can be up to 50 MB."),
});
export type CreateFileInput = z.infer<typeof createFileSchema>;

const coord = z.number().finite().min(-1e6).max(1e6);
const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/);
const baseElement = {
  id: z.string().min(1).max(64),
  authorId: z.string().min(1).max(64),
  color: colorSchema,
  size: z.number().min(0.5).max(200),
  clock: z.number().int().nonnegative(),
};

export const boardElementSchema = z.discriminatedUnion("type", [
  z.object({
    ...baseElement,
    type: z.enum(["pen", "highlighter"]),
    points: z.array(z.tuple([coord, coord, z.number().min(0).max(1)])).max(MAX_STROKE_POINTS),
  }),
  z.object({
    ...baseElement,
    type: z.enum(["rect", "ellipse"]),
    x: coord,
    y: coord,
    width: coord,
    height: coord,
  }),
  z.object({
    ...baseElement,
    type: z.enum(["line", "arrow"]),
    x: coord,
    y: coord,
    points: z.tuple([coord, coord, coord, coord]),
  }),
  z.object({ ...baseElement, type: z.literal("text"), x: coord, y: coord, text: z.string().max(2000) }),
]);

export const saveWhiteboardSchema = z.object({
  elements: z.array(boardElementSchema).max(MAX_BOARD_ELEMENTS),
});
