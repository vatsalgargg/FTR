# FTR — Architecture

## Stack
Static HTML, CSS and JavaScript; native CSS 3D transforms and scroll animation; no runtime dependencies

## System boundaries
- Static HTML/CSS/JS under dist. All assets local. No API, database, cookies, analytics or runtime dependencies. Mailto/tel links open the visitor's chosen application.

## Data classification
- Website company contact data is sourced from the supplied profile. Original deck and extracted slides remain ignored locally. Site audience stays owner-private unless user requests public access.

## Security architecture
- Sites provides owner-private access. Static code uses no untrusted HTML injection, network requests or forms. Security headers restrict resource origins. No application secrets.
