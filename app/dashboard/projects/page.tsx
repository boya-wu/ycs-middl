import { unstable_noStore } from 'next/cache';
import { listProjectsWithTasks } from '@/actions/projects/maintenance';
import { ProjectTaskMaintenance } from '@/components/projects/project-task-maintenance';

export const dynamic = 'force-dynamic';

/**
 * 專案（PY）與任務（SR）維護頁
 * 供管理者新增、編輯專案與任務，不支援硬刪以避免 CASCADE 刪除工時
 */
export default async function ProjectsPage() {
  unstable_noStore();

  const result = await listProjectsWithTasks();

  if (!result.success) {
    return (
      <div className="container mx-auto p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h2 className="text-lg font-semibold text-red-800">載入錯誤</h2>
          <p className="text-red-600">{'error' in result ? result.error : '載入失敗'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">專案與任務維護</h1>
        <p className="text-muted-foreground mt-1">
          管理專案（PY）與任務（SR），變更會同步至認領看板
        </p>
      </div>
      <ProjectTaskMaintenance initialProjects={result.data ?? []} />
    </div>
  );
}
