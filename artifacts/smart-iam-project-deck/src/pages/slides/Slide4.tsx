export default function Slide4() {
  return (
    <div className="relative w-screen h-screen overflow-hidden deck-root">
      <div className="deck-shell">
        <div className="eyebrow">03 / Adaptive signals</div>
        <h1 className="content-title">Risk Detection</h1>
        <div className="mt-[7vh] grid grid-cols-[0.75fr_1.25fr] gap-[5vw] items-start">
          <div className="risk-panel p-[3vw]">
            <div className="stat-number">0–100</div>
            <div className="stat-caption">Login risk scores from 0 to 100</div>
            <div className="mt-[7vh] grid grid-cols-2 gap-[1vw]">
              <div className="border-t border-[#f1b66b] pt-[1.5vh] small-label">NORMAL</div>
              <div className="border-t border-[#f1b66b] pt-[1.5vh] small-label">MONITOR</div>
              <div className="border-t border-[#f1b66b] pt-[1.5vh] small-label">WARNING</div>
              <div className="border-t border-[#f1b66b] pt-[1.5vh] small-label">CRITICAL</div>
            </div>
          </div>
          <div className="bullet-stack pt-[1vh]">
            <div className="bullet-item"><span className="bullet-mark" /><span>Signals include failed attempts, new devices, unusual times, and rapid attempts</span></div>
            <div className="bullet-item"><span className="bullet-mark" /><span>Risk levels: NORMAL, MONITOR, WARNING, and CRITICAL</span></div>
            <div className="bullet-item"><span className="bullet-mark" /><span>High-risk events create reviewable alerts</span></div>
            <div className="bullet-item"><span className="bullet-mark" /><span>Simulator generates synthetic events only</span></div>
          </div>
        </div>
      </div>
      <div className="footer-line"><span>Detect / score / review</span><span>04 / 08</span></div>
    </div>
  );
}