# Meetspace

[![CI](https://github.com/TeamirA/meetspace/actions/workflows/ci.yml/badge.svg)](https://github.com/TeamirA/meetspace/actions/workflows/ci.yml)

Video meetings, screen sharing, a shared whiteboard and end-to-end encrypted chat and files, in the browser.
Built with Next.js (App Router), native WebRTC, Supabase (Postgres, Realtime, Storage) and deployed on Vercel.

**Live demo:** https://meetspace-taupe.vercel.app

## Try it

1. Open the live demo and create an account (any email format works; no verification email is sent).
2. On the dashboard, choose **New meeting → Start an instant meeting** and allow camera and microphone access.
3. Copy the link with **Invite** and open it in a second browser profile or on another device, signed in with a second account.
4. Admit the second person from the waiting-room banner, then try chat (`C`), the whiteboard (`W`), screen sharing (`S`), reactions, file sharing in the chat panel and the host controls in the people panel (`P`). Press `?` for all shortcuts.
5. End the meeting and open it under **History** to see the saved whiteboard, decrypted chat and shared files.

## Tech stack

Next.js 16 (App Router, route handlers, proxy) · TypeScript · Tailwind CSS 4 · Radix UI · Motion · Zustand · TanStack Query · native WebRTC (mesh, perfect negotiation, Encoded Transforms) · Supabase Realtime, Postgres and Storage · Prisma 7 · Web Crypto (ECDH, HKDF, AES-GCM) · Argon2id + JWT · react-konva + perfect-freehand · Zod · Vitest · Playwright · Vercel · Metered/Cloudflare TURN

## Features

**Meetings**

- Instant or scheduled meetings with short codes (`/m/abc-defg-hij`), copy link and `.ics` calendar export
- Dashboard with upcoming and recent meetings, plus "Join with code"
- Pre-join lobby: camera preview, mic level meter, device selection, join muted or with camera off
- Waiting room, lock meeting, mute or remove participants, transfer host, end for everyone
- Guests can join with just a name when the host allows it

**In the call**

- Mesh WebRTC for up to 6 people, using the perfect-negotiation pattern
- Grid and speaker views, active-speaker detection (Web Audio), pin any tile, picture-in-picture
- Per-participant connection quality from `getStats()`
- Automatic ICE restarts and a "Reconnecting…" banner on network drops
- Screen, window or tab sharing with system audio where supported; a shared screen takes the main stage automatically
- Encrypted chat with emoji, unread badge and safe link rendering
- Encrypted file sharing up to 50 MB, with drag-and-drop, upload progress and a files panel
- Reactions, raise hand (ordered by time), live captions (Web Speech API) and local recording (`MediaRecorder`, saved to your device)
- Collaborative whiteboard: pen, highlighter, rectangle, ellipse, arrow, line, text, eraser and select/move, plus colours, widths, undo/redo, zoom/pan, PNG export and a host-only "clear board"
- Keyboard shortcuts: `M` `V` `S` `H` `C` `P` `F` `W` `L`, with `?` for help

**Everything else**

- History of past meetings with participants, duration, shared files, chat transcript and the saved whiteboard
- Settings: display name, avatar, default devices, noise suppression and echo cancellation, theme
- Dark-first design with a light mode, responsive down to phones (bottom control bar, full-screen panels), installable PWA

## Security model

| Layer               | Protection                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Audio and video     | Always encrypted in transit by WebRTC's **DTLS-SRTP**, peer to peer. Media never touches our servers (unless a TURN relay is used, which only sees SRTP ciphertext).                                                                                                                                                                                                                                                               |
| Optional E2EE media | Per meeting ("End-to-end encrypt audio & video"). Frames are AES-GCM encrypted in a worker with **Encoded Transforms** (`RTCRtpScriptTransform`, or Chrome's `createEncodedStreams`), using a key derived from the meeting key, so a TURN relay or any middlebox sees only ciphertext even after SRTP is removed. VP8 is preferred so the codec header can stay in the clear.                                                      |
| Chat and files      | **End-to-end encrypted.** Each participant creates an ephemeral ECDH P-256 key pair and publishes the public key in presence. A participant who holds the meeting's AES-GCM-256 group key wraps it for each newcomer using an HKDF-derived pairwise key. Messages, files _and file names_ are encrypted in the browser with AES-GCM (random 96-bit IV, with the meeting id as associated data). The server stores only ciphertext. |
| Key verification    | Every participant sees a **security code** (derived from the group key). Comparing it out loud detects a man-in-the-middle during the key exchange.                                                                                                                                                                                                                                                                                |
| Key rotation        | When the host removes someone, the room rotates to a new key epoch that the removed person never receives.                                                                                                                                                                                                                                                                                                                         |
| Key storage         | Group keys are kept in IndexedDB as `CryptoKey` objects, so history stays readable on the same device. They never leave the browser.                                                                                                                                                                                                                                                                                               |
| Auth                | Argon2id (19 MiB, t=2) password hashing. A 15-minute access JWT and a rotating refresh token, both in `httpOnly` cookies (the refresh cookie is `SameSite=Strict` and scoped to `/api/auth`). Refresh-token reuse revokes the whole token family. Lockout after 5 failed logins, plus IP and email rate limits.                                                                                                                    |
| Transport           | HTTPS, HSTS, a nonce-based CSP, `X-Frame-Options: DENY`, a strict `Permissions-Policy`, and same-origin checks on every state-changing API call.                                                                                                                                                                                                                                                                                   |
| Authorization       | Realtime **private channels**: the server issues a short-lived Supabase JWT whose `room_topic` claim is the only topic RLS on `realtime.messages` allows. Host decisions go out on a separate server-only system topic, so clients can trust them. TURN credentials, chat, files (via 60-second signed URLs on a private bucket) and the whiteboard all require admitted membership.                                               |
| Database            | All tables are owned by a dedicated `meetspace_app` role with **RLS enabled and forced** and an owner-only policy, so Supabase's `anon` and `authenticated` roles can't read or write anything.                                                                                                                                                                                                                                    |
| Input               | Every request body is validated with shared Zod schemas. Chat is rendered as text (never HTML); only `http(s)` URLs become links, and control and bidi-override characters are stripped.                                                                                                                                                                                                                                           |

Known limits: a mesh tops out around 6 people. Key exchange trusts the relay unless people compare security codes. A removed participant can keep receiving room broadcasts (now encrypted under a key they don't have) until their 10-minute room token expires. Live captions use the browser's speech service, which may be cloud-based.

## Architecture

The code follows Clean Architecture: dependencies point inward, and infrastructure implements domain interfaces.

```
src/
├── app/                 Routes, layouts, thin API route handlers (parse → use case → response)
├── core/
│   ├── domain/          Entities and pure rules (join policy, lockout, meeting codes), repository interfaces, errors
│   └── application/     One use case per file, DTOs, ports (hasher, tokens, storage, TURN, realtime)
├── infrastructure/      Prisma repositories, Argon2/JWT, Supabase Storage and Realtime, TURN, DI container
├── media/               Framework-agnostic WebRTC: CallSession, PeerConnectionManager, SignalingClient,
│                        LocalMediaController, ScreenShareController, ActiveSpeakerDetector,
│                        ConnectionStatsMonitor, MediaE2EE, LiveCaptions, LocalRecorder
├── crypto/              ECDH key exchange, AES-GCM content encryption, MeetingKeyring, IndexedDB key store
├── whiteboard/          CRDT-style board model (Lamport clocks, tombstones), undo/redo, sync protocol
├── components/          ui/ primitives (Radix-based) and features/ (call, lobby, chat, files, whiteboard…)
├── hooks/, stores/      React hooks, and Zustand stores for call and UI state
└── lib/                 Shared Zod schemas, API client with token refresh, sanitizer, ICS builder
```

**Signaling.** Each room uses one private Supabase Realtime channel. Presence carries each person's media state, ECDH public key and key id. Broadcast envelopes are addressed to a participant _and session_ (offer/answer/ICE, key offers, chat, file notices, whiteboard ops). Peer connections each carry a pre-negotiated data channel for low-latency whiteboard previews.

**Whiteboard sync.** Only incremental ops are sent (`upsert`, `delete`, `clear`), each stamped with a Lamport clock, so every client converges whatever the delivery order. Late joiners load the persisted board and ask the earliest-joined participant for unsaved changes. That same "leader" debounces saves to Postgres.

## Getting started

Requirements: Node 24+, a Supabase project, and (optionally) Metered or Cloudflare TURN credentials.

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run db:migrate           # applies prisma/migrations
npm run dev
```

Supabase setup (already applied to the production project):

1. Create a `meetspace_app` login role with `USAGE, CREATE` on `public`. Prisma connects as this role through the Supavisor pooler.
2. Run the migrations. They create the tables and enable and force RLS.
3. Run [supabase/realtime-and-storage.sql](supabase/realtime-and-storage.sql). It adds the RLS policies on `realtime.messages` (members can read their room and system topics, but write only to the room topic) and creates the private `meeting-files` Storage bucket (51 MB limit, no policies).
4. Copy the service role key and the legacy JWT secret into `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_JWT_SECRET`.

Without TURN keys, calls use Google STUN only. That works on most networks but not behind strict symmetric NATs. Configure Cloudflare, Metered, or both to enable relaying; step-by-step instructions are in [docs/turn-setup.md](docs/turn-setup.md).

## Testing

```bash
npm run test:unit          # Vitest: domain rules, use cases (in-memory repos), crypto, whiteboard CRDT, schemas
npm run test:integration   # Vitest against Postgres in an isolated schema (set TEST_DATABASE_URL=...?schema=test)
npm run test:e2e           # Playwright with Chromium's fake camera/mic (call tests need the Supabase keys)
npm run lint && npm run typecheck
```

## Deployment

The app runs entirely on Vercel (serverless route handlers plus static assets). There's no long-running server: Supabase handles realtime, storage and the database. Set the variables from `.env.example` in the Vercel project, then push to `main`.

## License

[MIT](LICENSE) © 2026 Teamir Abdurahman
