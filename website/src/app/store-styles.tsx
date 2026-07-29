/* The site's committed world (DESIGN.md), shared by every route. Brand hues
   are fixed (PRODUCT.md); this maps them onto the store's materials: the wall,
   the paper, the tape, the highlighter, the pegboard. */
export function StoreStyles() {
  return (
    <style>{`
      body { background: #000342; }
      .store {
        --wall: #000342;
        --wall-deep: #00021c;
        --paper: #eefbff;
        --board: #f8fdff;
        --ink: #000342;
        --accent: #3bb0ff;
        --hot: #ffe81f;
        background:
          radial-gradient(90% 60% at 50% 0%, color-mix(in srgb, var(--accent) 7%, transparent), transparent 70%),
          var(--wall);
        color: var(--paper);
      }
      /* A pinned artifact: paper lifted off the wall by an offset shadow. */
      .paper {
        background: var(--paper);
        color: var(--ink);
        box-shadow: 0 14px 34px -16px rgba(0, 2, 28, 0.85);
      }
      .tilt-l { transform: rotate(-1deg); }
      .tilt-r { transform: rotate(1.2deg); }
      .tilt-s { transform: rotate(-0.5deg); }
      /* Translucent tape. Label text on tape is always paper-white; navy ink
         fails contrast on a translucent strip over the navy wall. */
      .tape {
        display: inline-block;
        background: color-mix(in srgb, var(--accent) 30%, transparent);
        color: var(--paper);
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font-size: 0.6875rem;
        padding: 0.375rem 1.125rem;
        transform: rotate(-0.8deg);
      }
      /* Corner tape pieces holding an artifact to the wall. */
      .taped { position: relative; }
      .taped::before, .taped::after {
        content: "";
        position: absolute;
        width: 5.5rem;
        height: 1.625rem;
        background: color-mix(in srgb, var(--accent) 26%, transparent);
        top: -0.8125rem;
      }
      .taped::before { left: -1.75rem; transform: rotate(-38deg); }
      .taped::after { right: -1.75rem; transform: rotate(38deg); }
      .nums { font-variant-numeric: tabular-nums; }
      .display {
        font-weight: 800;
        letter-spacing: -0.03em;
        line-height: 0.9;
        text-transform: uppercase;
      }
      /* The prize wall's pegboard: holes implied by color only, no textures. */
      .pegboard {
        background-color: var(--wall-deep);
        background-image: radial-gradient(color-mix(in srgb, var(--paper) 13%, transparent) 2px, transparent 2.6px);
        background-size: 30px 30px;
        background-position: 15px 15px;
      }
      /* The one authored moment: the flyer and photo settle onto the wall on
         load, like they were just pinned. Visible by default via backwards
         fill; gated below. */
      .settle { animation: settle 0.7s cubic-bezier(0.16, 1, 0.3, 1) backwards; }
      @keyframes settle {
        from { opacity: 0; transform: translateY(-14px) rotate(0deg); }
      }
      .settle.tilt-l { animation-name: settle-l; }
      .settle.tilt-r { animation-name: settle-r; }
      @keyframes settle-l {
        from { opacity: 0; transform: translateY(-14px) rotate(0.5deg); }
        to { opacity: 1; transform: translateY(0) rotate(-1deg); }
      }
      @keyframes settle-r {
        from { opacity: 0; transform: translateY(-14px) rotate(-0.5deg); }
        to { opacity: 1; transform: translateY(0) rotate(1.2deg); }
      }
      @media (prefers-reduced-motion: reduce) {
        .settle { animation: none; }
      }
      /* Tear-off tabs: dashed cut lines, lift on hover. */
      .tab {
        border-top: 2px dashed color-mix(in srgb, var(--ink) 35%, transparent);
        border-left: 2px dashed color-mix(in srgb, var(--ink) 25%, transparent);
        transition: transform 0.15s ease-out;
      }
      .tab:first-child { border-left: none; }
      .tab:hover { transform: translateY(3px); }
      .store :focus-visible { outline: 2px solid var(--hot); outline-offset: 3px; }
      @media (max-width: 640px) {
        .taped::before { left: -1rem; }
        .taped::after { right: -1rem; }
      }
    `}</style>
  );
}
