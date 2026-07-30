// The prize wall. Prices follow docs/superpowers/specs/2026-07-29-prize-wall-pricing-design.md:
// points = base retail / $0.03, rounded to the nearest 25. The trophy tier's
// 3,000 is a hand-set round number (the formula lands at ~3,175). Premier
// Games items were pulled from their Shopify catalog
// (premiergames.store/products.json) on 2026-07-30; images were downloaded, resized
// to 480px, background-removed (Vision foreground mask), and committed to
// public/prizes/ as transparent PNGs because
// images.unoptimized means nothing resizes at request time. Items with
// premium finish variants redeem at the base finish; upgrades are ad hoc.

export type PrizeWallItem = {
  name: string;
  points: number;
  /** Base-variant retail in USD, for band sanity checks. Absent for own-stock items with no market price. */
  retail?: number;
  by?: "Premier Games";
  imageUrl?: string;
  productUrl?: string;
};

export const PRIZE_WALL: PrizeWallItem[] = [
  // Trophy tier (one on the wall at a time), then own stock
  {
    name: "Metal Token Set",
    points: 3000,
    retail: 95,
    by: "Premier Games",
    imageUrl: "/prizes/metal-token-set.png",
    productUrl: "https://premiergames.store/products/metal-token-set",
  },
  {
    name: "Mother Talzin playmat (Regional)",
    points: 1500,
    imageUrl: "/prizes/mother-talzin-playmat.png",
  },
  { name: "Sneaking Suspicion playmat (Regional)", points: 1500 },
  { name: "Shien Flurry playmat (Regional)", points: 1500 },
  { name: "Darth Tyrannus playmat (Regional)", points: 1500 },
  { name: "Princess Leia playmat (Regional)", points: 1000 },

  // Premier Games catalog
  {
    name: "Mandalorian / Spy Token (Double-Sided)",
    points: 500,
    retail: 15,
    by: "Premier Games",
    imageUrl: "/prizes/mandalorian-spy-token.png",
    productUrl: "https://premiergames.store/products/mandalorian-spy-token",
  },
  {
    name: "Metal Advantage Token",
    points: 500,
    retail: 15,
    by: "Premier Games",
    imageUrl: "/prizes/metal-advantage-token.png",
    productUrl: "https://premiergames.store/products/metal-advantage-token",
  },
  {
    name: "X-Wing / TIE Fighter Token (Double-Sided)",
    points: 500,
    retail: 15,
    by: "Premier Games",
    imageUrl: "/prizes/x-wing-tie-fighter-token.png",
    productUrl: "https://premiergames.store/products/x-wing-tie-fighter-token",
  },
  {
    name: "Metal Imperial Credit Tokens",
    points: 475,
    retail: 14,
    by: "Premier Games",
    imageUrl: "/prizes/metal-imperial-credit-token.png",
    productUrl: "https://premiergames.store/products/metal-imperial-credit-token",
  },
  {
    name: "Metal Old Republic Credit Tokens",
    points: 475,
    retail: 14,
    by: "Premier Games",
    imageUrl: "/prizes/metal-old-republic-credit-token.png",
    productUrl: "https://premiergames.store/products/metal-old-republic-credit-token",
  },
  {
    name: "Metal Force Tokens",
    points: 400,
    retail: 12,
    by: "Premier Games",
    imageUrl: "/prizes/metal-force-token.png",
    productUrl: "https://premiergames.store/products/metal-force-token",
  },
  {
    name: "Metal Initiative Token – Beskar Edition",
    points: 400,
    retail: 12,
    by: "Premier Games",
    imageUrl: "/prizes/beskar-initiative-token.png",
    productUrl: "https://premiergames.store/products/beskar-initiative-token",
  },
  {
    name: "Metal Twin Suns Token Set",
    points: 400,
    retail: 12,
    by: "Premier Games",
    imageUrl: "/prizes/metal-twin-suns-token-set.png",
    productUrl: "https://premiergames.store/products/metal-twin-suns-token-set",
  },
  {
    name: "Metal Damage Token",
    points: 275,
    retail: 8,
    by: "Premier Games",
    imageUrl: "/prizes/metal-damage-token.png",
    productUrl: "https://premiergames.store/products/metal-damage-token",
  },
  {
    name: "Metal Epic Action / Reminder Token",
    points: 275,
    retail: 8,
    by: "Premier Games",
    imageUrl: "/prizes/metal-epic-action-reminder-token.png",
    productUrl: "https://premiergames.store/products/metal-epic-action-reminder-token",
  },
  {
    name: "Metal Experience Token",
    points: 275,
    retail: 8,
    by: "Premier Games",
    imageUrl: "/prizes/metal-experience-token.png",
    productUrl: "https://premiergames.store/products/metal-experience-token",
  },
  {
    name: "Metal Hand Token",
    points: 275,
    retail: 8,
    by: "Premier Games",
    imageUrl: "/prizes/metal-hand-token.png",
    productUrl: "https://premiergames.store/products/metal-hand-token",
  },
  {
    name: "Metal Hidden / Sentinel Token",
    points: 275,
    retail: 8,
    by: "Premier Games",
    imageUrl: "/prizes/metal-hidden-sentinel-token.png",
    productUrl: "https://premiergames.store/products/metal-hidden-sentinel-token",
  },
  {
    name: "Metal Initiative Token – Data Card",
    points: 275,
    retail: 8,
    by: "Premier Games",
    imageUrl: "/prizes/metal-initiative-token-data-card.png",
    productUrl: "https://premiergames.store/products/metal-initiative-token-data-card",
  },
  {
    name: "Metal Modifier Token",
    points: 275,
    retail: 8,
    by: "Premier Games",
    imageUrl: "/prizes/metal-modifier-token.png",
    productUrl: "https://premiergames.store/products/metal-modifier-token",
  },
  {
    name: "Metal Shield Token",
    points: 275,
    retail: 8,
    by: "Premier Games",
    imageUrl: "/prizes/metal-shield-token.png",
    productUrl: "https://premiergames.store/products/metal-shield-token",
  },
];
