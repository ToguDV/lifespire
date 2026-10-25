# ADR-0005 — Native refresh grant and secure token storage

> Date: 2026-10-24. Status: accepted. Complements ADR-0002 (auth/admin).

## Context

The web refresh token lives in an HttpOnly, `SameSite=Lax`, path-scoped
cookie (`__Secure-ls_rt`). That is the right default for a same-origin PWA:
page JavaScript never sees it, and rotation/reuse detection stays server-side.

The Android app cannot rely on browser cookie behaviour. React Native's Android
fetch does not provide a persistent HttpOnly cookie jar, and adding a native
cookie manager still depends on reading `Set-Cookie` from responses that the
fetch API does not expose reliably. Without a persisted refresh token the user
would have to sign in every 15 minutes, or the access token would have to
become long-lived (worse security).

## Decision

Add an explicit **native client grant** to the existing auth endpoints:

1. A request is a native client only when it carries
   `X-Client-Platform: android|ios|desktop` **and** has no `Origin` and no
   `Sec-Fetch-Site` header. Browsers send those headers on credentialed POSTs
   and JavaScript cannot remove them (forbidden headers), so page JavaScript
   cannot opt into this grant by forging the custom header.
2. `POST /v1/auth/login` and `/v1/auth/accept-invite` return `refreshToken` in
   the JSON body for native clients. They keep setting the cookie for web.
3. `POST /v1/auth/refresh` accepts `{ refreshToken }` from native clients and
   keeps using the cookie for web. Rotation, hashing, family reuse detection,
   device revocation and rate limits are unchanged.
4. The Android app stores the token in `expo-secure-store` (Android Keystore
   backed) and keeps the access token in memory. The session marker in SQLite
   contains only id/email/role.
5. The Electron desktop app calls the API from its **main process** with
   `net.fetch` and `X-Client-Platform: desktop`. Main captures the login/refresh
   token, strips it from the IPC response before the renderer builds a
   `Response`, injects it into refresh bodies and rotates it. It is encrypted
   with Electron `safeStorage` in `userData`, keyed by server origin; without
   encryption (or with the Linux `basic_text` backend) the session stays in
   main-process memory and the UI reports that it will not survive a restart.
6. Logout clears both the access token and the secure-store refresh token; the
   existing server logout revokes the session.

The API client gains `mode: 'cookie' | 'native'` and refresh-token callbacks.
The web client keeps `mode: 'cookie'` and its behaviour is byte-for-byte
unchanged.

## Alternatives rejected

- **Persistent cookie jar library.** Fragile across RN versions, requires a
  native module, and needs the raw `Set-Cookie` header. It preserves the
  HttpOnly property but adds more moving parts than an explicit token grant.
- **Long-lived access token.** Unacceptable: no rotation or reuse detection.
- **OAuth authorization-code + PKCE in a Custom Tab.** The strongest option,
  but it needs a browser authorization UI, redirect handling and a new
  endpoint set. Deferred until the closed beta needs third-party clients.

## Security and trade-offs

- The header gate is a heuristic, not a cryptographic client attestation. Its
  purpose is to prevent **page JavaScript** from reading a refresh token that
  the web contract deliberately hides. A malicious native app can still call
  the public login endpoint with its own credentials; it gains nothing beyond
  its own session.
- The web app has strict CSP/no third-party scripts and React escaping; a
  hypothetical XSS can already call authenticated endpoints. The gate removes
  the easiest path to a long-lived token, but does not make XSS harmless.
- Token transport requires TLS in production. The token is never logged: the
  API logs redact bodies/authorization, and the refresh DTO is the only place
  the field exists.
- If the app dies between server rotation and the SecureStore write, the old
  token is presented once and the family is revoked (the existing reuse
  defence). The user signs in again; no silent account compromise.
- Losing or revoking the device: the existing device list/revoke endpoint
  invalidates the session; the next refresh fails and the app drops the local
  session. `logout-all` and password reset also revoke all sessions.

## Consequences

- The API has one new conditional response shape and one new request-body
  field; the web contract is unchanged.
- `packages/api-client` needs native tests (login capture, refresh rotation,
  missing-token refusal), and `isNativeClient` is unit-tested.
- Desktop adds a main-process proxy test suite (policy, stripping, rotation,
  vault fallback) plus a manual smoke checklist; CI does not open Electron
  windows. A full Postgres e2e flow for the native grant remains a follow-up.
- The refresh token is device-bound in practice; syncing it across devices is
  explicitly not supported.
