import { unstable_noStore } from 'next/cache';
import {
  getClaimableTasks,
  getDecidedBillingDecisions,
  getPendingBillingDecisions,
} from '@/actions/billing/queries';
import { BillingDecisionBoard } from '@/components/billing/decision-board';

/** 避免快取導致認領看板顯示舊/空資料 */
export const dynamic = 'force-dynamic';

/**
 * 請款認領看板頁面
 * PM 使用的請款認領介面，顯示待認領／已認領的時數紀錄並允許進行認領或取消認領
 */
export default async function BillingDashboardPage() {
  unstable_noStore();
  const [pendingResult, decidedResult, taskResult] = await Promise.all([
    getPendingBillingDecisions(),
    getDecidedBillingDecisions(),
    getClaimableTasks(),
  ]);

  if (!pendingResult.success || !taskResult.success) {
    return (
      <div className="container mx-auto p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h2 className="text-lg font-semibold text-red-800">載入錯誤</h2>
          <p className="text-red-600">
            {pendingResult.error || taskResult.error || '載入失敗'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">請款認領看板</h1>
        <p className="text-muted-foreground mt-1">
          檢視待認領的時數紀錄，進行合併認領
        </p>
      </div>
      <BillingDecisionBoard
        initialData={pendingResult.data || []}
        initialDecidedData={decidedResult.success ? decidedResult.data || [] : []}
        taskOptions={taskResult.data || []}
      />
    </div>
  );
}
