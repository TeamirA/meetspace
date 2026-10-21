import "server-only";
import type { Deps } from "@/core/application/context";
import { systemClock } from "@/core/application/ports";
import { argon2Hasher } from "./auth/passwordHasher";
import { createTokenService } from "./auth/tokenService";
import { prisma } from "./database/prisma";
import { createRepositories } from "./database/repositories";
import { env } from "./env";
import { createRoomBroadcaster, createRoomTokenIssuer } from "./realtime/roomTokens";
import { createSupabaseStorage } from "./storage/supabaseStorage";
import { createTurnProvider } from "./turn/turnProvider";

let deps: Deps | undefined;

/** Composition root: wires infrastructure implementations into the application's ports. */
export function container(): Deps {
  if (deps) return deps;
  const e = env();
  deps = {
    ...createRepositories(prisma()),
    hasher: argon2Hasher,
    tokens: createTokenService({ accessSecret: e.JWT_ACCESS_SECRET, refreshSecret: e.JWT_REFRESH_SECRET }),
    roomTokens: createRoomTokenIssuer({ topicSecret: e.ROOM_TOPIC_SECRET, jwtSecret: e.SUPABASE_JWT_SECRET }),
    broadcaster: createRoomBroadcaster({
      supabaseUrl: e.NEXT_PUBLIC_SUPABASE_URL,
      serviceRoleKey: e.SUPABASE_SERVICE_ROLE_KEY,
    }),
    storage: createSupabaseStorage({
      supabaseUrl: e.NEXT_PUBLIC_SUPABASE_URL,
      serviceRoleKey: e.SUPABASE_SERVICE_ROLE_KEY,
    }),
    turn: createTurnProvider({
      meteredAppName: e.METERED_APP_NAME,
      meteredSecretKey: e.METERED_SECRET_KEY,
      cloudflareKeyId: e.CLOUDFLARE_TURN_KEY_ID,
      cloudflareApiToken: e.CLOUDFLARE_TURN_API_TOKEN,
    }),
    clock: systemClock,
  };
  return deps;
}
