export default function Slide6() {
  return (
    <div className="relative w-screen h-screen overflow-hidden deck-root">
      <div className="deck-shell">
        <div className="eyebrow">05 / Administrative workflows</div>
        <h1 className="content-title">Administration</h1>
        <div className="mt-[6vh] grid grid-cols-3 gap-[1.6vw]">
          <div className="panel p-[2.2vw]">
            <div className="small-label">Users</div>
            <div className="mt-[3vh] bullet-stack">
              <div className="bullet-item"><span className="bullet-mark" /><span>User creation, search, update, locking, activation, and deletion</span></div>
              <div className="bullet-item"><span className="bullet-mark" /><span>Session revocation for individual active sessions</span></div>
            </div>
          </div>
          <div className="panel p-[2.2vw]">
            <div className="small-label">Policies</div>
            <div className="mt-[3vh] bullet-stack">
              <div className="bullet-item"><span className="bullet-mark" /><span>Role creation, editing, deletion, and permission assignment</span></div>
              <div className="bullet-item"><span className="bullet-mark" /><span>Permission catalog with resource and action metadata</span></div>
            </div>
          </div>
          <div className="panel p-[2.2vw]">
            <div className="small-label">People</div>
            <div className="mt-[3vh] bullet-stack">
              <div className="bullet-item"><span className="bullet-mark" /><span>Profile updates for identity details and MFA settings</span></div>
            </div>
          </div>
        </div>
        <div className="mt-[7vh] flex items-center gap-[2vw]"><div className="rule" /><div className="body-copy">Every admin action is persistent, permissioned, and auditable.</div></div>
      </div>
      <div className="footer-line"><span>Manage identities without losing control</span><span>06 / 08</span></div>
    </div>
  );
}