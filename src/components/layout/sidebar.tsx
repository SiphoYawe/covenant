'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Bot,
  Network,
  CreditCard,
  Play,
  Shield,
  EllipsisVertical,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navigationItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Agents', href: '/agents', icon: Bot },
  { label: 'Trust Graph', href: '/trust-graph', icon: Network },
  { label: 'Payments', href: '/payments', icon: CreditCard },
];

const demoItems: NavItem[] = [
  { label: 'Run Demo', href: '/demo', icon: Play },
  { label: 'Civic Guards', href: '/civic-guards', icon: Shield },
];

function NavSection({
  label,
  items,
  currentPath,
}: {
  label: string;
  items: NavItem[];
  currentPath: string;
}) {
  return (
    <div className="mb-4">
      <span className="block uppercase text-[11px] font-semibold text-muted-foreground tracking-widest px-4 mb-2">
        {label}
      </span>
      <nav className="flex flex-col gap-1">
        {items.map((item) => {
          const isActive = currentPath === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-2 rounded-3xl px-6 py-3 text-sm font-medium transition-colors
                ${
                  isActive
                    ? 'bg-sidebar-accent text-white'
                    : 'text-sidebar-foreground hover:text-white hover:bg-sidebar-accent'
                }
              `}
            >
              <Icon
                className={`h-5 w-5 shrink-0 ${isActive ? 'text-primary' : ''}`}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col w-64 shrink-0 bg-sidebar border-r border-sidebar-border rounded-3xl overflow-hidden">
      {/* Header: Logo */}
      <div className="p-6">
        <Image
          src="/covenant-logo-light-text.svg"
          alt="Covenant"
          width={140}
          height={32}
          priority
        />
      </div>

      {/* Navigation sections */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        <NavSection
          label="Navigation"
          items={navigationItems}
          currentPath={pathname}
        />
        <NavSection
          label="Demo"
          items={demoItems}
          currentPath={pathname}
        />
      </div>

      {/* Footer: User info */}
      <div className="flex items-center gap-3 px-6 py-4 border-t border-sidebar-border">
        <div className="flex-1 min-w-0">
          <p className="text-foreground font-semibold text-sm truncate">
            Demo User
          </p>
          <p className="text-muted-foreground text-xs truncate">
            0x1234...abcd
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="User menu"
        >
          <EllipsisVertical className="h-5 w-5" />
        </button>
      </div>
    </aside>
  );
}
