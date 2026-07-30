// The prize wall. Prices follow docs/superpowers/specs/2026-07-29-prize-wall-pricing-design.md:
// points = base retail / $0.03, rounded to the nearest 25. The trophy tier's
// 3,000 is a hand-set round number (the formula lands at ~3,175). Premier
// Games items were pulled from their Shopify catalog
// (premiergames.store/products.json) on 2026-07-30; image URLs point at their
// CDN. Items with premium finish variants redeem at the base finish;
// upgrades are handled ad hoc.

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
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0744/4381/7193/files/deluxe_noLid-2.jpg?v=1753481434",
    productUrl: "https://premiergames.store/products/metal-token-set",
  },
  { name: "Mother Talzin playmat (Regional)", points: 1500 },
  { name: "Sneaking Suspicion playmat (Regional)", points: 1500 },
  { name: "Shien Flurry playmat (Regional)", points: 1500 },
  { name: "Darth Tyrannus playmat (Regional)", points: 1500 },
  { name: "Princess Leia playmat (Regional)", points: 1000 },
  { name: "Card sleeves", points: 200 },
  { name: "OP pack (random set)", points: 100 },

  // Premier Games catalog
  {
    name: "Streaming Metal Advantage Token",
    points: 575,
    retail: 17,
    by: "Premier Games",
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0744/4381/7193/files/advantage_streaming_2.jpg?v=1780717667",
    productUrl: "https://premiergames.store/products/streaming-metal-advantage-token",
  },
  {
    name: "Mandalorian / Spy Token (Double-Sided)",
    points: 500,
    retail: 15,
    by: "Premier Games",
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0744/4381/7193/files/mandoSpy_2.jpg?v=1780720346",
    productUrl: "https://premiergames.store/products/mandalorian-spy-token",
  },
  {
    name: "Metal Advantage Token",
    points: 500,
    retail: 15,
    by: "Premier Games",
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0744/4381/7193/files/advantage_2-2.jpg?v=1780715026",
    productUrl: "https://premiergames.store/products/metal-advantage-token",
  },
  {
    name: "X-Wing / TIE Fighter Token (Double-Sided)",
    points: 500,
    retail: 15,
    by: "Premier Games",
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0744/4381/7193/files/xTie-2-2.jpg?v=1782781108",
    productUrl: "https://premiergames.store/products/x-wing-tie-fighter-token",
  },
  {
    name: "Metal Imperial Credit Tokens",
    points: 475,
    retail: 14,
    by: "Premier Games",
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0744/4381/7193/files/creditToken_imperial_pile-2.jpg?v=1768110430",
    productUrl: "https://premiergames.store/products/metal-imperial-credit-token",
  },
  {
    name: "Metal Old Republic Credit Tokens",
    points: 475,
    retail: 14,
    by: "Premier Games",
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0744/4381/7193/files/creditToken_republic_pile-2.jpg?v=1770272271",
    productUrl: "https://premiergames.store/products/metal-old-republic-credit-token",
  },
  {
    name: "Metal Force Tokens",
    points: 400,
    retail: 12,
    by: "Premier Games",
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0744/4381/7193/files/primary.png?v=1748982710",
    productUrl: "https://premiergames.store/products/metal-force-token",
  },
  {
    name: "Metal Initiative Token – Beskar Edition",
    points: 400,
    retail: 12,
    by: "Premier Games",
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0744/4381/7193/files/beskar.jpg?v=1780945825",
    productUrl: "https://premiergames.store/products/beskar-initiative-token",
  },
  {
    name: "Metal Twin Suns Token Set",
    points: 400,
    retail: 12,
    by: "Premier Games",
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0744/4381/7193/files/twinSuns-2.jpg?v=1757048528",
    productUrl: "https://premiergames.store/products/metal-twin-suns-token-set",
  },
  {
    name: "Metal Damage Token",
    points: 275,
    retail: 8,
    by: "Premier Games",
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0744/4381/7193/files/damage1_2-2.jpg?v=1757040979",
    productUrl: "https://premiergames.store/products/metal-damage-token",
  },
  {
    name: "Metal Epic Action / Reminder Token",
    points: 275,
    retail: 8,
    by: "Premier Games",
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0744/4381/7193/files/epic_2-2.jpg?v=1757043188",
    productUrl: "https://premiergames.store/products/metal-epic-action-reminder-token",
  },
  {
    name: "Metal Experience Token",
    points: 275,
    retail: 8,
    by: "Premier Games",
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0744/4381/7193/files/experience_2-2.jpg?v=1757043425",
    productUrl: "https://premiergames.store/products/metal-experience-token",
  },
  {
    name: "Metal Hand Token",
    points: 275,
    retail: 8,
    by: "Premier Games",
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0744/4381/7193/files/hendToken_front-2_a3579af7-bc9a-43f4-9262-9bdc326fe0fb.jpg?v=1756871119",
    productUrl: "https://premiergames.store/products/metal-hand-token",
  },
  {
    name: "Metal Hidden / Sentinel Token",
    points: 275,
    retail: 8,
    by: "Premier Games",
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0744/4381/7193/files/hidden_2-2.jpg?v=1757042480",
    productUrl: "https://premiergames.store/products/metal-hidden-sentinel-token",
  },
  {
    name: "Metal Initiative Token – Data Card",
    points: 275,
    retail: 8,
    by: "Premier Games",
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0744/4381/7193/files/initiative-2.jpg?v=1757048528",
    productUrl: "https://premiergames.store/products/metal-initiative-token-data-card",
  },
  {
    name: "Metal Modifier Token",
    points: 275,
    retail: 8,
    by: "Premier Games",
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0744/4381/7193/files/modifier_4-2.jpg?v=1757044153",
    productUrl: "https://premiergames.store/products/metal-modifier-token",
  },
  {
    name: "Metal Shield Token",
    points: 275,
    retail: 8,
    by: "Premier Games",
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0744/4381/7193/files/shield_2-2.jpg?v=1757041280",
    productUrl: "https://premiergames.store/products/metal-shield-token",
  },
];
