'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useCopy } from './useCopy';
import CopyFallback from './CopyFallback';

export default function ResetForm({ token, canEmail }: { token?: string; canEmail: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { copy: clipboardCopy, outcome: copyOutcome, clear: clearCopy } = useCopy();

  async function requestLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/reset/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'That did not work.');
      } else {
        setRequested(true);
        setLink(data.url ? `${window.location.origin}${data.url}` : null);
      }
    } catch {
      setError('Network problem — please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function setNewPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/reset/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'That link did not work.');
      } else {
        router.replace('/');
        router.refresh();
      }
    } catch {
      setError('Network problem — please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (token) {
    return (
      <form className="auth-card" onSubmit={setNewPassword}>
        <h1>Set a new password</h1>
        <p className="muted small">This link can be used once, then it expires.</p>
        <label className="field">
          <span className="field-label">New password</span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
          <span className="field-hint">At least 8 characters.</span>
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="btn btn-primary btn-wide" disabled={busy}>
          {busy ? 'Saving…' : 'Save password and sign in'}
        </button>
      </form>
    );
  }

  return (
    <form className="auth-card" onSubmit={requestLink}>
      <h1>Forgot your password?</h1>
      <p className="muted small">
        Enter the email on your account and we will make a one-time link to set a new password.
      </p>

      <label className="field">
        <span className="field-label">Email</span>
        <input
          className="input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </label>

      {error ? <p className="form-error">{error}</p> : null}

      {requested ? (
        link ? (
          <div className="reset-link">
            <p className="muted small">
              No email service is connected, so here is the link. It works once and expires in 30
              minutes.
            </p>
            <input className="input mono" readOnly value={link} />
            <div className="row-actions">
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={async () => {
                  clearCopy();
                  const result = await clipboardCopy(link);
                  if (result?.outcome === 'copied') {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1600);
                  }
                }}
              >
                {copied ? 'Copied' : 'Copy link'}
              </button>
              {copyOutcome && copyOutcome.outcome === 'copied' ? (
                <span className="muted small">Copied</span>
              ) : null}
              {copyOutcome &&
              copyOutcome.outcome === 'failed' ? (
                <CopyFallback outcome={copyOutcome} />
              ) : null}
              <a className="btn btn-primary btn-small" href={link}>
                Open reset page
              </a>
            </div>
          </div>
        ) : (
          <p className="muted small">
            {canEmail
              ? 'If that email has an account, a reset link is on its way. Check the inbox and the spam folder.'
              : 'This server has no email service connected, so a reset link cannot be delivered. Ask whoever runs this account to reset the password for you.'}
          </p>
        )
      ) : null}

      <button className="btn btn-primary btn-wide" disabled={busy}>
        {busy ? 'Working…' : 'Make reset link'}
      </button>
      <a className="muted small" href="/signin">
        Back to sign in
      </a>
    </form>
  );
}
