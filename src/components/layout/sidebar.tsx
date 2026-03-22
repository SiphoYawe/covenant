'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { HugeiconsIcon } from '@hugeicons/react';
import type { IconSvgElement } from '@hugeicons/react';
import {
  DashboardSquare01Icon,
  RoboticIcon,
  ChartRelationshipIcon,
  AffiliateIcon,
  Activity01Icon,
  PlayIcon,
  Shield01Icon,
  RocketIcon,
} from '@hugeicons/core-free-icons';

const UserButton = dynamic(
  () => import('@civic/auth-web3/react').then((m) => ({ default: m.UserButton })),
  { ssr: false },
);

interface NavItem {
  label: string;
  href: string;
  icon: IconSvgElement;
}

const navigationItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: DashboardSquare01Icon },
  { label: 'Agents', href: '/agents', icon: RoboticIcon },
  { label: 'Trust Graph', href: '/trust-graph', icon: ChartRelationshipIcon },
  { label: 'Payments', href: '/payments', icon: AffiliateIcon },
  { label: 'Activity', href: '/activity', icon: Activity01Icon },
];

const demoItems: NavItem[] = [
  { label: 'Run Demo', href: '/demo', icon: PlayIcon },
  { label: 'Civic Guards', href: '/civic-guards', icon: Shield01Icon },
];

const actionItems: NavItem[] = [
  { label: 'Deploy Agent', href: '/deploy', icon: RocketIcon },
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
      <span className="block uppercase text-xs font-medium text-muted-foreground/60 tracking-wider px-4 mb-1.5">
        {label}
      </span>
      <nav className="flex flex-col gap-1">
        {items.map((item) => {
          const isActive = currentPath === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-150
                ${
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:text-foreground hover:bg-white/[0.04]'
                }
              `}
            >
              <HugeiconsIcon
                icon={item.icon}
                size={20}
                className={`shrink-0 ${isActive ? 'text-primary' : ''}`}
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
    <aside className="flex flex-col w-60 shrink-0 bg-sidebar border-r border-sidebar-border overflow-visible">
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
        <NavSection
          label="Actions"
          items={actionItems}
          currentPath={pathname}
        />
      </div>

      {/* User Auth */}
      <div className="px-4 py-3 border-t border-sidebar-border relative">
        <UserButton />
      </div>
    </aside>
  );
}
