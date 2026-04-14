import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import { getSession } from '@/lib/auth/session';

/**
 * Dashboard 平台層共用殼：左側導覽 + 主內容區
 * 套用至所有 /dashboard/* 路由
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <div className="flex min-h-screen">
      <DashboardNav
        sessionName={session?.name ?? null}
        sessionEmployeeNo={session?.employeeNo ?? null}
      />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
