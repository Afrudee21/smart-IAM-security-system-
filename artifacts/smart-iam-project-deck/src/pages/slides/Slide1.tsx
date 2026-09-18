const base = import.meta.env.BASE_URL;

export default function Slide1() {
  return (
    <div className="relative w-screen h-screen overflow-hidden deck-root">
      <img src={base + "iam-cover.png"} crossOrigin="anonymous" className="cover-visual" alt="Abstract identity security operations scene" />
      <div className="cover-overlay" />
      <div className="cover-grid" />
      <div className="relative z-10 flex h-full w-full flex-col justify-center px-[7vw]">
        <div className="eyebrow">Smart IAM / Project Overview</div>
        <div className="mt-[3vh] hero-title">Smart IAM Security Platform</div>
        <div className="hero-subtitle">Enterprise identity, access, and security monitoring in one runnable application.</div>
        <div className="mt-[6vh] rule" />
      </div>
      <div className="footer-line"><span>Identity / Access / Security</span><span>01 / 08</span></div>
    </div>
  );
}