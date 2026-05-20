'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { clsx } from 'clsx';

export function CopyButton({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={clsx(
        'inline-flex items-center gap-1 text-kite-muted hover:text-slate-200 transition-colors text-xs',
        className,
      )}
      title="Copy to clipboard"
    >
      {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
