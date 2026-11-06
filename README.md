# Meetspace

[![CI](https://github.com/TeamirA/meetspace/actions/workflows/ci.yml/badge.svg)](https://github.com/TeamirA/meetspace/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Meetspace is a browser video-meeting app. It supports group video calls for up to 6 people, screen sharing, a shared whiteboard, and end-to-end encrypted chat and file sharing, with no plugin or install needed.

It's built with Next.js (App Router) and native WebRTC. Supabase provides the database, realtime signaling and file storage, and the app is deployed on Vercel.

**Live demo:** https://meetspace-taupe.vercel.app

## Contents

- [Quick start (try the live demo)](#quick-start-try-the-live-demo)
- [How to use Meetspace](#how-to-use-meetspace)
- [Features](#features)
- [Tech stack](#tech-stack)
- [How it works](#how-it-works)
- [Security model](#security-model)
- [Architecture](#architecture)
- [Data model](#data-model)
- [API reference](#api-reference)
- [Running locally](#running-locally)
- [Environment variables](#environment-variables)
- [Testing](#testing)
- [Deployment](#deployment)
- [Browser support and limits](#browser-support-and-limits)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Quick start (try the live demo)

1. Open https://meetspace-taupe.vercel.app and choose **Sign up**. Any well-formed email works, and no verification email is sent.
2. On the **Meetings** dashboard, choose **New meeting → Start an instant meeting**. Allow camera and microphone access when the browser asks.
3. Click **Invite** to copy the meeting link. Open it in a second browser profile, an incognito window or on another device, then sign in with a second account.
4. As the host, admit the second person from the waiting-room banner.
5. Try chat (`C`), the whiteboard (`W`), screen sharing (`S`), reactions, file sharing and the host controls in the people panel (`P`). Press `?` to see every shortcut.
6. End the meeting, then open it under **History** to see the saved whiteboard, the decrypted chat and the shared files.

## How to use Meetspace

### 1. Create an account and sign in

- Go to **Sign up** and enter your name, email and a password of 10–128 characters.
- You stay signed in across visits. Your session refreshes silently in the background.
- After 5 wrong passwords in a row, the account is locked for a short time.

### 2. Start or schedule a meeting

The **Meetings** page is your dashboard. It lists upcoming and recent meetings.

| Goal                        | How                                                                                                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Meet right now              | **New meeting → Start an instant meeting**. You go straight to the lobby.                                                                                                   |
| Plan a meeting              | **New meeting → Schedule for later**. Set a title, date, time, duration (5 min – 24 h) and description, and choose the options below. The meeting appears under _Upcoming_. |
| Share a meeting             | Use **Copy link** on the meeting card (or **Invite** during the call). Links look like `https://…/m/abc-defg-hij`.                                                          |
| Add it to a calendar        | Open the card's **⋯** menu and choose **Add to calendar** to download an `.ics` file.                                                                                       |
| Join someone else's meeting | Paste a code or link into **Join with code** on the dashboard, or just open the link.                                                                                       |

Meeting options (set when scheduling):

- **Waiting room** (on by default). Everyone except the host waits until they're admitted.
- **Allow guests.** People without an account can join by entering just a name.
- **End-to-end encrypt audio & video (beta).** Encrypts media frames inside the browser as well as in transit (see [Security model](#security-model)).

### 3. The lobby (pre-join screen)

Before you enter, you see a preview of yourself:

- Check your camera preview and the mic level meter.
- Pick your camera, microphone and speaker.
- Choose whether to join muted and/or with the camera off.
- Guests type the name the others will see.

Click **Join meeting** (the host sees **Start meeting**). If the meeting has a waiting room, you'll see "Waiting for the host to let you in" until the host admits you.

### 4. In the call

The control bar sits at the bottom of the screen. On phones it becomes a compact bottom bar with a **More** menu.

| Control      | Shortcut | What it does                                                                        |
| ------------ | :------: | ----------------------------------------------------------------------------------- |
| Microphone   |   `M`    | Mute or unmute yourself                                                             |
| Camera       |   `V`    | Turn your video on or off                                                           |
| Share screen |   `S`    | Share a screen, window or tab (with tab/system audio where the browser supports it) |
| Raise hand   |   `H`    | Raise or lower your hand. Hands are listed in the order they were raised            |
| Reactions    |    –     | Send a floating emoji to everyone                                                   |
| Whiteboard   |   `W`    | Open or close the shared whiteboard                                                 |
| Chat         |   `C`    | Open the encrypted chat panel                                                       |
| People       |   `P`    | See who's in the call and who's waiting (host controls live here)                   |
| Files        |   `F`    | See every file shared in this meeting                                               |
| Layout       |   `L`    | Switch between grid view and speaker view                                           |
| Shortcuts    |   `?`    | Show the shortcut list                                                              |
| More (⋯)     |    –     | Files, layout, live captions, recording, security code, audio & video settings      |
| Leave        |    –     | Leave the call (the host can also end it for everyone)                              |

Shortcuts don't fire while you're typing in a text box, and `Esc` closes any open panel.

Other things you can do on the stage:

- **Pin** a tile with the pin button on it to keep that person on the main stage. A shared screen takes the main stage automatically.
- **Picture-in-picture** (the button on a tile) keeps that video in a floating window while you use other tabs.
- The coloured bars on each tile show **connection quality** (from WebRTC stats). If the network drops, a "Reconnecting…" banner appears and the call recovers on its own.

### 5. Chat and file sharing

- Open chat with `C`. Messages support emoji, and `http(s)` links become clickable. The chat button shows an unread badge.
- To share a file (up to 50 MB), drag it onto the chat panel or use the paperclip button. A progress bar shows the upload.
- Everyone admitted can download a shared file from the chat or from the **Files** panel (`F`).
- Chat messages, files and even file names are encrypted in your browser before upload, so the server only ever stores ciphertext.

### 6. The whiteboard

Press `W` to open a board that everyone in the meeting shares.

- **Tools:** pen, highlighter, rectangle, ellipse, arrow, line, text, eraser, select/move and hand (pan).
- **Style:** colour and stroke-width pickers.
- **Edit and navigate:** undo/redo (`Ctrl/⌘+Z`, `Ctrl/⌘+Shift+Z`), zoom with `Ctrl/⌘` + wheel or the zoom buttons, and pan by scrolling, with the hand tool, or with the middle mouse button.
- **Export** the board as a PNG.
- The host can **clear the board** for everyone.
- The board saves automatically and is kept in the meeting's history.

### 7. Host controls

The person who created the meeting is the host. Open the people panel (`P`) to:

- **Admit or deny** people in the waiting room, or **Admit all**. A banner also pops up when someone is waiting.
- **Mute** a participant. They can unmute themselves.
- **Remove** a participant. They're disconnected, and the chat and file key rotates so they can't read anything sent afterwards.
- **Make host** to hand the host role to someone else.
- **Lock the meeting** so nobody new can join.
- **End meeting for everyone** from the leave menu.

### 8. Verifying encryption (security code)

Open **More → Security & encryption**. Everyone in the meeting should see the same short code. Compare it out loud. If the codes match, nobody intercepted the key exchange. The code changes whenever the key rotates.

### 9. Captions and recording

- **Live captions** (**More → Turn on live captions**) transcribe what each person says using the browser's Web Speech API (best in Chrome and Edge).
- **Record** (**More → Record to this device**) captures the call locally with `MediaRecorder` and saves a `.webm` file to your own device. Nothing is uploaded.

### 10. History

**History** lists every meeting you've been in, with its date, duration and participants. Open one to see:

- the saved whiteboard
- the full chat transcript, decrypted on this device
- every shared file, with downloads

Decryption uses the meeting key stored in this browser. On a different device, encrypted history can't be read, by design.

### 11. Settings

- **Profile:** display name and avatar URL.
- **Appearance:** theme (dark, light or system).
- **Audio & video:** default camera, microphone and speaker, plus noise suppression and echo cancellation.
- **Security:** change your password. This signs out your other sessions.

The app can also be installed as a PWA (**Install** in the browser address bar).

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
- Accessible: keyboard operable, visible focus rings, labelled controls, live-region announcements and reduced-motion support

## Tech stack

| Area           | Technology                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| Framework      | Next.js 16 (App Router, route handlers, `proxy.ts`), React 19, TypeScript                             |
| UI             | Tailwind CSS 4, Radix UI primitives (shadcn-style), Motion, Lucide icons, Sonner toasts               |
| State and data | Zustand (call and UI state), TanStack Query (server data), Zod (shared validation)                    |
| Real-time      | Native WebRTC mesh (perfect negotiation, Encoded Transforms), Supabase Realtime (presence, broadcast) |
| TURN/STUN      | Google STUN, plus Metered and/or Cloudflare TURN                                                      |
| Backend        | Next.js route handlers on Vercel, Clean Architecture use cases                                        |
| Database       | Supabase Postgres via Prisma 7 (`@prisma/adapter-pg`, Supavisor pooler), RLS forced                   |
| Storage        | Supabase Storage (private bucket, short-lived signed URLs)                                            |
| Auth           | Custom JWT (`jose`) + rotating refresh tokens, Argon2id (`@node-rs/argon2`)                           |
| Crypto         | Web Crypto: ECDH P-256, HKDF-SHA-256, AES-GCM-256                                                     |
| Whiteboard     | react-konva + perfect-freehand                                                                        |
| Quality        | Vitest, Testing Library, Playwright, ESLint, Prettier, Husky + lint-staged, GitHub Actions CI         |

## How it works

### Joining a call

1. The browser calls `POST /api/meetings/:code/join`. The server decides whether to admit the person, put them in the waiting room, or refuse (meeting locked or ended, no guests allowed, or the 6-person limit reached).
2. Once admitted, the browser fetches `/session` and `/turn` in parallel. `/session` returns a short-lived Supabase token that only allows this meeting's private Realtime topic. `/turn` returns ICE servers (STUN plus fresh TURN credentials).
3. The browser joins the room's Realtime channel and publishes its **presence**: name, role, mic/camera state, stream ids and its ECDH public key.
4. For every other person in presence, it opens an `RTCPeerConnection`. Offers, answers and ICE candidates travel as addressed broadcast messages, and ICE candidates are buffered until the remote description is set.
5. A heartbeat every 25 seconds keeps the participant marked as present. Someone silent for 70 seconds is treated as having left.

### Signaling and media

- **Topology.** Each room is a full mesh: every pair of participants has its own peer connection, so media goes directly between browsers (or through TURN when a direct path isn't possible).
- **Negotiation.** Uses the WebRTC _perfect negotiation_ pattern, so either side can renegotiate (for example when screen sharing starts) without offer collisions.
- **Data channel.** Each peer connection also carries a pre-negotiated data channel for low-latency whiteboard previews.
- **Two channels per room.** Every room has one private Supabase Realtime channel for presence and broadcast (signaling, key offers, chat notices, whiteboard ops), and a separate, server-only **system topic** for host decisions (admit, remove, mute, end), so clients can trust those events.

### End-to-end encryption

- The first admitted participant creates the meeting's AES-GCM group key.
- Each newcomer publishes an ECDH public key. A participant who already has the group key wraps it for the newcomer with an HKDF-derived pairwise key.
- Chat, files and file names are encrypted with that group key before they leave the browser. The server and database only ever store ciphertext.
- When the host removes someone, the room moves to a new key epoch that the removed person never receives.

### Whiteboard sync

- Only incremental ops are sent (`upsert`, `delete`, `clear`), each stamped with a Lamport clock. Every client converges on the same board whatever order the ops arrive in.
- Late joiners load the persisted board, then ask the earliest-joined participant (the "leader") for any changes not yet saved.
- The leader debounces saves to Postgres.

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

Rate limits are stored in Postgres, so they hold across serverless instances:

| Action          | Limit                                     |
| --------------- | ----------------------------------------- |
| Sign up         | 10 per IP per hour                        |
| Sign in         | 30 per IP and 10 per email per 15 minutes |
| Change password | 5 per 15 minutes                          |
| Create meeting  | 30 per hour                               |
| Join            | 60 per IP per 10 minutes                  |
| Chat            | 60 messages per minute                    |
| Whiteboard save | 60 per minute                             |
| File upload     | 20 per 10 minutes                         |

Known limits:

- A mesh tops out around 6 people.
- Key exchange trusts the relay unless people compare security codes.
- A removed participant can keep receiving room broadcasts until their 10-minute room token expires. Those broadcasts are encrypted under a key they don't have.
- Live captions use the browser's speech service, which may be cloud-based.

## Architecture

The code follows Clean Architecture: dependencies point inward, and infrastructure implements interfaces defined by the core.

```
src/
├── app/                 Routes, layouts, thin API route handlers (parse → use case → response)
│   ├── (marketing)/     Landing page
│   ├── (auth)/          Login and register
│   ├── (dashboard)/     Meetings, history, settings
│   ├── m/[code]/        Lobby, waiting room and the call itself
│   └── api/             REST endpoints (see API reference)
├── core/
│   ├── domain/          Entities and pure rules (join policy, lockout, meeting codes), repository interfaces, errors
│   └── application/     One use case per file, DTOs, ports (hasher, tokens, storage, TURN, realtime)
├── infrastructure/      Prisma repositories, Argon2/JWT, Supabase Storage and Realtime, TURN, env, DI container
├── media/               Framework-agnostic WebRTC: CallSession, PeerConnectionManager, SignalingClient,
│                        LocalMediaController, ScreenShareController, ActiveSpeakerDetector,
│                        ConnectionStatsMonitor, MediaE2EE, LiveCaptions, LocalRecorder
├── crypto/              ECDH key exchange, AES-GCM content encryption, MeetingKeyring, IndexedDB key store
├── whiteboard/          CRDT-style board model (Lamport clocks, tombstones), undo/redo, sync protocol
├── components/          ui/ primitives (Radix-based) and features/ (call, lobby, chat, files, whiteboard…)
├── hooks/, stores/      React hooks, and Zustand stores for call and UI state
├── lib/                 Shared Zod schemas, API client with token refresh, sanitizer, ICS builder
└── proxy.ts             Per-request CSP nonce and route protection
prisma/                  Schema and SQL migrations
supabase/                Realtime RLS policies and Storage bucket setup
public/e2ee-worker.js    Worker that encrypts/decrypts media frames
tests/                   unit/, integration/ and e2e/ suites
docs/turn-setup.md       Step-by-step TURN provider setup
```

`CallSession` is the in-browser orchestrator. It owns the signaling client, one peer connection per remote participant, local media, the keyring and the whiteboard sync, and it exposes plain events that the React layer maps into the Zustand call store.

## Data model

| Table                | Purpose                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| `users`              | Account, Argon2id hash, display name, avatar, theme, device preferences, failed-login counter and lockout     |
| `refresh_tokens`     | HMAC-hashed refresh tokens grouped by family, for rotation and reuse detection                                |
| `rate_limit_buckets` | Fixed-window counters for the rate limits above                                                               |
| `meetings`           | Code, title, schedule, host, status (`SCHEDULED`/`LIVE`/`ENDED`), waiting room, guests, lock, E2EE media      |
| `participants`       | Membership per meeting: role (`HOST`/`PARTICIPANT`/`GUEST`), status (`WAITING`/`ADMITTED`/…), heartbeat, hand |
| `chat_messages`      | Encrypted chat (key id, IV, ciphertext)                                                                       |
| `shared_files`       | Encrypted file metadata and the Storage object path                                                           |
| `whiteboards`        | The latest persisted board snapshot per meeting                                                               |

## API reference

All endpoints live under `/api`, take and return JSON, and are validated with Zod. Authentication uses `httpOnly` cookies, and state-changing requests must come from the same origin.

| Method                     | Path                                     | Description                                                                          |
| -------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------ |
| `POST`                     | `/auth/register`                         | Create an account and sign in                                                        |
| `POST`                     | `/auth/login`                            | Sign in                                                                              |
| `POST`                     | `/auth/refresh`                          | Rotate the refresh token and issue a new access token                                |
| `POST`                     | `/auth/logout`                           | Sign out and revoke the token family                                                 |
| `GET` / `PATCH`            | `/auth/me`                               | Read or update the profile and preferences                                           |
| `POST`                     | `/auth/password`                         | Change the password                                                                  |
| `GET` / `POST`             | `/meetings`                              | List my meetings / create one                                                        |
| `GET` / `PATCH` / `DELETE` | `/meetings/:code`                        | Meeting summary / update lock, waiting room, guests / delete                         |
| `GET`                      | `/meetings/:code/details`                | History details: participants, files, whiteboard                                     |
| `GET`                      | `/meetings/:code/ics`                    | Download an `.ics` calendar invite                                                   |
| `POST`                     | `/meetings/:code/join`                   | Ask to join (admitted, waiting or refused)                                           |
| `GET`                      | `/meetings/:code/me`                     | My current participant status                                                        |
| `POST`                     | `/meetings/:code/session`                | Short-lived Realtime token and topics                                                |
| `GET`                      | `/meetings/:code/turn`                   | ICE servers (STUN plus TURN credentials)                                             |
| `POST`                     | `/meetings/:code/heartbeat`              | Keep my presence alive                                                               |
| `POST`                     | `/meetings/:code/leave`                  | Leave the meeting                                                                    |
| `GET`                      | `/meetings/:code/participants`           | Participants and the waiting list                                                    |
| `POST`                     | `/meetings/:code/host`                   | Host actions: `admit`, `deny`, `admit-all`, `remove`, `mute`, `transfer-host`, `end` |
| `GET` / `POST`             | `/meetings/:code/messages`               | Encrypted chat history / send a message                                              |
| `GET` / `POST`             | `/meetings/:code/files`                  | List files / start an upload (returns a signed upload URL)                           |
| `POST`                     | `/meetings/:code/files/:fileId/complete` | Mark an upload finished and notify the room                                          |
| `GET`                      | `/meetings/:code/files/:fileId`          | 60-second signed download URL                                                        |
| `GET` / `PUT`              | `/meetings/:code/whiteboard`             | Load or save the board snapshot                                                      |
| `GET`                      | `/health`                                | Liveness check                                                                       |

## Running locally

Requirements: Node 24+, npm 11+, a Supabase project, and optionally Metered or Cloudflare TURN credentials.

```bash
git clone https://github.com/TeamirA/meetspace.git
```

```bash
cd meetspace && npm install
```

```bash
cp .env.example .env.local
```

Fill in `.env.local` (see [Environment variables](#environment-variables)), then set up the database:

```bash
npm run db:migrate
```

```bash
npm run dev
```

Then open http://localhost:3000.

### One-time Supabase setup

1. Create a `meetspace_app` login role with `USAGE, CREATE` on `public`. Prisma connects as this role through the Supavisor pooler.
2. Run the migrations (`npm run db:migrate`). They create the tables and enable and force RLS.
3. Run [supabase/realtime-and-storage.sql](supabase/realtime-and-storage.sql) in the SQL editor. It adds the RLS policies on `realtime.messages` (members can read their room and system topics but write only to the room topic) and creates the private `meeting-files` Storage bucket (51 MB limit, no public policies).
4. Copy the service role key and the legacy JWT secret into `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_JWT_SECRET`.

Without TURN keys, calls use Google STUN only. That works on most networks but not behind strict symmetric NATs or corporate firewalls. Configure Metered, Cloudflare or both to enable relaying; [docs/turn-setup.md](docs/turn-setup.md) has step-by-step instructions.

### Scripts

| Command                    | What it does                                        |
| -------------------------- | --------------------------------------------------- |
| `npm run dev`              | Start the dev server (Turbopack)                    |
| `npm run build`            | Generate the Prisma client and build for production |
| `npm start`                | Serve the production build                          |
| `npm run lint`             | ESLint                                              |
| `npm run typecheck`        | Generate route types, then run `tsc --noEmit`       |
| `npm run format`           | Prettier                                            |
| `npm run db:migrate`       | Apply Prisma migrations                             |
| `npm run test:unit`        | Unit tests                                          |
| `npm run test:integration` | Repository tests against a real Postgres schema     |
| `npm run test:e2e`         | Playwright end-to-end tests                         |

Husky runs lint-staged (ESLint and Prettier) on every commit.

## Environment variables

See [.env.example](.env.example) for a template. Variables marked _public_ are sent to the browser; everything else stays on the server.

| Variable                        | Required | Description                                                       |
| ------------------------------- | :------: | ----------------------------------------------------------------- |
| `DATABASE_URL`                  |   Yes    | Postgres URL through the Supavisor transaction pooler (port 6543) |
| `DIRECT_URL`                    |   Yes    | Session pooler URL (port 5432), used for migrations               |
| `JWT_ACCESS_SECRET`             |   Yes    | 32+ characters. Signs access tokens (`openssl rand -base64 48`)   |
| `JWT_REFRESH_SECRET`            |   Yes    | 32+ characters. HMAC key for refresh-token hashes                 |
| `ROOM_TOPIC_SECRET`             |   Yes    | 16+ characters. Derives unguessable Realtime topic names          |
| `NEXT_PUBLIC_SUPABASE_URL`      |   Yes    | _Public._ Supabase project URL                                    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` |   Yes    | _Public._ Supabase publishable key                                |
| `SUPABASE_SERVICE_ROLE_KEY`     |   Yes¹   | Storage signed URLs and server broadcasts on the system topic     |
| `SUPABASE_JWT_SECRET`           |   Yes¹   | Signs the short-lived Realtime room tokens checked by RLS         |
| `NEXT_PUBLIC_APP_URL`           |    No    | _Public._ Base URL for invite links and `.ics` files              |
| `METERED_APP_NAME`              |    No    | Metered app name (e.g. `myapp` or `myapp.metered.live`)           |
| `METERED_SECRET_KEY`            |    No    | Metered secret key or TURN credential API key                     |
| `CLOUDFLARE_TURN_KEY_ID`        |    No    | Cloudflare Realtime TURN key id                                   |
| `CLOUDFLARE_TURN_API_TOKEN`     |    No    | Cloudflare Realtime TURN API token                                |
| `TEST_DATABASE_URL`             |    No    | Postgres URL with `?schema=test`, for integration tests           |

¹ Calls, chat and file sharing need these; sign-in and the dashboard work without them.

## Testing

```bash
npm run test:unit
```

```bash
npm run test:integration
```

```bash
npm run test:e2e
```

- **Unit (Vitest):** domain rules, use cases against in-memory repositories, crypto (key exchange, wrapping, encryption), the whiteboard CRDT, TURN providers, schemas and sanitizing.
- **Integration (Vitest):** Prisma repositories against Postgres in an isolated schema (set `TEST_DATABASE_URL=...?schema=test`).
- **End-to-end (Playwright):** registration and login, the dashboard, responsive layouts and a full two-person call (waiting room, admit, video, chat, whiteboard, leave), using Chromium's fake camera and microphone. Call tests need the Supabase keys in `.env.local`.

GitHub Actions runs lint, typecheck, unit tests and a production build on every push and pull request.

## Deployment

The app runs entirely on Vercel (serverless route handlers plus static assets), with functions in the region closest to the database. There's no long-running server: Supabase handles realtime, storage and the database.

1. Import the repository into Vercel.
2. Add the variables from [Environment variables](#environment-variables) to the project.
3. Push to `main`. Vercel builds with `npm run build` and deploys.
4. Check `https://<your-domain>/api/health`. It should return `{ "ok": true }`.

## Browser support and limits

- **Supported browsers:** current Chrome, Edge, Firefox and Safari, on desktop and mobile.
- **Screen sharing** is desktop only. Sharing tab or system audio depends on the browser (best in Chrome and Edge).
- **E2EE media** needs Encoded Transforms (`RTCRtpScriptTransform` or `createEncodedStreams`). Browsers without it can't join a meeting that has E2EE media turned on.
- **Live captions** need the Web Speech API (Chrome and Edge).
- **Meeting size:** up to 6 participants (mesh topology).
- **File size:** up to 50 MB per file.

## Troubleshooting

| Problem                                    | Fix                                                                                                                  |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| "Camera or microphone blocked"             | Allow access from the padlock icon in the address bar, then reload. Close other apps that might be using the camera. |
| Stuck on "Connecting…" with someone        | One of you is probably behind a strict NAT or firewall. Configure TURN ([docs/turn-setup.md](docs/turn-setup.md)).   |
| Chat says "Setting up encryption…"         | The key arrives from another participant within a few seconds. If you're alone, it's created automatically.          |
| Old chat in History shows as locked        | History is decrypted with keys stored in the browser that took part. Open it on that same browser and device.        |
| "The host has locked this meeting."        | Ask the host to unlock it from the people panel.                                                                     |
| `Invalid server environment: …` at startup | A required variable is missing or too short. Compare `.env.local` with `.env.example`.                               |

## License

[MIT](LICENSE) © 2026 Teamir Abdurahman
