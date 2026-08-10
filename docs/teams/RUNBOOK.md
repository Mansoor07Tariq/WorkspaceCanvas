# Teams Adapter — Owner Runbook (PR 078)

This is the **owner-only** setup. The engineer's code (endpoint, JWT validation,
Connector reply) ships in `backend/chat/adapters/teams/`. Everything below happens in
the owner's Azure tenant and Teams client — no secrets live in the repo.

## 0. What you're wiring

```
Teams client ──activity──▶ Bot Framework ──HTTPS POST──▶ (tunnel) ──▶ /api/chat/teams/messages/
                                                                          │ validate JWT
                                                                          │ dedupe + route
        Teams client ◀──Adaptive Card──── Connector API ◀──reply─────────┘
```

## 1. Azure app registration (the bot identity)

1. Azure Portal → **Azure Bot** resource → create.
   - **App type: Single Tenant.** Azure no longer offers Multi Tenant for new Azure Bot
     resources — the adapter is built for single-tenant token semantics accordingly.
   - This creates a **Microsoft App ID** in **your tenant**, and lets you generate a
     **client secret**. Note the tenant's **Directory (tenant) ID** (Azure AD overview).
   - This app is **separate** from the social-login app (`MICROSOFT_CLIENT_ID`) — do
     not reuse those IDs.
2. Copy the **App ID**, the **client secret value** (shown once), and the **tenant ID**.
3. Put all three in `backend/.env` **only** (never commit):
   ```
   MICROSOFT_APP_ID=<app id>
   MICROSOFT_APP_PASSWORD=<client secret value>
   MICROSOFT_APP_TENANT_ID=<directory (tenant) id>
   ```
   > The endpoint **fails closed (503)** until **all three** are set. The token validator
   > is never run against an empty audience, and the tenant is required because we won't
   > accept an inbound activity we couldn't reply to (the outbound token needs it).
   >
   > **Inbound vs outbound auth (live-verified, review/30):** the two directions use
   > *different* issuers — this is the correct split:
   >
   > | Direction | Issuer | Signing keys | Endpoint |
   > |---|---|---|---|
   > | **Inbound** (channel → bot) | `https://api.botframework.com` (Bot Framework — signs channel tokens even for single-tenant bots) | `https://login.botframework.com/v1/.well-known/openidconfiguration` (its `jwks_uri`) | our `/api/chat/teams/messages/` |
   > | **Outbound** (bot → channel) | n/a (we *acquire* a token) | n/a | `https://login.microsoftonline.com/<tenant>/oauth2/v2.0/token` (tenant-scoped) |
   >
   > Live evidence that drove this: a real inbound activity carried `iss =
   > https://api.botframework.com`, `aud =` our app id, and a `kid` that only the Bot
   > Framework JWKS resolves — validating it against the *tenant* AAD metadata failed with
   > `PyJWKClientError` (no matching key). So **inbound = Bot Framework channel issuer**,
   > **outbound = single-tenant tenant endpoint**. AAD-tenant-issuer inbound tokens (the
   > Bot Framework Emulator's single-tenant path) are **not** accepted.

## 2. Expose the local endpoint (tunnel)

The Bot Framework must reach your dev machine over HTTPS.

```bash
# example with a dev tunnel / ngrok-style tool
<tunnel> http 8000
# → https://<random>.<tunnel-domain>  (public HTTPS base)
```

In the **Azure Bot → Configuration → Messaging endpoint**, set:

```
https://<random>.<tunnel-domain>/api/chat/teams/messages/
```

Enable the **Microsoft Teams** channel on the Azure Bot resource.

## 3. Sideload the app into Teams

1. Edit `docs/teams/manifest.json`: replace both `REPLACE_WITH_MICROSOFT_APP_ID`
   occurrences (`id` and `bots[0].botId`) with your **App ID**.
2. Add two PNG icons next to it: `color.png` (192×192) and `outline.png` (32×32,
   transparent). *(Not committed — supply your own.)*
3. Zip the three files (`manifest.json`, `color.png`, `outline.png`) at the **root** of
   the zip.
4. Teams → **Apps → Manage your apps → Upload an app → Upload a custom app** → pick the
   zip. Scope is **personal** only.

## 4. Live QA script (owner — needs a real tenant)

The offline test suite proves the security invariants; these steps prove the live wiring.

1. **help** — DM the bot `help` → you get the help text. *(proves inbound JWT accepted +
   Connector reply works.)*
2. **link** — send `link` → you get a link URL; complete it in the app → account linked.
3. **today** — send `today` → your bookings (or "nothing booked").
4. **book** — send `book` → a card with **Confirm / Cancel** appears.
5. **confirm once** — tap **Confirm** → the card is **replaced** by "✅ Booked …"
   (buttons gone). Check the app: exactly one booking.
6. **double-tap guard** — send `book` again, then tap **Confirm twice quickly** → still
   exactly **one** booking; the second tap shows "already handled".
7. **cancel** — send `cancel` → Confirm → "✅ Cancelled …".

If step 1 fails with 401, read the backend `WARNING chat.adapters.teams.auth Teams inbound
JWT rejected (…)` line (the diagnostic logging) — `exc_message` and the unverified
`claims.iss`/`aud` tell you exactly why. Most likely: `MICROSOFT_APP_ID` doesn't match the
messaging-endpoint bot (`aud` mismatch). Note the inbound issuer should be
`https://api.botframework.com` (Bot Framework), **not** a tenant AAD issuer — a
`PyJWKClientError` (kid not found) against the tenant metadata was the review/28 bug fixed
in review/30. If you get 503, one of the three env vars isn't loaded.

## 5. Secrets hygiene

- `MICROSOFT_APP_ID` / `MICROSOFT_APP_PASSWORD` / `MICROSOFT_APP_TENANT_ID` live in
  `backend/.env` only (`MICROSOFT_APP_TENANT_ID` is not itself a secret, but is kept with
  the others). None are logged; auth-failure logs carry a short category, never the token.
- Rotating the secret: update `.env`, restart the backend (the app-token cache is
  in-process and clears on restart).

## 6. Future SaaS / multi-tenant path

Single-tenant is correct for the owner's bot today. If WorkspaceCanvas later ships a
multi-tenant Teams app (any customer's tenant can install it), that is a **Microsoft-side
registration question** — provisioning a multi-tenant bot identity / publishing to the
Teams store — **not a code rewrite**. The adapter stays: the issuer set and the token
endpoint are already tenant-parameterised, so multi-tenant mode is a configuration and
issuer-policy change layered on the same validation/reply code, not a new adapter.
