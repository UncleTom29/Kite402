'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '../../../providers';
import { CheckCircle, Circle, Loader } from 'lucide-react';

type StepStatus = 'pending' | 'active' | 'done' | 'error';

const DEPLOY_STEPS = [
  'Deploying AA Wallet on Kite chain',
  'Configuring spend policy',
  'Registering in Kite402Registry',
];

export default function NewAgentPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [group, setGroup] = useState('');
  const [perOrder, setPerOrder] = useState('100');
  const [daily, setDaily] = useState('500');
  const [lifetime, setLifetime] = useState('10000');
  const [steps, setSteps] = useState<StepStatus[]>(['pending', 'pending', 'pending']);
  const [deploying, setDeploying] = useState(false);
  const [vaultAddress, setVaultAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createMutation = trpc.agents.create.useMutation({
    onSuccess: (data) => {
      // Simulate step progression
      const advance = async () => {
        for (let i = 0; i < 3; i++) {
          setSteps((s) => s.map((v, idx) => (idx === i ? 'active' : v)));
          await new Promise((r) => setTimeout(r, 1500));
          setSteps((s) => s.map((v, idx) => (idx === i ? 'done' : v)));
        }
        setVaultAddress(data.vaultAddress ?? '0x…');
        setDeploying(false);
      };
      advance();
    },
    onError: (err) => {
      setError(err.message);
      setDeploying(false);
      setSteps(['pending', 'pending', 'pending']);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDeploying(true);
    setSteps(['active', 'pending', 'pending']);

    createMutation.mutate({
      name,
      groupName: group,
      policy: {
        perOrderLimit: BigInt(Math.round(Number(perOrder) * 1e6)),
        dailyLimit: BigInt(Math.round(Number(daily) * 1e6)),
        lifetimeLimit: BigInt(Math.round(Number(lifetime) * 1e6)),
      },
    });
  };

  if (vaultAddress) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="card text-center py-10">
          <CheckCircle size={40} className="mx-auto text-green-400 mb-4" />
          <h2 className="text-lg font-semibold mb-1">Agent deployed!</h2>
          <p className="text-kite-muted text-sm mb-4">Your vault is live on Kite chain</p>
          <code className="text-xs bg-kite-bg px-3 py-2 rounded block font-mono mb-6">
            {vaultAddress}
          </code>
          <div className="flex gap-2 justify-center">
            <button onClick={() => router.push('/dashboard')} className="btn-primary">
              View Fleet →
            </button>
            <button
              onClick={() => {
                setVaultAddress(null);
                setDeploying(false);
                setSteps(['pending', 'pending', 'pending']);
                setName('');
                setGroup('');
              }}
              className="btn-ghost"
            >
              Add Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-xl font-semibold mb-1">Create New Agent</h1>
      <p className="text-kite-muted text-sm mb-6">
        Deploy an Account Abstraction wallet with configurable spend limits
      </p>

      {deploying ? (
        <div className="card space-y-4">
          <p className="text-sm font-medium mb-2">Deploying agent wallet…</p>
          {DEPLOY_STEPS.map((label, i) => {
            const status = steps[i];
            return (
              <div key={i} className="flex items-center gap-3">
                {status === 'done' ? (
                  <CheckCircle size={16} className="text-green-400 shrink-0" />
                ) : status === 'active' ? (
                  <Loader size={16} className="text-kite-blue animate-spin shrink-0" />
                ) : (
                  <Circle size={16} className="text-kite-border shrink-0" />
                )}
                <span className={`text-sm ${status === 'done' ? 'text-slate-300' : status === 'active' ? 'text-slate-100' : 'text-kite-muted'}`}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="block text-xs text-kite-muted mb-1.5">Agent Name</label>
            <input
              className="input"
              placeholder="e.g. Shopping Agent Alpha"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs text-kite-muted mb-1.5">Group / Team</label>
            <input
              className="input"
              placeholder="e.g. procurement"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              required
            />
          </div>

          <div className="border-t border-kite-border pt-4">
            <p className="text-xs text-kite-muted uppercase tracking-widest mb-3">Spend Policy (USDC)</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Per Order', val: perOrder, set: setPerOrder },
                { label: 'Daily', val: daily, set: setDaily },
                { label: 'Lifetime', val: lifetime, set: setLifetime },
              ].map(({ label, val, set }) => (
                <div key={label}>
                  <label className="block text-xs text-kite-muted mb-1">{label}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-kite-muted text-xs">$</span>
                    <input
                      className="input pl-6"
                      type="number"
                      min="1"
                      value={val}
                      onChange={(e) => set(e.target.value)}
                      required
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-xs border border-red-500/20 bg-red-500/5 px-3 py-2 rounded">
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary w-full">
            Deploy Agent Wallet
          </button>
        </form>
      )}
    </div>
  );
}
