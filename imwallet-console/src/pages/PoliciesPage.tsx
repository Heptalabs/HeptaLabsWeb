import type { DashboardPayload } from '../types/admin';

type PoliciesCopy = {
  title: string;
  key: string;
  value: string;
  updatedAt: string;
  updatedBy: string;
  action: string;
  toggle: string;
};

type Props = {
  dashboard: DashboardPayload;
  copy: PoliciesCopy;
  onUpdatePolicy: (key: string, value: string) => Promise<void>;
};

export const PoliciesPage = ({ dashboard, copy, onUpdatePolicy }: Props) => {
  return (
    <section className="panel" style={{ marginTop: 16 }}>
      <div className="panel-head">
        <h3>{copy.title}</h3>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{copy.key}</th>
              <th>{copy.value}</th>
              <th>{copy.updatedAt}</th>
              <th>{copy.updatedBy}</th>
              <th>{copy.action}</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.policies.map((row) => (
              <tr key={row.key}>
                <td>{row.key}</td>
                <td>{row.value}</td>
                <td>{row.updatedAt}</td>
                <td>{row.updatedBy}</td>
                <td>
                  <button className="ghost-btn tiny" onClick={() => onUpdatePolicy(row.key, row.value === 'true' ? 'false' : 'true')}>
                    {copy.toggle}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
