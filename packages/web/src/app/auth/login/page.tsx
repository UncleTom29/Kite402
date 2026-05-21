'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { trpc } from '../../providers';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showSessionExpiredMessage, setShowSessionExpiredMessage] = useState(false);

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get('reason');
    const fromStorage = sessionStorage.getItem('kite402:authMessage') === 'session-expired';
    const show = reason === 'session_expired' || fromStorage;
    setShowSessionExpiredMessage(show);
    if (show) sessionStorage.removeItem('kite402:authMessage');
  }, []);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data: { token: string }) => {
      localStorage.setItem('kite402:token', data.token);
      router.push('/fleet');
    },
    onError: (err: { message: string }) => setError(err.message),
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-kite-bg">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image src="/kite402_logo.svg" alt="Kite402" width={40} height={40} className="mx-auto mb-4" priority />
          <h1 className="text-2xl font-semibold">Kite402</h1>
          <p className="text-kite-muted text-sm mt-1">Operator Dashboard</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            loginMutation.mutate({ email, password });
          }}
          className="card space-y-4"
        >
          {showSessionExpiredMessage && (
            <p className="text-amber-300 text-xs border border-amber-500/30 bg-amber-500/10 px-3 py-2 rounded">
              Your session expired. Please sign in again.
            </p>
          )}

          <div>
            <label className="block text-xs text-kite-muted mb-1.5">Email</label>
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs text-kite-muted mb-1.5">Password</label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs border border-red-500/20 bg-red-500/5 px-3 py-2 rounded">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="text-center text-xs text-kite-muted">
            No account?{' '}
            <Link href="/auth/register" className="text-kite-blue hover:underline">
              Register
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
