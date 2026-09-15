# FTR — Architecture

## Stack
Static HTML, CSS and JavaScript; native CSS 3D transforms and scroll animation; no runtime dependencies

## System boundaries
- Static HTML/CSS/JS under dist. All assets local. No API, database, cookies, analytics or runtime dependencies. Mailto/tel links open the visitor's chosen application.

## Data classification
- Website company contact data is sourced from the supplied profile. Original deck and extracted slides remain ignored locally. Site audience stays owner-private unless user requests public access.

## Security architecture
- The Cloudflare Worker allows only `GET` and `HEAD`, redirects non-local HTTP requests to HTTPS, and uses the static-assets binding. No database, forms, uploads, authentication endpoints, cookies, analytics, or runtime dependencies exist.
- Every Worker response receives a restrictive CSP, HSTS, anti-framing, MIME-sniffing, referrer, permissions, and cross-origin isolation headers. The static `_headers` file applies the same policy when assets are served directly.
- Homepage HTML is the browser default. The Worker returns a formatting-stripped Markdown representation when `Accept` includes `text/markdown` or `text/x-markdown`, with `Content-Type: text/markdown`, `Vary: Accept`, token estimate, and RFC 8288/RFC 9727 discovery links for `api-catalog`, `service-desc`, `service-doc`, and `describedby`.
- The Worker logs blocked methods, 4xx/5xx responses, and asset failures using only method, pathname, country, and Cloudflare Ray ID. It never logs queries, request bodies, cookies, credentials, or IP addresses.
- There are no application secrets. `.env*` and `.dev.vars*` are ignored so any future server-only bindings stay out of Git and frontend assets.
- Authentication, authorization/ownership checks, database access, password/reset flows, email verification, and file-upload validation are not applicable until a server-side product feature is introduced. Any such feature must be implemented behind authenticated Worker routes with server-side validation, rate limiting, and ownership checks before release.
