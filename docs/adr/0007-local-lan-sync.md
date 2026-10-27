# ADR-0007 — Local LAN sync (no account, no server)

> Date: 2026-10-27. Status: accepted. Supersedes ADR-0001 (cloud snapshot
> sync), ADR-0002 (auth/admin), ADR-0005 (native auth) and ADR-0006
> (foreground change feed). ADR-0004 (conservative auto-merge) still applies;
> its merge base is now per paired peer instead of per account.

## Context

LifeSpire shipped with a closed-beta NestJS API: accounts, invites, passwords,
TOTP, a Postgres snapshot store and a change feed. The product does not need a
central store to play: the save is local-first on every client. The owner asked
for sync with **no servers, no accounts, no passwords and no email**, using the
local network only: devices advertise themselves over UDP, each device presents
a self-signed HTTPS certificate, and the user chooses when to sync with another
device.

The web build must be considered carefully: a browser cannot open a UDP socket,
listen on a port, trust a self-signed certificate or pin one reliably. LAN sync
is therefore a native capability (Android + the Electron desktop shell, whose
main process has Node). The browser keeps playing locally and keeps
export/import.

## Decision

### Scope

- **Desktop (Electron)** and **Android** are LAN peers.
- **Web in a browser** is local-only. It shows a clear "available in the Android
  and desktop apps" message in Settings → Nearby devices.
- The cloud API, accounts, auth, admin, invites, TOTP, Postgres and all
  multi-user concepts are removed. There is **one local save per device**
  (`lifespire:mvp0`), created by promoting the active legacy account save (the
  old keys stay as backups).

### Identity and trust

- Each device generates a `deviceId`, an RSA key pair and a self-signed X.509
  certificate. The private key stays in the platform vault: `safeStorage` in
  Electron (plaintext `0600` with a visible warning when the OS keychain is
  unavailable), Android Keystore-backed preferences plus the app-private PKCS#12
  on Android.
- A peer is identified by the **SHA-256 SPKI/certificate fingerprint**, never by
  its IP or name. The client pins the fingerprint and checks it before sending
  any header, token or document.
- The server authenticates the caller with a per-direction 32-byte bearer
  token, stored only in the native vault. TLS protects the token; the pinned
  certificate protects the server. mTLS is a possible hardening, not required
  for the two-device trust model.
- Pairing is the only route that accepts an unknown certificate. The QR carries
  the certificate fingerprint and a one-time secret; an 8-character code is the
  fallback (TOFU, documented as weaker against a LAN MITM).

### Discovery

- UDP on port `47823`. Packet:
  `{ v: 1, kind: "probe" | "announce", deviceId, name, port, fingerprint, protocol: 1 }`.
- The source address from the datagram is authoritative; the packet never
  supplies a host. Broadcast to the subnet broadcast address and
  `255.255.255.255`, with a multicast fallback. TTL 1.
- Probe on start; announce every 10 s; peers expire after 30 s. Discovery runs
  only while the app is in the foreground and Nearby sync is enabled.

### Pairing

- The host shows `lifespire://pair?p=<payload>` with
  `{v, deviceId, name, fingerprint, host, port, secret, expiresAt}`. The secret
  is single-use and expires in 5 minutes.
- The joining device scans the QR (Android camera) or pastes the link; it pins
  the fingerprint from the QR, calls `POST /v1/pair` with the secret, and both
  sides exchange their own bearer token. The host stores the client's token and
  certificate fingerprint; the client stores the host's.
- The 8-character fallback sends `code` instead of `secret`. The host compares
  it with the code derived from its pending secret and rate-limits attempts.

### Protocol (HTTPS, `no-store`)

| Method | Path | Auth | Result |
|---|---|---|---|
| GET | `/health` | none | `{ok, deviceId, protocol}` |
| POST | `/v1/pair` | one-time secret/code | token exchange |
| GET | `/v1/info` | bearer | `{deviceId, name, docHash, updatedAt, schemaVersion}` |
| GET | `/v1/document` | bearer | `{documentJson, docHash, updatedAt, schemaVersion}` |
| POST | `/v1/document` | bearer | `202` queued, `409` CAS conflict, `422` invalid, `413` too large |
| POST | `/v1/unpair` | bearer | `204` |

