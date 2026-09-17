/**
 * FTR Cloudflare Worker
 *
 * 1. Markdown content negotiation (Accept: text/markdown)
 *    Spec: https://isitagentready.com/.well-known/agent-skills/markdown-negotiation/SKILL.md
 * 2. Link response headers for agent discovery
 *    Spec: RFC 8288 & RFC 9727 Section 3
 */

const LINK_HEADER = '</.well-known/api-catalog>; rel="api-catalog", </llms.txt>; rel="service-desc", </llms.txt>; rel="service-doc", </llms.txt>; rel="describedby"';
const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Permitted-Cross-Domain-Policies": "none",
};

function logSecurityEvent(type, request, details = {}) {
  const url = new URL(request.url);
  // Do not record query strings, IP addresses, cookies, authorization data or bodies.
  console.log(JSON.stringify({
    type,
    method: request.method,
    path: url.pathname,
    country: request.cf?.country || "unknown",
    rayId: request.headers.get("cf-ray") || "unknown",
    ...details,
  }));
}

function secureResponse(response, request, extraHeaders = {}) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  for (const [name, value] of Object.entries(extraHeaders)) headers.set(name, value);

  if (response.status >= 400) {
    logSecurityEvent("http_error", request, { status: response.status });
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const accept = request.headers.get("Accept") || "";

    if (url.protocol === "http:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      url.protocol = "https:";
      return Response.redirect(url.toString(), 308);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      logSecurityEvent("blocked_method", request);
      return secureResponse(new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD", "Cache-Control": "no-store" },
      }), request);
    }

    const isPageRequest =
      url.pathname === "/" ||
      url.pathname === "/index.html" ||
      url.pathname === "";

    // 1. Markdown Content Negotiation
    const wantsMarkdown =
      accept.includes("text/markdown") ||
      accept.includes("text/x-markdown");

    if (isPageRequest && wantsMarkdown) {
      const markdown = buildMarkdown();
      const encoder = new TextEncoder();
      const bytes = encoder.encode(markdown);
      const tokenCount = Math.ceil(bytes.length / 4);

      return secureResponse(new Response(request.method === "HEAD" ? null : markdown, {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Vary": "Accept",
          "Link": LINK_HEADER,
          "x-markdown-tokens": String(tokenCount),
          "Cache-Control": "public, max-age=0, must-revalidate",
        },
      }), request);
    }

    try {
      // 2. Fetch static asset
      const response = env?.ASSETS
        ? await env.ASSETS.fetch(request)
        : await fetch(request);

      // Inject Link header and Vary: Accept for page requests.
      if (isPageRequest && response.status === 200) {
        return secureResponse(response, request, {
          Link: response.headers.get("Link") || LINK_HEADER,
          Vary: "Accept",
        });
      }

      // Handle 404: serve custom 404.html if available
      if (response.status === 404 && env?.ASSETS) {
        const notFoundUrl = new URL("/404.html", request.url);
        const notFoundResponse = await env.ASSETS.fetch(new Request(notFoundUrl.toString(), request));
        if (notFoundResponse.status === 200) {
          return secureResponse(new Response(notFoundResponse.body, {
            status: 404,
            statusText: "Not Found",
            headers: notFoundResponse.headers,
          }), request);
        }
      }

      return secureResponse(response, request);
    } catch (error) {
      logSecurityEvent("asset_error", request, { message: error instanceof Error ? error.name : "unknown" });
      return secureResponse(new Response("Internal Server Error", {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }), request);
    }
  },
};

