'use client';

import { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getAllStaffProfilesFull, StaffProfileFull } from '@/actions/staff/queries';
import { importStaffProfiles, StaffImportRow } from '@/actions/staff/importStaffProfiles';
import { toast } from 'sonner';

type ExcelCell = string | number | null | undefined;

/** Excel 欄位名稱 → DB 欄位映射 */
const COLUMN_MAP: Record<string, keyof StaffImportRow> = {
  '員工姓名': 'name',
  'Email': 'email',
  'email': 'email',
  'EMAIL': 'email',
  '員工工號': 'employee_no',
  '英文姓名': 'name_en',
  '部門碼': 'department',
  '職稱': 'job_title',
  '公務手機': 'mobile_phone',
  '紅卡卡號': 'card_no',
};

interface PreviewRow extends StaffImportRow {
  /** 'new' = 系統無此 email；'update' = 將覆寫既有資料 */
  action: 'new' | 'update';
}

/** 從 ExcelCell 取得字串 */
const str = (v: ExcelCell): string =>
  v == null ? '' : String(v).trim();

export default function StaffImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [existingStaff, setExistingStaff] = useState<StaffProfileFull[]>([]);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const summary = useMemo(() => {
    const newCount = previewRows.filter((r) => r.action === 'new').length;
    return { newCount, updateCount: previewRows.length - newCount, total: previewRows.length };
  }, [previewRows]);

  /** 載入既有人員（用於比對新增 vs 更新） */
  const loadExisting = async (): Promise<StaffProfileFull[]> => {
    const res = await getAllStaffProfilesFull();
    if (!res.success || !res.data) {
      toast.error(res.error || '載入人員資料失敗');
      return [];
    }
    setExistingStaff(res.data);
    return res.data;
  };

  /** 處理 Excel 上傳 */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);

    try {
      const staff = await loadExisting();
      const emailSet = new Set(staff.map((s) => s.email.toLowerCase()));

      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, ExcelCell>>(ws, { defval: '' });

      if (!rawRows.length) {
        toast.error('Excel 無資料列');
        return;
      }

      const headers = Object.keys(rawRows[0]);
      const mapped: PreviewRow[] = [];
      const seenEmails = new Set<string>();

      for (const raw of rawRows) {
        const row: Partial<StaffImportRow> = {};
        for (const header of headers) {
          const dbKey = COLUMN_MAP[header.trim()];
          if (dbKey) {
            (row as Record<string, string>)[dbKey] = str(raw[header]);
          }
        }
        if (!row.email || !row.name) continue;

        const emailLower = row.email.toLowerCase();
        if (seenEmails.has(emailLower)) continue;
        seenEmails.add(emailLower);

        mapped.push({
          ...(row as StaffImportRow),
          action: emailSet.has(emailLower) ? 'update' : 'new',
        });
      }

      if (!mapped.length) {
        toast.error('未找到有效資料（需包含「員工姓名」與「Email」欄位）');
        return;
      }
      setPreviewRows(mapped);
      toast.success(`已解析 ${mapped.length} 筆人員資料`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知錯誤';
      toast.error(`解析失敗: ${msg}`);
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /** 確認匯入 */
  const handleImport = async () => {
    if (!previewRows.length) return;
    setIsImporting(true);
    try {
      const payload: StaffImportRow[] = previewRows.map(({ action: _, ...rest }) => rest);
      const result = await importStaffProfiles(payload);
      if (result.errors.length) {
        toast.warning(
          `匯入完成（${result.inserted} 新增, ${result.updated} 更新），但 ${result.errors.length} 筆失敗`
        );
      } else {
        toast.success(`匯入完成：${result.inserted} 筆新增、${result.updated} 筆更新`);
      }
      setPreviewRows([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '匯入失敗');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">人員名冊</h1>

      <Card>
        <CardHeader>
          <CardTitle>匯入人員名冊</CardTitle>
          <CardDescription>
            上傳公司 Excel 名冊，系統將依 Email 比對：已存在則更新、不存在則新增。
            需包含「員工姓名」與「Email」欄位。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            disabled={isLoading}
          />
          {isLoading && <p className="mt-2 text-sm text-muted-foreground">解析中...</p>}
        </CardContent>
      </Card>

      {previewRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>預覽（{summary.total} 筆）</CardTitle>
            <CardDescription>
              <Badge variant="default" className="mr-2">新增 {summary.newCount}</Badge>
              <Badge variant="secondary">更新 {summary.updateCount}</Badge>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>動作</TableHead>
                    <TableHead>姓名</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>工號</TableHead>
                    <TableHead>英文姓名</TableHead>
                    <TableHead>部門碼</TableHead>
                    <TableHead>職稱</TableHead>
                    <TableHead>公務手機</TableHead>
                    <TableHead>紅卡卡號</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        {row.action === 'new' ? (
                          <Badge variant="default">新增</Badge>
                        ) : (
                          <Badge variant="secondary">更新</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>{row.email}</TableCell>
                      <TableCell>{row.employee_no || '-'}</TableCell>
                      <TableCell>{row.name_en || '-'}</TableCell>
                      <TableCell>{row.department || '-'}</TableCell>
                      <TableCell>{row.job_title || '-'}</TableCell>
                      <TableCell>{row.mobile_phone || '-'}</TableCell>
                      <TableCell>{row.card_no || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex justify-end">
              <Button onClick={handleImport} disabled={isImporting}>
                {isImporting ? '匯入中...' : '確認匯入'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
