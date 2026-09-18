export default function Slide3() {
  return (
    <div className="relative w-screen h-screen overflow-hidden deck-root">
      <div className="deck-shell">
        <div className="eyebrow">02 / Access governance</div>
        <h1 className="content-title">Role-Based Access</h1>
        <div className="mt-[5vh] grid grid-cols-5 gap-[1vw]">
          <div className="panel-soft p-[1.5vw]"><div className="small-label">Identity</div><div className="mt-[2vh] body-copy">SUPER_ADMIN</div></div>
          <div className="panel-soft p-[1.5vw]"><div className="small-label">Identity</div><div className="mt-[2vh] body-copy">ADMIN</div></div>
          <div className="panel-soft p-[1.5vw]"><div className="small-label">Team</div><div className="mt-[2vh] body-copy">MANAGER</div></div>
          <div className="panel-soft p-[1.5vw]"><div className="small-label">Workforce</div><div className="mt-[2vh] body-copy">EMPLOYEE</div></div>
          <div className="panel-soft p-[1.5vw]"><div className="small-label">Limited</div><div className="mt-[2vh] body-copy">GUEST</div></div>
        </div>
        <div className="bullet-grid mt-[5vh]">
          <div className="bullet-stack">
            <div className="bullet-item"><span className="bullet-mark" /><span>Five seeded roles: SUPER_ADMIN, ADMIN, MANAGER, EMPLOYEE, and GUEST</span></div>
            <div className="bullet-item"><span className="bullet-mark" /><span>Granular permissions across users, roles, security, audit, profile, dashboard, and reports</span></div>
            <div className="bullet-item"><span className="bullet-mark" /><span>Backend permission checks are authoritative</span></div>
          </div>
          <div className="bullet-stack">
            <div className="bullet-item"><span className="bullet-mark" /><span>Unauthorized access returns a real 403 response</span></div>
            <div className="bullet-item"><span className="bullet-mark" /><span>Admin CRUD flows are wired to the database</span></div>
          </div>
        </div>
      </div>
      <div className="footer-line"><span>Policy is enforced server-side</span><span>03 / 08</span></div>
    </div>
  );
}