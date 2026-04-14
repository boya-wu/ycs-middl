'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Upload, Scale, ShieldCheck, FolderTree, Users, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { logout } from '@/actions/auth/logout';

const navSections = [
  {
    section: '請款認領',
    links: [
      { href: '/dashboard/upload', label: '工時匯入', icon: Upload },
      { href: '/dashboard/billing', label: '認領看板', icon: Scale },
    ],
  },
  {
    section: '基礎資料',
    links: [
      { href: '/dashboard/projects', label: '專案與任務', icon: FolderTree },
      { href: '/dashboard/staff', label: '人員名冊', icon: Users },
    ],
  },
  {
    section: '進廠管理',
    links: [
      { href: '/dashboard/pip', label: 'PIP 自我檢查', icon: ShieldCheck },
    ],
  },
] as const;

interface DashboardNavProps {
  sessionName: string | null;
  sessionEmployeeNo: string | null;
}

export function DashboardNav({ sessionName, sessionEmployeeNo }: DashboardNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className="flex w-52 flex-col border-r border-border bg-card p-4"
      aria-label="主要導覽"
    >
      <div className="flex flex-1 flex-col gap-4">
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
        {navSections.map(({ section, links }) => (
          <div key={section} className="flex flex-col gap-1">
            <span className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {section}
            </span>
            {links.map(({ href, label, icon: Icon }) => {
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
        ))}
      </div>

      {sessionName && (
        <div className="border-t border-border pt-4">
          <div className="mb-2 px-3">
            <p className="truncate text-sm font-medium">{sessionName}</p>
            {sessionEmployeeNo && (
              <p className="truncate text-xs text-muted-foreground">{sessionEmployeeNo}</p>
            )}
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              登出
            </button>
          </form>
        </div>
      )}
    </nav>
  );
}
