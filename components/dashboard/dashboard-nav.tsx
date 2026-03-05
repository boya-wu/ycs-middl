'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Upload, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: '首頁', icon: LayoutDashboard },
  {
    section: '請款裁決',
    links: [
      { href: '/dashboard/upload', label: '工時匯入', icon: Upload },
      { href: '/dashboard/billing', label: '裁決看板', icon: Scale },
    ],
  },
] as const;

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex w-52 flex-col gap-4 border-r border-border bg-card p-4"
      aria-label="主要導覽"
    >
      <Link
        href="/dashboard"
        className={cn(
          'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
          pathname === '/dashboard'
            ? 'bg-muted font-semibold text-foreground'
            : 'text-muted-foreground'
        )}
        aria-current={pathname === '/dashboard' ? 'page' : undefined}
      >
        <LayoutDashboard className="h-4 w-4 shrink-0" />
        首頁
      </Link>
      <div className="flex flex-col gap-1">
        <span className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          請款裁決
        </span>
        {navItems[1].links.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                isActive
                  ? 'bg-muted font-semibold text-foreground'
                  : 'text-muted-foreground'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
