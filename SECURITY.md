# FTR security posture

## Current production boundary

FTR is a static marketing site delivered through a Cloudflare Worker and static-assets binding. It has no accounts, forms, uploads, database, payment flow, API for visitor data, cookies, or client-side storage. `mailto:` and `tel:` links hand off to the visitor's mail or phone application; they do not submit data to FTR.

The Worker accepts only `GET` and `HEAD`. Other methods receive `405 Method Not Allowed`. HTTP requests outside local development redirect to HTTPS. Security response headers enforce a self-only content policy, disallow framing and browser features, prevent MIME sniffing, and restrict cross-origin resource access.

## Secrets and deployment

No secret, token, API key, database credential, or service key is required by this site. A full repository scan found no credential material. `.env*` and `.dev.vars*` are ignored; if a server capability is added, store its secret with `wrangler secret put NAME` or a protected Cloudflare environment binding. Never place it in `dist/`, browser JavaScript, `wrangler.toml`, source control, logs, or an error response.

In Cloudflare, keep SSL/TLS encryption set to **Full (strict)**, enable **Always Use HTTPS**, and restrict dashboard access with MFA and least-privilege roles. There is no database to expose. If one is introduced, it must use a private binding or private network path and deny public connections.

## Monitoring

The Worker logs blocked request methods, HTTP errors, and asset failures without recording request bodies, query strings, cookies, authorization headers, credentials, or IP addresses. Configure a Cloudflare Logpush or dashboard alert for repeated 4xx/5xx events, traffic spikes, and blocked methods.

## Future dynamic features: release gate

Do not add a public route that accepts user data until all of the following are implemented server-side:

1. Schema validation with strict types, length limits, allowlists, and parameterized database queries.
2. File-type verification, size limits, malware scanning, private storage, and randomized server-generated upload names for uploads.
3. Authentication with password hashing (Argon2id or bcrypt), short-lived secure sessions, email verification, expiring single-use reset tokens, and rate limits for login and reset attempts.
4. Authorization checks that prove the authenticated user owns every record before it is read, changed, or deleted.
5. Structured, redacted authentication/API/error logs and alerts for anomalies.
