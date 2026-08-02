# Google Analytics (GA4) — Design

Date: 2026-08-02
Status: approved

## Goal

Page-view analytics for bluemilkgaming.com via Google Analytics 4. No consent
banner: the org accepted the (negligible-enforcement) GDPR risk for EU
visitors, revisit if the site's scale grows materially.

## Decisions

- **GA4 with plain gtag snippet**, no `@next/third-parties` dependency. Two
  `<Script>` tags (via `next/script`, `afterInteractive`) in
  `website/src/app/layout.tsx`: the gtag.js loader and the inline config call.
- **Production only.** The scripts render only when
  `process.env.NODE_ENV === "production"`, so `npm run dev` traffic never
  reaches GA. No env var: the measurement ID is public by nature (visible in
  page source on every GA site) and is hardcoded in `layout.tsx`.
- **No custom events.** GA4 enhanced measurement auto-tracks page views,
  including App Router client-side navigations (history changes). Add events
  later only if a real question needs them.
- **No consent banner / consent mode.** Deliberate. Upgrade path if ever
  needed: gate the same two script tags behind a consent state.

## Owner split

- Alex: create the GA4 account + property + web data stream for
  `https://bluemilkgaming.com` at analytics.google.com, hand over the
  `G-XXXXXXXXXX` measurement ID.
- Claude: add the snippet to `layout.tsx`, deploy.

## Verification

After deploy, load bluemilkgaming.com and confirm the visit appears in GA4
Realtime within a couple of minutes. Also confirm view-source shows the gtag
scripts in the deployed page but not on the local dev server.
