import { DashboardNav } from '@/components/dashboard/dashboard-nav';

/**
 * Dashboard 平台層共用殼：左側導覽 + 主內容區
 * 套用至所有 /dashboard/* 路由
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <DashboardNav />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
