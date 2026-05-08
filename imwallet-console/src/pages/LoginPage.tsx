import { useState } from 'react';
import { useAdminAuth } from '../auth/AuthContext';

type LoginCopy = {
  title: string;
  subtitle: string;
  emailPlaceholder: string;
  passwordPlaceholder: string;
  nextMfa: string;
  loading: string;
  challengeSentPrefix: string;
  challengeHint: string;
  mfaPlaceholder: string;
  verifyMfa: string;
  verifying: string;
};

export const LoginPage = ({ copy }: { copy: LoginCopy }) => {
  const { challenge, login, verifyMfa, authLoading, authError } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');

  return (
    <div className="admin-shell" style={{ gridTemplateColumns: '1fr' }}>
      <main className="content" style={{ maxWidth: 560, margin: '0 auto', width: '100%' }}>
        <section className="panel" style={{ marginTop: 40 }}>
          <h3>{copy.title}</h3>
          <p className="meta">{copy.subtitle}</p>

          {!challenge ? (
            <>
              <input className="search" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={copy.emailPlaceholder} />
              <input
                className="search"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={copy.passwordPlaceholder}
                style={{ marginTop: 10 }}
              />
              <button className="primary-btn" onClick={() => login(email, password)} disabled={authLoading} style={{ marginTop: 12 }}>
                {authLoading ? copy.loading : copy.nextMfa}
              </button>
            </>
          ) : (
            <>
              <p className="meta" style={{ marginTop: 12 }}>
                {copy.challengeSentPrefix} {challenge.maskedTo}. {copy.challengeHint}
              </p>
              <input className="search" value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} placeholder={copy.mfaPlaceholder} />
              <button className="primary-btn" onClick={() => verifyMfa(mfaCode)} disabled={authLoading} style={{ marginTop: 12 }}>
                {authLoading ? copy.verifying : copy.verifyMfa}
              </button>
            </>
          )}

          {authError ? <p className="meta" style={{ color: '#ef4444', marginTop: 12 }}>{authError}</p> : null}
        </section>
      </main>
    </div>
  );
};