function buildMarkdown() {
  return `---
title: FTR — First Time Resolver
description: IT solutions and services across India. Since 2010, we've helped businesses source, implement and maintain the technology they depend on.
canonical: https://ftrgroup.in/
language: en
---

# FTR — First Time Resolver

> YOUR TECHNOLOGY. OUR RESPONSIBILITY.

**IT THAT WORKS. BUSINESS THAT MOVES FORWARD.**

The right technology. The people to make it work. IT solutions and support for businesses across India.

---

## 01 / The Company

### TECHNOLOGY IS COMPLEX. WORKING WITH US ISN'T.

We're First Time Resolver. Since 2010, we've helped businesses source, implement and maintain the technology they depend on. What started in Delhi NCR now supports customers across India.

Our team brings together IT sales, hardware and software integration, and ongoing support. We start with your business needs and build a solution around your requirements, budget and existing systems.

Our commitment is simple: consistently meet or exceed customer expectations in quality, cost and delivery.

### Key Stats

| Milestone | Value |
|---|---|
| Years of service excellence | 16 (2010–2026) |
| Geographic reach | PAN India — sales, implementation & support |
| Partner model | ONE partner from sourcing to ongoing maintenance |

---

## 02 / Our Solutions

### YOUR ENTIRE IT ECOSYSTEM. EXPERTLY CONNECTED.

From the equipment on your desk to the infrastructure behind your operations, we bring it all together.

#### IT Infrastructure & Sourcing
The right hardware and software for the way your business works.
- Computers, laptops & servers
- Network switches & peripherals
- Global materials sourcing

#### Systems Integration
Connect your platforms, applications and data into a working whole.
- Hardware & software integration
- Architecture & solution design
- Application development

#### Facility Management Services
Hands-on support for the technology that keeps your workplace running.
- Server, network & desktop support
- IT asset management
- Surveillance management

#### Annual Maintenance Contracts
Structured maintenance and troubleshooting for your IT environment.
- IT hardware troubleshooting
- Comprehensive coverage
- OS & application support

---

## 03 / The Way We Work

### UNDERSTAND FIRST. RESOLVE RIGHT.

Good technology decisions start with listening. We work alongside your team to find the most effective path, with less cost and effort for your business.

> **OUR GOAL:** Turn technology into better business performance.

#### Our Approach

1. **UNDERSTAND** — Identify the problem, your requirements and the constraints that matter.
2. **FIND THE RIGHT FIT** — Evaluate ready-made products, existing systems and new development with you.
3. **BUILD & INTEGRATE** — Source, develop and implement a solution that works with your business.
4. **SUPPORT & MAINTAIN** — Keep your systems working and help your people use IT with confidence.

---

## 04 / Our Journey

### BUILT ON TRUST. GROWING WITH OUR CUSTOMERS.

| Year | Milestone |
|---|---|
| 2010 | Established in NCR to deliver sustainable, cost-effective IT services. |
| 2013 | Expanded to North India. Employee strength doubled in the first three years. |
| 2016 | Grew into pan-India sales and services, with a larger team and customer base. |
| 2019 | Turnover crossed ₹5 crore, with major automotive customers joining our portfolio. |
| 2022 | Turnover crossed ₹10 crore and secured annual sales, maintenance and surveillance contracts. |
| 2026 | 16 years of service — continuing our commitment to dependable solutions and customer support. |

---

## 05 / Our Partners

### GREAT COMPANY. SHARED PROGRESS.

A selection of the organisations featured in our company profile:

Hero Cycles, LAVA, Ahresty, BANDO, Dixon, MINDA, Sunwoda, Bellsonica, Tenon, Lucas TVS, UFI Filters, TresVista

---

## Contact

### YOUR NEXT MOVE. OUR FULL ATTENTION.

**LET'S SOLVE WHAT'S NEXT**

#### Speak to Us
- **Name:** Laxman Yadav
- **Email:** [laxman@ftresolver.com](mailto:laxman@ftresolver.com)
- **Phone:** [+91 95550 76755](tel:+919555076755)

#### Visit Us
Plot No. 124, J Block, Street No. 7
Ashok Vihar Phase 3 Extension
Gurugram, Haryana — 122001, India

#### Our Office
- **Office phone:** [+91 124 4799155](tel:+911244799155)
- IT sales & services across India.

---

*© 2026 First Time Resolver Pvt. Ltd. — [https://ftrgroup.in](https://ftrgroup.in)*
`;
}
