import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
