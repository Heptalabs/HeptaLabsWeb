import type { DashboardPayload } from '../types/admin';

type AuditCopy = {
  title: string;
  id: string;
  action: string;
  actor: string;
  scope: string;
  summary: string;
  createdAt: string;
};

export const AuditPage = ({ dashboard, copy }: { dashboard: DashboardPayload; copy: AuditCopy }) => {
  return (
    <section className="panel" style={{ marginTop: 16 }}>
      <div className="panel-head">
        <h3>{copy.title}</h3>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{copy.id}</th>
              <th>{copy.action}</th>
              <th>{copy.actor}</th>
              <th>{copy.scope}</th>
              <th>{copy.summary}</th>
              <th>{copy.createdAt}</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.auditLogs.map((row) => (
              <tr key={row.id}>
                <td>{row.id}</td>
                <td>{row.action}</td>
                <td>{row.actor}</td>
                <td>{row.scope}</td>
                <td>{row.summary}</td>
                <td>{row.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
