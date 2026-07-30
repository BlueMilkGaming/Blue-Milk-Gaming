// Authored org facts and links. Real facts only — no invented standings (see
// PRODUCT.md: "real data or nothing"). Live YouTube comes from
// src/lib/youtube.ts; live standings arrive with the melee.gg sync.

export const DISCORD_URL = "https://discord.gg/sTWmJaXS5w";

export const ONLINE_LOCAL = {
  competition: "Online Local",
  day: "Sunday",
  time: "6:30 PM CT",
  format: "4 rounds · Swiss",
  venue: "melee.gg",
} as const;

// Partner logos are the white marks on the navy panel. All three are stacked
// lockups at near-identical aspect ratios (2.69:1, 2.38:1, 2.26:1), so they
// share a height class and balance without per-logo fudging. Every source
// ships in its own brand color; the committed copies are recolored white, and
// the Premier Games one also has its padded canvas trimmed to the mark.
export const PARTNERS = [
  {
    name: "Premier Games",
    href: "https://premiergames.store/",
    logo: "/brand/partners/premier-games.svg",
    width: 500,
    height: 186,
  },
  {
    name: "Font Awesome",
    href: "https://fontawesome.com/",
    logo: "/brand/partners/font-awesome.svg",
    width: 81,
    height: 34,
  },
  {
    name: "Web Awesome",
    href: "https://webawesome.com/",
    logo: "/brand/partners/web-awesome.svg",
    width: 77,
    height: 34,
  },
] as const;

export const CHANNELS = [
  { label: "YouTube", href: "https://www.youtube.com/@BlueMilkGaming" },
  { label: "Discord", href: DISCORD_URL },
  { label: "Patreon", href: "https://www.patreon.com/cw/BlueMilkGaming" },
  { label: "Merch", href: "https://merch.bluemilkgaming.com/" },
] as const;
