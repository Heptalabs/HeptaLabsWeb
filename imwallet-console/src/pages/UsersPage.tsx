import { useMemo, useState } from 'react';
import type { DashboardPayload } from '../types/admin';

type UsersCopy = {
  title: string;
  searchPlaceholder: string;
  user: string;
  tier: string;
  kyc: string;
  wallet: string;
  sendLimit: string;
  action: string;
  increaseLimit: string;
};

type Props = {
  dashboard: DashboardPayload;
  copy: UsersCopy;
  onUpdateLimit: (userId: string, limit: number) => Promise<void>;
};

export const UsersPage = ({ dashboard, copy, onUpdateLimit }: Props) => {
  const [query, setQuery] = useState('');

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return dashboard.users;

    return dashboard.users.filter((user) => {
      return user.name.toLowerCase().includes(q) || user.id.toLowerCase().includes(q) || user.tier.toLowerCase().includes(q);
    });
  }, [dashboard.users, query]);

  return (
    <section className="panel" style={{ marginTop: 16 }}>
      <div className="panel-head">
        <h3>{copy.title}</h3>
        <input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{copy.user}</th>
              <th>{copy.tier}</th>
              <th>{copy.kyc}</th>
              <th>{copy.wallet}</th>
              <th>{copy.sendLimit}</th>
              <th>{copy.action}</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((row) => (
              <tr key={row.id}>
                <td>{row.name} ({row.id})</td>
                <td>{row.tier}</td>
                <td>{row.kyc}</td>
                <td>${row.walletUsd.toLocaleString()}</td>
                <td>${row.sendLimitUsd.toLocaleString()}</td>
                <td>
                  <button className="ghost-btn tiny" onClick={() => onUpdateLimit(row.id, row.sendLimitUsd + 1000)}>
                    {copy.increaseLimit}
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
