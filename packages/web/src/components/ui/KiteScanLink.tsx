import { ExternalLink } from 'lucide-react';

const BASE = 'https://testnet.kitescan.ai';

interface KiteScanLinkProps {
  hash: string;
  type?: 'tx' | 'address';
  truncate?: boolean;
  className?: string;
}

export function KiteScanLink({
  hash,
  type = 'tx',
  truncate = true,
  className,
}: KiteScanLinkProps) {
  const url = `${BASE}/${type}/${hash}`;
  const display = truncate ? `${hash.slice(0, 6)}…${hash.slice(-4)}` : hash;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-kite-blue hover:text-blue-400 font-mono text-xs transition-colors ${className ?? ''}`}
    >
      {display}
      <ExternalLink size={10} />
    </a>
  );
}
