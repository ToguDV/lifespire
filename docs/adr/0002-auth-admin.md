# ADR-0002 — Closed registration with admin invites + mandatory admin TOTP

> Superseded by ADR-0007: accounts, invites, passwords and admin are retired.

> Date: 2026-10-24. Status: accepted. Context: private hosting, no email
> provider, several admins.

## Decision

- No public signup endpoint. Admins create `PENDING` accounts; the API returns
  a single-use manual invite link (token in the URL fragment, 72 h expiry).
  Password resets are manual links too (1 h, revokes sessions).
- Email is a login identifier only; ownership is not verified.
- Admins must enroll TOTP (otplib, encrypted secret, 10 recovery codes) before
  admin routes accept their sessions. The last active admin is protected in
  code; recovery is via server CLI.
- Every admin action is audit-logged (actor, target, action, IP).

## Rationale

- Zero email infrastructure to operate; the admin's existing channel delivers
  links, and fragment tokens avoid leaking into logs/`Referer`.
- TOTP on the highest-privilege accounts compensates for password-only users.
- DB re-checks of role/status/TOTP on each admin call make
  disable/demote/reset effective within one access-token lifetime (15 min).

## Consequences

- Onboarding a user requires an admin round-trip.
- Users cannot self-recover passwords; they contact an admin.
- Admin UX must force the TOTP setup flow after first login.
