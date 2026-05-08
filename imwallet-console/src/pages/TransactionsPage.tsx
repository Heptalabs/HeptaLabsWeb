import { useMemo, useState } from 'react';
import type { DashboardPayload, WithdrawalValidationRequest, WithdrawalValidationResult } from '../types/admin';

type TransactionsCopy = {
  title: string;
  runRiskScan: string;
  all: string;
  pending: string;
  manualReview: string;
  approved: string;
  blocked: string;
  id: string;
  user: string;
  flow: string;
  asset: string;
  amount: string;
  risk: string;
  status: string;
  withdrawalPrecheck: string;
  validateSample: string;
  validationResult: string;
};

type Props = {
  dashboard: DashboardPayload;
  copy: TransactionsCopy;
  onRunRiskScan: () => Promise<void>;
  onValidateWithdrawal: (payload: WithdrawalValidationRequest) => Promise<WithdrawalValidationResult>;
};

export const TransactionsPage = ({ dashboard, copy, onRunRiskScan, onValidateWithdrawal }: Props) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'manual-review' | 'approved' | 'blocked'>('all');
  const [validationResult, setValidationResult] = useState<WithdrawalValidationResult | null>(null);

  const rows = useMemo(
    () => (filter === 'all' ? dashboard.queue : dashboard.queue.filter((item) => item.status === filter)),
    [dashboard.queue, filter]
  );

  const filterLabels = {
    all: copy.all,
    pending: copy.pending,
    'manual-review': copy.manualReview,
    approved: copy.approved,
    blocked: copy.blocked
  } as const;

  return (
    <section className="panel" style={{ marginTop: 16 }}>
      <div className="panel-head">
        <h3>{copy.title}</h3>
        <div className="filter-wrap">
          {(['all', 'pending', 'manual-review', 'approved', 'blocked'] as const).map((item) => (
            <button key={item} className={filter === item ? 'chip active' : 'chip'} onClick={() => setFilter(item)}>
              {filterLabels[item]}
            </button>
          ))}
          <button className="primary-btn" onClick={onRunRiskScan}>{copy.runRiskScan}</button>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{copy.id}</th>
              <th>{copy.user}</th>
              <th>{copy.flow}</th>
              <th>{copy.asset}</th>
              <th>{copy.amount}</th>
              <th>{copy.risk}</th>
              <th>{copy.status}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.id}</td>
                <td>{row.user}</td>
                <td>{row.flow}</td>
                <td>{row.asset}</td>
                <td>{row.amount.toLocaleString()}</td>
                <td>{row.riskScore}</td>
                <td>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 20 }}>
        <h4>{copy.withdrawalPrecheck}</h4>
        <button
          className="ghost-btn"
          onClick={async () => {
            const result = await onValidateWithdrawal({
              chain: 'ETH',
              asset: 'ETH',
              address: '0x7A6131A4A6Ddb1Ff52C8f2C6fF9a24336aD93cE2',
              amount: 12000,
              userTier: 'Basic'
            });
            setValidationResult(result);
          }}
        >
          {copy.validateSample}
        </button>
        {validationResult ? (
          <p className="meta" style={{ marginTop: 8 }}>
            {copy.validationResult}: ok={String(validationResult.ok)} / risk={validationResult.riskScore} / reason={validationResult.reason}
          </p>
        ) : null}
      </div>
    </section>
  );
};
