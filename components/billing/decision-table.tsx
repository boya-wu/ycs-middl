'use client';

import type { PendingBillingDecision } from '@/actions/billing/queries';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

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
  | 'md'
  | 'decision_maker_name';

const pad2 = (n: number) => String(n).padStart(2, '0');
function formatDate(date: string | Date, formatStr: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  if (formatStr === 'yyyy/MM/dd') {
    return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
  }
  if (formatStr === 'HH:mm') {
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  if (formatStr === 'yyyy/MM/dd HH:mm') {
    return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  return d.toLocaleDateString('zh-TW');
}

interface DecisionTableProps {
  data: PendingBillingDecision[];
  selectedIds: Set<string>;
  onToggleSelect: (timeRecordId: string) => void;
  onToggleSelectAll?: () => void;
  taskLabelById?: Map<string, string>;
  viewMode?: 'before' | 'after' | 'summary';
  canSelect?: boolean;
  sortKey?: SortKey;
  sortDir?: SortDir;
  onSortChange?: (key: SortKey) => void;
}

/**
 * 判斷燈號顏色
 * 🔴 紅燈：has_conflict === true
 * 🟡 黃燈：has_conflict === false && hours_worked < 2
 * 🟢 綠燈：has_conflict === false && hours_worked >= 2
 */
/** 與認領對話框邏輯一致：≥2h → 1.0 MD；0<h<2 → 0.5 MD */
function suggestedRowMd(hours: number | null | undefined): number | null {
  const h = Number(hours);
  if (!Number.isFinite(h) || h <= 0) return null;
  if (h >= 2) return 1;
  return 0.5;
}

function getStatusLight(item: PendingBillingDecision): {
  color: 'red' | 'yellow' | 'green';
  label: string;
} {
  if (item.has_conflict) {
    return { color: 'red', label: '衝突' };
  }
  if ((item.hours_worked || 0) < 2) {
    return { color: 'yellow', label: '時數不足' };
  }
  return { color: 'green', label: '正常' };
}

/**
 * 時數紀錄表格組件
 * 顯示待認領的時數紀錄，支援多選
 */
export function DecisionTable({
  data,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  taskLabelById,
  viewMode = 'before',
  canSelect = true,
  sortKey,
  sortDir,
  onSortChange,
}: DecisionTableProps) {
  if (data.length === 0) {
    const emptyMessages: Record<string, string> = {
      before: '目前沒有可認領的時數紀錄',
      after: '目前沒有已認領（可取消）的紀錄',
      summary: '目前沒有進廠紀錄',
    };
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        {emptyMessages[viewMode] ?? '目前沒有資料'}
      </div>
    );
  }

  const renderSortArrow = (key: SortKey) => {
    if (!sortKey || !sortDir) return null;
    if (sortKey !== key) return null;
    return (
      <span className="text-[10px] text-muted-foreground">
        {sortDir === 'asc' ? '▲' : '▼'}
      </span>
    );
  };

  const renderSortableHead = (label: string, key: SortKey) => {
    const isActive = sortKey === key;
    const ariaSort: 'ascending' | 'descending' | 'none' =
      isActive && sortDir ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';

    return (
      <TableHead aria-sort={ariaSort}>
        <button
          type="button"
          onClick={() => onSortChange?.(key)}
          className="inline-flex items-center gap-1 rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          title={`點選排序：${label}`}
        >
          <span className={isActive ? 'text-foreground' : undefined}>{label}</span>
          {renderSortArrow(key)}
        </button>
      </TableHead>
    );
  };

  return (
    <div className="overflow-hidden rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            {canSelect && (
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.size === data.length && data.length > 0}
                  onCheckedChange={() => onToggleSelectAll?.()}
                />
              </TableHead>
            )}
            {renderSortableHead('狀態', 'status')}
            {renderSortableHead('所屬廠區', 'factory_location')}
            {renderSortableHead('廠商編號', 'staff_employee_no')}
            {renderSortableHead('實際入廠日期時間', 'check_in_time')}
            {renderSortableHead('實際出廠日期時間', 'check_out_time')}
            {renderSortableHead('部門名稱', 'department_name')}
            {renderSortableHead('廠商姓名', 'staff_name')}
            {renderSortableHead('工作區域代號', 'work_area_code')}
            {renderSortableHead('日期', 'record_date')}
            {renderSortableHead('任務', 'task')}
            {renderSortableHead('時數', 'hours_worked')}
            {renderSortableHead('MD', 'md')}
            {(viewMode === 'after' || viewMode === 'summary') && (
              <TableHead>認領原因</TableHead>
            )}
            {(viewMode === 'after' || viewMode === 'summary') && (
              renderSortableHead('認領人員', 'decision_maker_name')
            )}
            <TableHead>備註</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => {
            const status = getStatusLight(item);
            const isSelected = selectedIds.has(item.time_record_id);
            const taskLabel = item.task_id
              ? taskLabelById?.get(item.task_id) ?? '未知任務'
              : '未認領';
            const suggestedMd = suggestedRowMd(item.hours_worked);

            return (
              <TableRow key={item.time_record_id}>
                {canSelect && (
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelect(item.time_record_id)}
                    />
                  </TableCell>
                )}
                <TableCell>
                  <Badge
                    variant={
                      status.color === 'red'
                        ? 'destructive'
                        : status.color === 'yellow'
                        ? 'default'
                        : 'default'
                    }
                    className={
                      status.color === 'green'
                        ? 'bg-green-500 hover:bg-green-600'
                        : status.color === 'yellow'
                        ? 'bg-yellow-500 hover:bg-yellow-600'
                        : ''
                    }
                  >
                    {status.color === 'red' && '🔴'}
                    {status.color === 'yellow' && '🟡'}
                    {status.color === 'green' && '🟢'} {status.label}
                  </Badge>
                </TableCell>
                <TableCell>{item.factory_location}</TableCell>
                <TableCell>{item.staff_employee_no ?? '-'}</TableCell>
                <TableCell>
                  {item.check_in_time
                    ? formatDate(item.check_in_time, 'yyyy/MM/dd HH:mm')
                    : '-'}
                </TableCell>
                <TableCell>
                  {item.check_out_time
                    ? formatDate(item.check_out_time, 'yyyy/MM/dd HH:mm')
                    : '-'}
                </TableCell>
                <TableCell>{item.department_name ?? '-'}</TableCell>
                <TableCell>{item.staff_name ?? '-'}</TableCell>
                <TableCell>{item.work_area_code ?? '-'}</TableCell>
                <TableCell>
                  {formatDate(item.record_date, 'yyyy/MM/dd')}
                </TableCell>
                <TableCell className="text-sm">{taskLabel}</TableCell>
                <TableCell>{item.hours_worked?.toFixed(2) || '0.00'}</TableCell>
                <TableCell>
                  {item.final_md != null ? (
                    item.final_md.toFixed(1)
                  ) : suggestedMd != null ? (
                    <span
                      className="text-muted-foreground"
                      title="依單筆工時推估之建議 MD；合併多筆認領時請以對話框為準，正式請款以認領為準"
                    >
                      {suggestedMd.toFixed(1)}
                    </span>
                  ) : (
                    '-'
                  )}
                </TableCell>
                {(viewMode === 'after' || viewMode === 'summary') && (
                  <TableCell className="max-w-[200px] truncate" title={item.reason ?? undefined}>
                    {item.reason ?? '-'}
                  </TableCell>
                )}
                {(viewMode === 'after' || viewMode === 'summary') && (
                  <TableCell>{item.decision_maker_name ?? '-'}</TableCell>
                )}
                <TableCell className="text-muted-foreground">
                  {item.has_conflict && '⚠️ 衝突'}
                  {item.has_decision && '✓ 已認領'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
