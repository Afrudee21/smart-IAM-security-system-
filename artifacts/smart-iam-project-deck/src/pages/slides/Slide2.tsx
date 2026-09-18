export default function Slide2() {
  return (
    <div className="relative w-screen h-screen overflow-hidden deck-root">
      <div className="rail" />
      <div className="deck-shell">
        <div className="eyebrow">01 / Core identity layer</div>
        <h1 className="content-title">Identity Control</h1>
        <div className="bullet-grid">
          <div className="bullet-stack">
            <div className="bullet-item"><span className="bullet-mark" /><span>Local registration and username-or-email login</span></div>
            <div className="bullet-item"><span className="bullet-mark" /><span>Scrypt password hashing with per-password salts</span></div>
            <div className="bullet-item"><span className="bullet-mark" /><span>HTTP-only cookie sessions with expiration and revocation</span></div>
          </div>
          <div className="bullet-stack panel p-[2.5vw]">
            <div className="bullet-item"><span className="bullet-mark" /><span>MFA challenges with hashed one-time codes</span></div>
            <div className="bullet-item"><span className="bullet-mark" /><span>Profile and active-session management</span></div>
            <div className="mt-[4vh] h-[0.25vw] w-[10vw] bg-accent" />
          </div>
        </div>
      </div>
      <div className="footer-line"><span>Authentication is a product surface</span><span>02 / 08</span></div>
    </div>
  );
}