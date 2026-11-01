# TURN relay setup

Calls connect peer to peer. When two people sit behind strict NATs or firewalls (corporate Wi-Fi, some mobile carriers), they need a **TURN relay**. Meetspace supports two hosted providers. Configure **either one, or both**. With both, browsers get relays from each and pick whichever works, and if one provider is down or over quota, the other keeps calls working. With neither, calls fall back to Google STUN only.

Relay credentials are created per call by the server (`/api/meetings/:code/turn`), are short-lived, and are only issued to admitted members. Your provider secrets never reach the browser.

## Option A — Cloudflare Realtime TURN

1. Sign in (or sign up for free) at <https://dash.cloudflare.com>.
2. In the left sidebar, open **Realtime** → **TURN Server**.
3. Click **Create** (TURN key / application), give it a name such as `meetspace`, and confirm.
4. Cloudflare shows two values. Copy both right away; the token is shown only once.
   - **Turn Token ID** → `CLOUDFLARE_TURN_KEY_ID`
   - **API Token** → `CLOUDFLARE_TURN_API_TOKEN`

## Option B — Metered.ca

1. Sign up for the free plan at <https://www.metered.ca/stun-turn>.
2. During onboarding, create an **App**. Its name becomes your subdomain, e.g. `meetspace` → `meetspace.metered.live`.
3. In the dashboard, open **Developers** (or **API Keys**) and copy the **Secret Key**.
   - App name (just the subdomain part, without `.metered.live`) → `METERED_APP_NAME`
   - Secret Key → `METERED_SECRET_KEY`

## Add the values

**Production (Vercel)**

1. Open <https://vercel.com/teamiras-projects/meetspace/settings/environment-variables>.
2. Add the two variables for each provider you set up, for the Production and Preview environments.
3. Open **Deployments**, then on the latest deployment choose **⋯ → Redeploy**. Environment changes apply only to new deployments.

**Local development**: fill in the same lines in `.env.local`, then restart `npm run dev`.

## Check that it works

1. Join a meeting from two devices (for example, a laptop and a phone on mobile data).
2. In Chrome, open `chrome://webrtc-internals`. Under the peer connection's ICE candidate pairs you should see `relay` candidates. If a relay ended up being used, the connection-quality tooltip still reads normally, and calls connect even on networks where they used to time out.
3. If a provider is misconfigured, Vercel's function logs show `[turn] cloudflare unavailable: …` or `[turn] metered unavailable: …`, and the call continues on the other provider or on STUN.
