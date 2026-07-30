import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `next dev` and `next build` share .next by default, and Next takes no
  // lock on it — a dev server running during a deploy's build corrupts the
  // deployed bundle (prod outage 2026-07-30: MODULE_NOT_FOUND on every SSR
  // route). Dev gets its own directory so the two can never collide.
  // `next build` pins NODE_ENV to "production", so deploys always use .next.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  images: {
    // OpenNext's image-optimizer Lambda 500s against Next 15.5
    // ("TypeError: s is not a function"). We serve pre-sized assets from
    // CloudFront instead — see ADR 0001, which rules out the optimizer at
    // this scale regardless. Size images in assets/brand/ before committing
    // copies to public/brand/.
    unoptimized: true,
  },
};

export default nextConfig;
