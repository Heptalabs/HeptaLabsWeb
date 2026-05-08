import type { DashboardPayload } from '../types/admin';

type OverviewCopy = {
  operationsDashboard: string;
  adminConsole: string;
  totalExposure: string;
  acrossChains: string;
  users: string;
  activeProfiles: string;
  pendingQueue: string;
  needsReview: string;
  highRiskAlerts: string;
  riskOver70: string;
};

export const OverviewPage = ({ dashboard, copy }: { dashboard: DashboardPayload; copy: OverviewCopy }) => {
  const totalExposure = dashboard.assets.reduce((sum, item) => sum + item.usdExposure, 0);
  const pendingQueue = dashboard.queue.filter((item) => item.status === 'pending' || item.status === 'manual-review').length;
  const highRisk = dashboard.queue.filter((item) => item.riskScore >= 70).length;

  return (
    <>
      <header className="topbar">
        <div>
          <p className="topbar-kicker">{copy.operationsDashboard}</p>
          <h2>{copy.adminConsole}</h2>
        </div>
      </header>

      <section className="kpi-grid">
        <article className="kpi-card">
          <p>{copy.totalExposure}</p>
          <h3>${totalExposure.toLocaleString()}</h3>
          <span className="kpi-tag">{copy.acrossChains}</span>
        </article>
        <article className="kpi-card">
          <p>{copy.users}</p>
          <h3>{dashboard.users.length}</h3>
          <span className="kpi-tag">{copy.activeProfiles}</span>
        </article>
        <article className="kpi-card">
          <p>{copy.pendingQueue}</p>
          <h3>{pendingQueue}</h3>
          <span className="kpi-tag warn">{copy.needsReview}</span>
        </article>
        <article className="kpi-card">
          <p>{copy.highRiskAlerts}</p>
          <h3>{highRisk}</h3>
          <span className="kpi-tag danger">{copy.riskOver70}</span>
        </article>
      </section>
    </>
  );
};
