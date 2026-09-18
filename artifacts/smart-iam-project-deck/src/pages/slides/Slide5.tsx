export default function Slide5() {
  return (
    <div className="relative w-screen h-screen overflow-hidden deck-root">
      <div className="deck-shell">
        <div className="eyebrow">04 / Security operations</div>
        <h1 className="content-title">Security Operations</h1>
        <div className="mt-[6vh] grid grid-cols-[1fr_1fr] gap-[4vw]">
          <div className="panel p-[2.5vw]">
            <div className="small-label">Operational visibility</div>
            <div className="mt-[3vh] bullet-stack">
              <div className="bullet-item"><span className="bullet-mark" /><span>Dashboard metrics for users, roles, logins, sessions, alerts, and risk</span></div>
              <div className="bullet-item"><span className="bullet-mark" /><span>Chart-ready login activity, risk distribution, and alert severity data</span></div>
              <div className="bullet-item"><span className="bullet-mark" /><span>Alert queue with resolution workflow</span></div>
            </div>
          </div>
          <div className="panel-soft p-[2.5vw]">
            <div className="small-label">Accountability</div>
            <div className="mt-[3vh] bullet-stack">
              <div className="bullet-item"><span className="bullet-mark" /><span>Audit trail for authentication and administrative actions</span></div>
              <div className="bullet-item"><span className="bullet-mark" /><span>CSV export for audit review</span></div>
              <div className="mt-[2vh] grid grid-cols-6 gap-[0.6vw] items-end">
                <div className="h-[5vh] bg-accent/45" /><div className="h-[8vh] bg-accent/55" /><div className="h-[12vh] bg-accent/70" /><div className="h-[9vh] bg-accent/50" /><div className="h-[15vh] bg-accent/80" /><div className="h-[11vh] bg-accent/60" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="footer-line"><span>Evidence is queryable</span><span>05 / 08</span></div>
    </div>
  );
}