export default function Slide7() {
  return (
    <div className="relative w-screen h-screen overflow-hidden deck-root">
      <div className="deck-shell">
        <div className="eyebrow">06 / System design</div>
        <h1 className="content-title content-title-wide">Application Architecture</h1>
        <div className="architecture-line" />
        <div className="relative mt-[9vh] grid grid-cols-3 gap-[3vw]">
          <div className="architecture-node">
            <div className="small-label">Experience</div>
            <div className="mt-[2.4vh] bullet-stack">
              <div className="bullet-item"><span className="bullet-mark" /><span>React and Vite frontend for the security console</span></div>
              <div className="bullet-item"><span className="bullet-mark" /><span>Generated React Query hooks and Zod schemas</span></div>
            </div>
          </div>
          <div className="architecture-node">
            <div className="small-label">Services</div>
            <div className="mt-[2.4vh] bullet-stack">
              <div className="bullet-item"><span className="bullet-mark" /><span>Express API server with OpenAPI as the source of truth</span></div>
              <div className="bullet-item"><span className="bullet-mark" /><span>Cookie sessions backed by hashed database tokens</span></div>
            </div>
          </div>
          <div className="architecture-node">
            <div className="small-label">Persistence</div>
            <div className="mt-[2.4vh] bullet-stack">
              <div className="bullet-item"><span className="bullet-mark" /><span>PostgreSQL persistence with Drizzle ORM</span></div>
              <div className="bullet-item"><span className="bullet-mark" /><span>Synthetic data only; no external scanning or attack automation</span></div>
            </div>
          </div>
        </div>
      </div>
      <div className="footer-line"><span>OpenAPI / Express / PostgreSQL</span><span>07 / 08</span></div>
    </div>
  );
}