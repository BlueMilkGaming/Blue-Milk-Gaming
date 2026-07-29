// Authored club data. Real facts only — no invented standings (see PRODUCT.md:
// "real data or nothing"). Live YouTube comes from src/lib/youtube.ts; live
// standings arrive with the melee.gg sync.

export const DISCORD_URL = "https://discord.gg/pyVPPHwemq";

export const FIXTURE = {
  competition: "Online Local",
  day: "Sunday",
  time: "6:30 PM CT",
  format: "4 rounds · Swiss",
  venue: "melee.gg",
} as const;

// The squad. Squad numbers are cosmetic (founding order), not results.
export const ROSTER = [
  { number: "01", name: "Alex Krezminski", handle: "alexkrez" },
  { number: "02", name: "Carlos Apodaca", handle: "Carlos A" },
  { number: "03", name: "Micah Overley", handle: "Overley28" },
  { number: "04", name: "Nick Obee", handle: "Tacster" },
] as const;

// Season 01 opening state. Points are `null` until the leaderboard sync lands —
// we never render fabricated numbers.
export const SEASON = {
  label: "Season 01",
  standings: ROSTER.map((m) => ({ name: m.name, handle: m.handle, points: null as number | null })),
} as const;

// Partner logos are the white marks on the navy panel. Both are stacked
// lockups at near-identical aspect ratios (2.57:1 and 2.38:1), so they share a
// height class and balance without per-logo fudging. The Premier Games source
// is the square export, trimmed of its padded canvas.
export const PARTNERS = [
  {
    name: "Premier Games",
    href: "https://premiergames.store/",
    logo: "/brand/partners/premier-games.png",
    width: 616,
    height: 240,
  },
  {
    name: "Font Awesome",
    href: "https://fontawesome.com/",
    logo: "/brand/partners/font-awesome.svg",
    width: 81,
    height: 34,
  },
] as const;

export const CHANNELS = [
  { label: "YouTube", href: "https://www.youtube.com/@BlueMilkGaming" },
  { label: "Discord", href: DISCORD_URL },
  { label: "Patreon", href: "https://www.patreon.com/cw/BlueMilkGaming" },
  { label: "Shop", href: "https://bluemilkgaming.com/" },
] as const;
