import Link from 'next/link';
import { LayoutDashboard, Users, Bell, FileText, Shield } from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Fleet', icon: LayoutDashboard },
  { href: '/dashboard/approvals', label: 'Approvals', icon: Bell },
  { href: '/dashboard/agents/new', label: 'New Agent', icon: Users },
  { href: '/dashboard/governance', label: 'Governance', icon: Shield },
  { href: '/dashboard/audit', label: 'Audit Log', icon: FileText },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-56 border-r border-kite-border bg-kite-surface flex flex-col">
        <div className="p-4 border-b border-kite-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-kite-blue rounded-md flex items-center justify-center">
              <span className="text-white text-xs font-bold">K</span>
            </div>
            <span className="font-semibold text-sm tracking-wide">Kite402</span>
          </div>
          <p className="text-kite-muted text-[10px] mt-1 tracking-widest uppercase">
            Agent Finance
          </p>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-slate-400
                         hover:text-slate-100 hover:bg-kite-border/60 transition-colors group"
            >
              <Icon size={14} className="group-hover:text-kite-blue transition-colors" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-kite-border">
          <p className="text-kite-muted text-[10px]">Kite Chain Testnet</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] text-green-400">Connected</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
