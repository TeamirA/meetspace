import { describe, expect, it, vi } from "vitest";
import { createTurnProvider } from "@/infrastructure/turn/turnProvider";

const cf = { cloudflareKeyId: "key", cloudflareApiToken: "token" };
const mt = { meteredAppName: "app", meteredSecretKey: "secret" };

function fakeFetch(opts: { cloudflare?: boolean; metered?: boolean }) {
  return vi.fn(async (input: string | URL) => {
    const url = String(input);
    if (url.includes("cloudflare")) {
      if (!opts.cloudflare) return new Response("nope", { status: 500 });
      return Response.json({
        iceServers: [
          { urls: ["stun:stun.cloudflare.com:3478"] },
          { urls: ["turn:turn.cloudflare.com:3478?transport=udp"], username: "u", credential: "c" },
        ],
      });
    }
    if (!opts.metered) return new Response("nope", { status: 401 });
    return Response.json({ username: "mu", password: "mp" });
  }) as unknown as typeof fetch;
}

const turnUrls = (servers: { urls: string | string[] }[]) =>
  servers.flatMap((s) => [s.urls].flat()).filter((u) => u.startsWith("turn"));

describe("TURN provider", () => {
  it("returns STUN only when nothing is configured", async () => {
    const servers = await createTurnProvider({}, fakeFetch({})).getIceServers(60);
    expect(turnUrls(servers)).toEqual([]);
  });

  it("works with Cloudflare alone", async () => {
    const servers = await createTurnProvider(cf, fakeFetch({ cloudflare: true })).getIceServers(60);
    expect(turnUrls(servers)).toEqual(["turn:turn.cloudflare.com:3478?transport=udp"]);
  });

  it("works with Metered alone", async () => {
    const servers = await createTurnProvider(mt, fakeFetch({ metered: true })).getIceServers(60);
    expect(turnUrls(servers).every((u) => u.includes("metered"))).toBe(true);
  });

  it("combines both providers", async () => {
    const servers = await createTurnProvider(
      { ...cf, ...mt },
      fakeFetch({ cloudflare: true, metered: true }),
    ).getIceServers(60);
    const urls = turnUrls(servers);
    expect(urls.some((u) => u.includes("cloudflare"))).toBe(true);
    expect(urls.some((u) => u.includes("metered"))).toBe(true);
  });

  it("falls back to the healthy provider when the other fails", async () => {
    const servers = await createTurnProvider(
      { ...cf, ...mt },
      fakeFetch({ cloudflare: false, metered: true }),
    ).getIceServers(60);
    expect(turnUrls(servers).every((u) => u.includes("metered"))).toBe(true);
    expect(turnUrls(servers).length).toBeGreaterThan(0);
  });
});
