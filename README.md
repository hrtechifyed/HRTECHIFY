# HRTechify master-brand website

Static-first implementation of the HRTechify master brand: **People • Technology • Growth**.

## What is implemented

- Home, Products, Insights, About, Contact, Privacy and Terms pages.
- HRTechify master-brand positioning and the “two sides of work” portfolio story.
- CorporateX and GrowWith HR consistently endorsed as **by HRTechify**.
- Current product links from the strategy document.
- GrowWith HR prototype/private-beta and legal-boundary language.
- Five initial HRTechify Insight essays based on the recommended editorial topics.
- Deep navy / orange / bright amber / cool white / slate visual system.
- Mobile-first responsive navigation and layouts.
- Accessible semantic structure, keyboard focus states, reduced-motion support and 44px+ controls.
- Privacy-first analytics event hooks with no third-party analytics enabled by default.
- Organization, Product/SoftwareApplication and Article structured data.
- Sitemap, robots.txt, canonical metadata and Open Graph assets.
- GitHub Actions for HTML validation, link checks, Lighthouse CI and optional GitHub Pages deployment.

## Product destinations

- CorporateX: https://hrtechifyed.github.io/The-Corporatex/
- GrowWith HR: https://growwithhr.onrender.com/
- Preferred future product domains: `corporatex.hrtechify.com` and `growwithhr.hrtechify.com`

## Run locally

```bash
npm install
npm run serve
```

Open `http://localhost:4173`.

## Before production launch

1. Replace the text lockup with approved HRTechify logo assets if desired; keep the line **PEOPLE • TECHNOLOGY • GROWTH**.
2. Replace the founder monogram with a founder photograph supplied/approved directly by Anurag. Do not scrape a LinkedIn image.
3. Reconfirm founder titles, dates and quantified claims before publishing.
4. Configure a trusted contact-form backend, spam protection, consent handling, retention policy and approved destination address.
5. Have Privacy and Terms reviewed and approved; current pages are clearly marked as drafts.
6. Choose and configure a privacy-respectful analytics provider only if needed; the event taxonomy is already wired (`product_corporatex_click`, `product_growwithhr_click`, `insight_open`, `contact_submit`, `partnership_interest`, `scroll_to_products`).
7. Verify the custom domain and DNS before adding a `CNAME` file. The preferred public domain is `hrtechify.com`.
8. Verify every external product CTA and add “A product by HRTechify” backlinks on CorporateX and GrowWith HR.
9. Run the quality workflow and manually review 360px, 390px, 430px, 768px, 1024px and 1440px widths.

## Deployment

The repository includes an optional GitHub Pages workflow. Enable GitHub Pages with **GitHub Actions** as the source, then run the workflow. If the custom domain is ready, add a `CNAME` file containing `hrtechify.com` and configure DNS.

## Architecture choice

The strategy allows static-first Next.js / Astro / equivalent **or a clean static site**. This implementation deliberately uses plain semantic HTML, CSS and minimal JavaScript to prioritize speed, reliability, searchability and GitHub Pages portability.