- `documentJson` is a **string**: native nodes never re-serialize the document,
  so the JS checksum and key order stay stable.
- The receiver writes an accepted document to a durable inbox before replying
  `202`; the renderer validates it with `parseDocument`, merges it with its
  local copy against the per-peer base, applies the merged result, and acks. A
  crash between both steps re-delivers on the next start.
- A conflict is persisted in the peer metadata (`conflict: true`) and re-opened
  after a restart. The node never pushes the unresolved local copy blindly; it
  re-fetches the peer document and shows the dialog again when the peer is
  reachable.
- The accepted-but-not-yet-applied document is the current CAS/mirror state:
  a second concurrent push against the same old hash gets `409`, and pulls see
  the pending document. This prevents two peers from writing over the same
  stale copy. A local edit made before the incoming document is merged, never
  overwritten.
- Requests are limited to 512 KB of document JSON and 2 MB of body; only
  private source addresses are accepted.

### Sync algorithm

The initiator pulls `/v1/info`, then `/v1/document` when needed. It keeps a
per-peer base (the last document shared with that peer) and reuses
`tryAutoMerge(base, local, peer)` from ADR-0004:

- One side untouched → take the other side.
- Both changed disjointly → merge, push with `expectedHash` (CAS), retry up to
  3 times on `409`, then open the existing keep-mine/keep-peer dialog.
- First sync without a base → if one side has no profile, adopt the other; if
  both have saves, ask explicitly. No blind 3-way merge.
- The document schema does not change. Sync metadata lives outside
  `GameDocument` (`lifespire:peer:<id>:base` / `:meta`).

### UX

- Auto-sync is **ON** after pairing and configurable per device. It controls
  whether **this device** initiates syncs; a paired peer can still send a change
  when it initiates, because it is authenticated. Forget the device to stop
  exchanging with it entirely. A manual "Sync now" is always available and
  tries the last known address even when UDP discovery is blocked.
- A global Nearby sync switch stops advertising and automatic discovery. A
  peer that already knows the address and token can still connect; the user
  must forget it or close the app to stop that.
- Pairing persists across app restarts. Re-pairing is only needed after a
  reinstall/key loss (the fingerprint changes) or "Forget device".
- Android syncs only while the app is open/foreground; there is no background
  service. Desktop syncs while the app is running.
- A reset or an import is a document change and propagates. The reset dialog
  offers "reset this device only" (forget paired devices first) versus the
  normal reset-and-sync.
- The server was the only off-device backup. The app keeps the existing local
  backup and encourages export; sync is not a backup.

## Consequences

- **Breaking for cloud sync/accounts** (approved): the API is gone, users
  cannot sign in, cloud copies stop updating. Local saves are migrated without
  deletion; exports/imports remain compatible. A final database dump is kept
  before the VPS is decommissioned.
- The browser cannot sync over the LAN; this is a documented platform
  limitation. Android and desktop are the parity pair for sync.
- Android needs a local Expo module (Kotlin): UDP, HTTPS server, pinned client,
  identity/peer vault and inbox. The EAS build and the CI native job compile it.
- Discovery can be blocked by AP isolation, guest Wi-Fi, VPNs and firewalls;
  manual link/code pairing is the fallback.
- A lost device cannot be wiped remotely, and a lost save has no cloud copy.
  Export remains the backup path.

## Alternatives considered

- **Keep the server as an optional backup**: rejected by the product owner.
- **WebRTC for all clients**: would let the browser participate, but requires
  manual signaling and reconnection, `react-native-webrtc` on Android, and a
  much larger security/UX surface. Rejected for this iteration.
- **Shared folder (Syncthing/Drive)**: works on every client with almost no
  code, but does not meet "discover devices on the same network". Kept as the
  practical web fallback.
- **Plain HTTP with app-level encryption**: browsers block it as mixed content
  and it is weaker. Rejected.
- **Last-write-wins**: silently loses work. Rejected, as in ADR-0004.
