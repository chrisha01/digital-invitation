'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Mode = 'signin' | 'signup';

export default function AuthForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mode === 'signup' ? { name, email, password } : { email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'That did not work. Please try again.');
      } else {
        router.replace(next || '/');
        router.refresh();
      }
    } catch {
      setError('Network problem — please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-card" onSubmit={submit}>
      <h1>{mode === 'signin' ? 'Welcome back' : 'Make an account'}</h1>
      <p className="muted small">
        {mode === 'signin'
          ? 'Your invitations, guest lists and seating plans are waiting.'
          : 'One account keeps your invitations, replies and seating plans together.'}
      </p>

      <div className="seg seg-wrap auth-tabs">
        <button
          type="button"
          className={mode === 'signin' ? 'is-on' : ''}
          onClick={() => {
            setMode('signin');
            setError(null);
          }}
        >
          Sign in
        </button>
        <button
          type="button"
          className={mode === 'signup' ? 'is-on' : ''}
          onClick={() => {
            setMode('signup');
            setError(null);
          }}
        >
          Create account
        </button>
      </div>

      {mode === 'signup' ? (
        <label className="field">
          <span className="field-label">Your name</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
        </label>
      ) : null}

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

      <label className="field">
        <span className="field-label">Password</span>
        <input
          className="input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          minLength={mode === 'signup' ? 8 : undefined}
          required
        />
        {mode === 'signup' ? (
          <span className="field-hint">At least 8 characters.</span>
        ) : null}
      </label>

      {error ? <p className="form-error">{error}</p> : null}

      {mode === 'signin' ? (
        <a className="muted small auth-forgot" href="/reset">
          Forgot your password?
        </a>
      ) : null}

      <button className="btn btn-primary btn-wide" disabled={busy}>
        {busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : 'Create account'}
      </button>
    </form>
  );
}
