export default function Slide8() {
  return (
    <div className="relative w-screen h-screen overflow-hidden deck-root">
      <div className="deck-shell">
        <div className="eyebrow">07 / Delivery confidence</div>
        <h1 className="content-title">Verification</h1>
        <div className="mt-[6vh] grid grid-cols-[1.2fr_0.8fr] gap-[5vw] items-start">
          <div className="bullet-grid mt-0">
            <div className="bullet-stack">
              <div className="bullet-item"><span className="bullet-mark" /><span>Full workspace TypeScript check passes</span></div>
              <div className="bullet-item"><span className="bullet-mark" /><span>API build and managed workflows run successfully</span></div>
              <div className="bullet-item"><span className="bullet-mark" /><span>Login, dashboard, MFA, RBAC, simulator, sessions, and CSV export smoke-tested</span></div>
            </div>
            <div className="bullet-stack">
              <div className="bullet-item"><span className="bullet-mark" /><span>Demo data includes 11 identities, five roles, and security history</span></div>
              <div className="bullet-item"><span className="bullet-mark" /><span>Demo password: DemoPass123!</span></div>
            </div>
          </div>
          <div className="closing-panel">
            <div className="small-label">Status</div>
            <div className="mt-[2.5vh] body-copy">Smart IAM Security Platform is ready to publish</div>
            <div className="mt-[4vh] rule" />
          </div>
        </div>
      </div>
      <div className="footer-line"><span>Smart IAM Security Platform</span><span>08 / 08</span></div>
    </div>
  );
}