'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ClaimableTask, PendingBillingDecision } from '@/actions/billing/queries';
import { createBillingDecision } from '@/actions/billing/decisions';
import { DecisionTable } from './decision-table';
import { DecisionDialog } from './decision-dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface BillingDecisionBoardProps {
  initialData: PendingBillingDecision[];
  /** 已認領紀錄（來自 decided_billing_decisions_summary），用於認領後分頁與總表 */
  initialDecidedData?: PendingBillingDecision[];
  taskOptions: ClaimableTask[];
}

/** 以 time_record_id 去重，避免 view/API 回傳重複列時在切換總筆數/待認領時堆疊 */
function dedupePendingById(list: PendingBillingDecision[]): PendingBillingDecision[] {
  const seen = new Set<string>();
  return list.filter((row) => {
    if (seen.has(row.time_record_id)) return false;
    seen.add(row.time_record_id);
    return true;
  });
}

type SortDir = 'asc' | 'desc';
type SortKey =
  | 'status'
  | 'factory_location'
  | 'staff_employee_no'
  | 'check_in_time'
  | 'check_out_time'
  | 'department_name'
  | 'staff_name'
  | 'work_area_code'
  | 'record_date'
  | 'task'
  | 'hours_worked'
  | 'md';

function toTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  return s ? s : null;
}

function suggestedRowMd(hours: number | null | undefined): number | null {
  const h = Number(hours);
  if (!Number.isFinite(h) || h <= 0) return null;
  if (h >= 2) return 1;
  return 0.5;
}

function statusRank(item: PendingBillingDecision): number {
  if (item.has_conflict) return 0; // red
  if ((item.hours_worked || 0) < 2) return 1; // yellow
  return 2; // green
}

function getSortValue(
  row: PendingBillingDecision,
  key: SortKey,
  taskLabelById: Map<string, string>
): string | number | null {
  switch (key) {
    case 'status':
      return statusRank(row);
    case 'factory_location':
      return normalizeString(row.factory_location);
    case 'staff_employee_no':
      return normalizeString(row.staff_employee_no);
    case 'check_in_time':
      return toTimestamp(row.check_in_time);
    case 'check_out_time':
      return toTimestamp(row.check_out_time);
    case 'department_name':
      return normalizeString(row.department_name);
    case 'staff_name':
      return normalizeString(row.staff_name);
    case 'work_area_code':
      return normalizeString(row.work_area_code);
    case 'record_date':
      return toTimestamp(row.record_date);
    case 'task': {
      if (!row.task_id) return '未認領';
      return taskLabelById.get(row.task_id) ?? '未知任務';
    }
    case 'hours_worked': {
      const h = Number(row.hours_worked);
      return Number.isFinite(h) ? h : null;
    }
    case 'md': {
      if (row.final_md != null) return row.final_md;
      return suggestedRowMd(row.hours_worked);
    }
    default:
      return null;
  }
}

function compareSortValues(
  a: string | number | null,
  b: string | number | null
): number {
  const aEmpty = a == null || a === '';
  const bEmpty = b == null || b === '';
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1; // empty always last
  if (bEmpty) return -1;

  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  return String(a).localeCompare(String(b), 'zh-Hant');
}

/**
 * 請款認領看板主組件
 * 管理選中的時數紀錄，處理認領流程
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
  /** 認領前＝可認領 | 認領後＝可取消認領 | 總表＝純顯示 */
  const [viewMode, setViewMode] = useState<'before' | 'after' | 'summary'>('before');
  const [sortKey, setSortKey] = useState<SortKey>('record_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

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

  const sortedVisibleData = useMemo(() => {
    const indexed = visibleData.map((row, idx) => ({ row, idx }));
    indexed.sort((a, b) => {
      const av = getSortValue(a.row, sortKey, taskLabelById);
      const bv = getSortValue(b.row, sortKey, taskLabelById);
      const base = compareSortValues(av, bv);
      const directed = sortDir === 'asc' ? base : -base;
      if (directed !== 0) return directed;
      return a.idx - b.idx;
    });
    return indexed.map((x) => x.row);
  }, [visibleData, sortKey, sortDir, taskLabelById]);

  const handleSortChange = (nextKey: SortKey) => {
    setSortKey((prevKey) => {
      if (prevKey !== nextKey) {
        setSortDir('asc');
        return nextKey;
      }
      setSortDir((prevDir) => (prevDir === 'asc' ? 'desc' : 'asc'));
      return prevKey;
    });
  };

  const canSelect = viewMode !== 'summary';
  const canConfirmDecision = viewMode === 'before';
  const canCancelDecision = viewMode === 'after';

  // 計算選中項目的總時數與建議 MD（認領前用 visibleData 的選取，認領後用 afterData）
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
    if (selectedIds.size === sortedVisibleData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedVisibleData.map((item) => item.time_record_id)));
    }
  };

  // 重新整理資料（同時拉取待認領與已認領），用 useCallback 穩定參考供 visibility/pageshow 依賴
  const handleRefresh = useCallback(async () => {
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
  }, [router]);

  // 從其他分頁回到本頁（例如在 Supabase 後台清空 DB 後）自動重拉，避免畫面卡在舊資料
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') handleRefresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [handleRefresh]);

  // 從 bfcache 還原時重拉資料，避免「回到上一頁」仍顯示舊狀態
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) handleRefresh();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [handleRefresh]);

  // 處理認領確認
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
        reason: reason || 'PM 認領',
        has_conflict: hasConflict,
        is_conflict_resolved: hasConflict,
        is_billable: true,
      });

      if (result.success) {
        toast.success('認領成功建立');
        setSelectedIds(new Set());
        setIsDialogOpen(false);
        // 重新整理資料
        router.refresh();
        await handleRefresh();
      } else {
        toast.error(result.error || '認領失敗');
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof (error as { message?: string })?.message === 'string'
            ? (error as { message: string }).message
            : '認領時發生錯誤';
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
              '總表為唯讀，不支援勾選與認領操作'
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
              認領前 ({beforeData.length})
            </Button>
            <Button
              variant={viewMode === 'after' ? 'default' : 'outline'}
              onClick={() => {
                setViewMode('after');
                setSelectedIds(new Set());
              }}
            >
              認領後 ({afterData.length})
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
                disabled={sortedVisibleData.length === 0}
              >
                {selectedIds.size === sortedVisibleData.length ? '取消全選' : '全選'}
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
                確認認領
              </Button>
            )}
            {canCancelDecision && (
              <Button
                variant="outline"
                onClick={() => toast.info('取消認領功能開發中')}
                disabled={selectedIds.size === 0}
              >
                取消認領
              </Button>
            )}
          </div>
        </div>

        {/* 資料表格 */}
        <DecisionTable
          data={sortedVisibleData}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onToggleSelectAll={handleToggleSelectAll}
          taskLabelById={taskLabelById}
          viewMode={viewMode}
          canSelect={canSelect}
          sortKey={sortKey}
          sortDir={sortDir}
          onSortChange={handleSortChange}
        />
      </div>

      {/* 認領確認對話框 */}
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
