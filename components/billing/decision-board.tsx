'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ClaimableTask, PendingBillingDecision } from '@/actions/billing/queries';
import { createBillingDecision } from '@/actions/billing/decisions';
import { DecisionTable } from './decision-table';
import { DecisionDialog } from './decision-dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface BillingDecisionBoardProps {
  initialData: PendingBillingDecision[];
  /** 已裁決紀錄（來自 decided_billing_decisions_summary），用於裁決後分頁與總表 */
  initialDecidedData?: PendingBillingDecision[];
  taskOptions: ClaimableTask[];
}

/** 以 time_record_id 去重，避免 view/API 回傳重複列時在切換總筆數/待裁決時堆疊 */
function dedupePendingById(list: PendingBillingDecision[]): PendingBillingDecision[] {
  const seen = new Set<string>();
  return list.filter((row) => {
    if (seen.has(row.time_record_id)) return false;
    seen.add(row.time_record_id);
    return true;
  });
}

/**
 * 請款裁決看板主組件
 * 管理選中的時數紀錄，處理裁決流程
 */
export function BillingDecisionBoard({
  initialData,
  initialDecidedData = [],
  taskOptions,
}: BillingDecisionBoardProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [data, setData] = useState(() => dedupePendingById(initialData));
  const [decidedData, setDecidedData] = useState(() =>
    dedupePendingById(initialDecidedData)
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  /** 裁決前＝可裁決 | 裁決後＝可取消裁決 | 總表＝純顯示 */
  const [viewMode, setViewMode] = useState<'before' | 'after' | 'summary'>('before');

  useEffect(() => {
    setData(dedupePendingById(initialData));
  }, [initialData]);
  useEffect(() => {
    setDecidedData(dedupePendingById(initialDecidedData));
  }, [initialDecidedData]);

  const taskLabelById = useMemo(() => {
    const map = new Map<string, string>();
    taskOptions.forEach((task) => {
      if (!task.project) return;
      map.set(task.id, `${task.project.code}-${task.code}`);
    });
    return map;
  }, [taskOptions]);

  const beforeData = useMemo(
    () => data.filter((item) => !item.has_decision),
    [data]
  );
  const afterData = useMemo(() => decidedData, [decidedData]);
  const summaryData = useMemo(() => {
    const byId = new Map<string, PendingBillingDecision>();
    data.forEach((r) => byId.set(r.time_record_id, r));
    decidedData.forEach((r) => byId.set(r.time_record_id, r));
    return Array.from(byId.values()).sort((a, b) => {
      const d = (b.record_date || '').localeCompare(a.record_date || '');
      if (d !== 0) return d;
      return (b.check_in_time || '').localeCompare(a.check_in_time || '');
    });
  }, [data, decidedData]);

  const visibleData = useMemo(() => {
    if (viewMode === 'before') return beforeData;
    if (viewMode === 'after') return afterData;
    return summaryData;
  }, [viewMode, beforeData, afterData, summaryData]);

  const canSelect = viewMode !== 'summary';
  const canConfirmDecision = viewMode === 'before';
  const canCancelDecision = viewMode === 'after';

  // 計算選中項目的總時數與建議 MD（裁決前用 visibleData 的選取，裁決後用 afterData）
  const selectedSummary = useMemo(() => {
    const source = viewMode === 'before' ? data : viewMode === 'after' ? decidedData : [];
    const selected = source.filter((item) => selectedIds.has(item.time_record_id));
    const totalHours = selected.reduce((sum, item) => sum + (item.hours_worked || 0), 0);
    const recommendedMd =
      totalHours >= 2 ? 1.0 : totalHours > 0 ? 0.5 : 0;
    const hasConflict = selected.some((item) => item.has_conflict);

    return {
      totalHours,
      recommendedMd,
      hasConflict,
      count: selected.length,
    };
  }, [selectedIds, viewMode, data, decidedData]);

  // 處理勾選狀態
  const handleToggleSelect = (timeRecordId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(timeRecordId)) {
      newSelected.delete(timeRecordId);
    } else {
      newSelected.add(timeRecordId);
    }
    setSelectedIds(newSelected);
  };

  // 處理全選/取消全選（總表模式不選）
  const handleToggleSelectAll = () => {
    if (!canSelect) return;
    if (selectedIds.size === visibleData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleData.map((item) => item.time_record_id)));
    }
  };

  // 重新整理資料（同時拉取待裁決與已裁決）
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      router.refresh();
      const [pendingRes, decidedRes] = await Promise.all([
        fetch('/api/billing/pending', { cache: 'no-store' }),
        fetch('/api/billing/decided', { cache: 'no-store' }),
      ]);
      if (pendingRes.ok) {
        const r = await pendingRes.json();
        if (r.success) setData(dedupePendingById(r.data || []));
      }
      if (decidedRes.ok) {
        const r = await decidedRes.json();
        if (r.success) setDecidedData(dedupePendingById(r.data || []));
      }
    } catch (error) {
      toast.error('重新整理失敗');
    } finally {
      setIsRefreshing(false);
    }
  };

  // 處理裁決確認
  const handleConfirmDecision = async (
    finalMd: number,
    reason: string,
    taskId: string
  ) => {
    if (selectedIds.size === 0) {
      toast.error('請至少選擇一筆時數紀錄');
      return;
    }
    if (!taskId) {
      toast.error('請先選擇專案任務');
      return;
    }

    const timeRecordIds = Array.from(selectedIds);
    const hasConflict = selectedSummary.hasConflict;

    try {
      const result = await createBillingDecision({
        time_record_ids: timeRecordIds,
        task_id: taskId,
        decision_type: hasConflict ? 'conflict_resolved' : 'merged_records',
        final_md: finalMd,
        recommended_md: selectedSummary.recommendedMd,
        reason: reason || 'PM 裁決',
        has_conflict: hasConflict,
        is_conflict_resolved: hasConflict,
        is_billable: true,
      });

      if (result.success) {
        toast.success('裁決成功建立');
        setSelectedIds(new Set());
        setIsDialogOpen(false);
        // 重新整理資料
        router.refresh();
        await handleRefresh();
      } else {
        toast.error(result.error || '裁決失敗');
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof (error as { message?: string })?.message === 'string'
            ? (error as { message: string }).message
            : '裁決時發生錯誤';
      toast.error(message);
      console.error(error);
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* 操作列 */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            {canSelect ? (
              <>
                已選擇 {selectedIds.size} 筆紀錄
                {selectedIds.size > 0 && canConfirmDecision && (
                  <span className="ml-2">
                    • 總時數: {selectedSummary.totalHours.toFixed(2)} 小時
                    • 建議 MD: {selectedSummary.recommendedMd}
                  </span>
                )}
              </>
            ) : (
              '總表為唯讀，不支援勾選與裁決操作'
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={viewMode === 'before' ? 'default' : 'outline'}
              onClick={() => {
                setViewMode('before');
                setSelectedIds(new Set());
              }}
            >
              裁決前 ({beforeData.length})
            </Button>
            <Button
              variant={viewMode === 'after' ? 'default' : 'outline'}
              onClick={() => {
                setViewMode('after');
                setSelectedIds(new Set());
              }}
            >
              裁決後 ({afterData.length})
            </Button>
            <Button
              variant={viewMode === 'summary' ? 'default' : 'outline'}
              onClick={() => {
                setViewMode('summary');
                setSelectedIds(new Set());
              }}
            >
              總表 ({summaryData.length})
            </Button>
            {canSelect && (
              <Button
                variant="outline"
                onClick={handleToggleSelectAll}
                disabled={visibleData.length === 0}
              >
                {selectedIds.size === visibleData.length ? '取消全選' : '全選'}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? '重新整理中...' : '重新整理'}
            </Button>
            {canConfirmDecision && (
              <Button
                onClick={() => setIsDialogOpen(true)}
                disabled={selectedIds.size === 0}
              >
                確認裁決
              </Button>
            )}
            {canCancelDecision && (
              <Button
                variant="outline"
                onClick={() => toast.info('取消裁決功能開發中')}
                disabled={selectedIds.size === 0}
              >
                取消裁決
              </Button>
            )}
          </div>
        </div>

        {/* 資料表格 */}
        <DecisionTable
          data={visibleData}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onToggleSelectAll={handleToggleSelectAll}
          taskLabelById={taskLabelById}
          viewMode={viewMode}
          canSelect={canSelect}
        />
      </div>

      {/* 裁決確認對話框 */}
      <DecisionDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        selectedSummary={selectedSummary}
        onConfirm={handleConfirmDecision}
        taskOptions={taskOptions}
      />
    </>
  );
}
