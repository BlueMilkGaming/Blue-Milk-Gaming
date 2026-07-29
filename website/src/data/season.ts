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

// The prize wall's tags. Real items only, no invented point costs
// (PRODUCT.md: "real data or nothing"). Tags gain a cost field when the
// prize list and point pricing are settled.
export const PRIZES = [
  {
    kicker: "On the wall now",
    name: "Premium SWU token set",
    by: "from Premier Games",
  },
] as const;

// Partner logos are the white marks on the navy panel. Both are stacked
// lockups at near-identical aspect ratios (2.69:1 and 2.38:1), so they share a
// height class and balance without per-logo fudging. The Premier Games source
// ships black on a padded canvas; the committed copy is recolored white with
// the viewBox trimmed to the mark.
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
] as const;

export const CHANNELS = [
  { label: "YouTube", href: "https://www.youtube.com/@BlueMilkGaming" },
  { label: "Discord", href: DISCORD_URL },
  { label: "Patreon", href: "https://www.patreon.com/cw/BlueMilkGaming" },
  { label: "Shop", href: "https://bluemilkgaming.com/" },
] as const;
