'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@civic/auth/react';
import { HugeiconsIcon } from '@hugeicons/react';
import type { IconSvgElement } from '@hugeicons/react';
import {
  DashboardSquare01Icon,
  RoboticIcon,
  ChartRelationshipIcon,
  AffiliateIcon,
  PlayIcon,
  Shield01Icon,
  RocketIcon,
} from '@hugeicons/core-free-icons';

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
      <span className="block uppercase text-[11px] font-semibold text-muted-foreground tracking-widest px-4 mb-2">
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
                flex items-center gap-2 rounded-3xl px-6 py-3 text-sm font-medium transition-colors
                ${
                  isActive
                    ? 'bg-sidebar-accent text-white'
                    : 'text-sidebar-foreground hover:text-white hover:bg-sidebar-accent'
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
        <NavSection
          label="Actions"
          items={actionItems}
          currentPath={pathname}
        />
      </div>

      {/* Footer: Auth */}
      <div className="px-6 py-4 border-t border-sidebar-border">
        <UserButton />
      </div>
    </aside>
  );
}
