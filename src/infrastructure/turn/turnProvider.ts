import type { IceServer, TurnCredentialProvider } from "@/core/application/ports";

const GOOGLE_STUN: IceServer = {
  urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"],
};

export interface TurnConfig {
  meteredAppName?: string;
  meteredSecretKey?: string;
  cloudflareKeyId?: string;
  cloudflareApiToken?: string;
}

type Fetch = typeof fetch;

/** Short-lived Cloudflare Realtime TURN credentials (ttl in seconds). */
async function cloudflare(config: TurnConfig, ttl: number, f: Fetch): Promise<IceServer[]> {
  const res = await f(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${config.cloudflareKeyId}/credentials/generate-ice-servers`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${config.cloudflareApiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl }),
      cache: "no-store",
    },
  );
  if (!res.ok) throw new Error(`Cloudflare TURN ${res.status}`);
  const body = (await res.json()) as { iceServers: IceServer | IceServer[] };
  // Drop Cloudflare's own STUN entries; we already include Google STUN once.
  return ([] as IceServer[]).concat(body.iceServers).filter((s) => [s.urls].flat().some((u) => u.startsWith("turn")));
}

/** Accepts "myapp", "myapp.metered.live" or "https://myapp.metered.live/" and returns "myapp". */
export function meteredSubdomain(appName: string): string {
  return appName
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/\.metered\.live$/i, "")
    .toLowerCase();
}

/**
 * Metered.ca credentials. Preferred: create a short-lived credential with the account
 * *Secret Key*. If that key is rejected, the value is treated as a credential *API key* (the one
 * shown on Metered's "TURN Credentials" page) and the ready-made ICE server list is fetched.
 */
async function metered(config: TurnConfig, ttl: number, f: Fetch): Promise<IceServer[]> {
  const base = `https://${meteredSubdomain(config.meteredAppName!)}.metered.live/api/v1/turn`;
  const key = config.meteredSecretKey!.trim();

  const create = await f(`${base}/credential?secretKey=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expiryInSeconds: ttl, label: "meetspace" }),
    cache: "no-store",
  });
  if (create.ok) {
    const cred = (await create.json()) as { username: string; password: string };
    const host = "global.relay.metered.ca";
    return [
      {
        urls: [
          `turn:${host}:80`,
          `turn:${host}:80?transport=tcp`,
          `turn:${host}:443`,
          `turns:${host}:443?transport=tcp`,
        ],
        username: cred.username,
        credential: cred.password,
      },
    ];
  }

  const list = await f(`${base}/credentials?apiKey=${encodeURIComponent(key)}`, { cache: "no-store" });
  if (!list.ok) throw new Error(`Metered TURN ${create.status} (secret key) / ${list.status} (API key)`);
  const servers = (await list.json()) as IceServer[];
  return servers.filter((s) => [s.urls].flat().some((u) => u.startsWith("turn")));
}

/**
 * Google STUN plus TURN from Cloudflare and/or Metered, whichever are configured. With both,
 * the browser gets relays from each and ICE picks whichever works best; if one provider is down
 * or over quota, the other still covers calls. Any failure degrades to STUN-only.
 */
export function createTurnProvider(config: TurnConfig, f: Fetch = fetch): TurnCredentialProvider {
  const providers: { name: string; get: (ttl: number) => Promise<IceServer[]> }[] = [];
  if (config.cloudflareKeyId && config.cloudflareApiToken) {
    providers.push({ name: "cloudflare", get: (ttl) => cloudflare(config, ttl, f) });
  }
  if (config.meteredAppName && config.meteredSecretKey) {
    providers.push({ name: "metered", get: (ttl) => metered(config, ttl, f) });
  }

  return {
    async getIceServers(ttlSeconds) {
      const results = await Promise.allSettled(providers.map((p) => p.get(ttlSeconds)));
      const relays: IceServer[] = [];
      results.forEach((r, i) => {
        if (r.status === "fulfilled") relays.push(...r.value);
        else console.warn(`[turn] ${providers[i].name} unavailable:`, (r.reason as Error).message);
      });
      return [GOOGLE_STUN, ...relays];
    },
  };
}
