'use client';

import { useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { getAllStaffProfiles } from '@/actions/upload/queries';
import { importTimeRecords, ImportTimeRecord } from '@/actions/upload/import';
import { IMPORT_MIN_DURATION_MINUTES } from '@/lib/import-duration';
import {
  createStaffProfile,
  ensureStaffProfileFromAuthUser,
} from '@/actions/staff/createStaffProfile';
import { toast } from 'sonner';

type ExcelCell = string | number | Date | null | undefined;

const REQUIRED_HEADER_DEFINITIONS = [
  { key: '姓名', keywords: ['廠商姓名', '廠商名稱', '姓名', '執行人員'] },
  { key: '日期', keywords: ['日期', 'date'] },
  { key: '廠區', keywords: ['廠區', '場區', '所屬廠區', 'location'] },
  {
    key: '進場時間',
    keywords: [
      '進場時間',
      '進場',
      '入廠時間',
      '入廠',
      '實際入廠時間',
      '實際入廠日期時間',
      '入廠日期時間',
      'start time',
      'starttime',
    ],
  },
  {
    key: '出場時間',
    keywords: [
      '出場時間',
      '出場',
      '出廠時間',
      '出廠',
      '實際出廠時間',
      '實際出廠日期時間',
      '出廠日期時間',
      'end time',
      'endtime',
    ],
  },
] as const;

type RequiredHeaderKey = (typeof REQUIRED_HEADER_DEFINITIONS)[number]['key'];

/** 選填欄位：對應後寫入 time_records 快照，供認領看板顯示 */
const OPTIONAL_HEADER_DEFINITIONS = [
  { key: '廠商編號' as const, keywords: ['廠商編號', 'vendor no', 'vendorno', '供應商編號'] },
  { key: '部門名稱' as const, keywords: ['部門名稱', '部門', 'department', 'dept'] },
  {
    key: '工作區域代號' as const,
    keywords: ['工作區域代號', '工作區域', '區域代號', 'work area code', 'work_area_code'],
  },
] as const;

type OptionalHeaderKey = (typeof OPTIONAL_HEADER_DEFINITIONS)[number]['key'];

const normalizeHeader = (value: string) =>
  value.replace(/\s+/g, '').trim().toLowerCase();

const buildHeaderMap = (headers: string[]) => {
  const normalizedHeaders = headers.map((header) => ({
    raw: header,
    normalized: normalizeHeader(header),
  }));
  const map: Partial<Record<RequiredHeaderKey, string>> = {};

  for (const definition of REQUIRED_HEADER_DEFINITIONS) {
    const keywords = definition.keywords.map((keyword) => normalizeHeader(keyword));
    const exactMatch = normalizedHeaders.find((header) =>
      keywords.includes(header.normalized)
    );
    const fuzzyMatch =
      exactMatch ||
      normalizedHeaders.find((header) =>
        keywords.some((keyword) => header.normalized.includes(keyword))
      );

    if (fuzzyMatch) {
      map[definition.key] = fuzzyMatch.raw;
    }
  }

  const missing = REQUIRED_HEADER_DEFINITIONS
    .map((definition) => definition.key)
    .filter((key) => !map[key]);

  return { map, missing };
};

const getCellValue = (row: Record<string, ExcelCell>, key?: string): ExcelCell =>
  key ? row[key] : undefined;

const buildHeaderSignature = (headers: string[]) =>
  headers.map((header) => normalizeHeader(header)).sort().join('|');

const loadStoredHeaderMap = (
  signature: string,
  headers: string[]
): Partial<Record<RequiredHeaderKey, string>> | null => {
  try {
    const raw = localStorage.getItem(`upload-header-map:${signature}`);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<Record<RequiredHeaderKey, string>>;
    const headerSet = new Set(headers);
    const cleaned: Partial<Record<RequiredHeaderKey, string>> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value && headerSet.has(value)) {
        cleaned[key as RequiredHeaderKey] = value;
      }
    }
    return cleaned;
  } catch {
    return null;
  }
};

const persistHeaderMap = (
  signature: string,
  map: Partial<Record<RequiredHeaderKey, string>>
) => {
  try {
    localStorage.setItem(`upload-header-map:${signature}`, JSON.stringify(map));
  } catch {
    // 忽略 localStorage 失敗
  }
};

const buildOptionalHeaderMap = (headers: string[]) => {
  const normalizedHeaders = headers.map((header) => ({
    raw: header,
    normalized: normalizeHeader(header),
  }));
  const map: Partial<Record<OptionalHeaderKey, string>> = {};

  for (const definition of OPTIONAL_HEADER_DEFINITIONS) {
    const keywords = definition.keywords.map((keyword) => normalizeHeader(keyword));
    const exactMatch = normalizedHeaders.find((header) =>
      keywords.includes(header.normalized)
    );
    const fuzzyMatch =
      exactMatch ||
      normalizedHeaders.find((header) =>
        keywords.some((keyword) => header.normalized.includes(keyword))
      );

    if (fuzzyMatch) {
      map[definition.key] = fuzzyMatch.raw;
    }
  }

  return map;
};

const loadStoredOptionalHeaderMap = (
  signature: string,
  headers: string[]
): Partial<Record<OptionalHeaderKey, string>> | null => {
  try {
    const raw = localStorage.getItem(`upload-optional-header-map:${signature}`);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<Record<OptionalHeaderKey, string>>;
    const headerSet = new Set(headers);
    const cleaned: Partial<Record<OptionalHeaderKey, string>> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value && headerSet.has(value)) {
        cleaned[key as OptionalHeaderKey] = value;
      }
    }
    return cleaned;
  } catch {
    return null;
  }
};

const persistOptionalHeaderMap = (
  signature: string,
  map: Partial<Record<OptionalHeaderKey, string>>
) => {
  try {
    localStorage.setItem(`upload-optional-header-map:${signature}`, JSON.stringify(map));
  } catch {
    // 忽略 localStorage 失敗
  }
};

const getMissingRequiredKeys = (
  map: Partial<Record<RequiredHeaderKey, string>>
) => {
  const missing = REQUIRED_HEADER_DEFINITIONS.map((definition) => definition.key).filter(
    (key) => !map[key]
  );
  return missing.filter((key) => {
    if (key === '出場時間') {
      return false;
    }
    if (key === '日期') {
      return !map.進場時間;
    }
    return true;
  });
};

/**
 * Excel 解析後的原始資料型別（僅人員、日期、廠區、進出場時間；不含 PY/SR）
 */
interface ParsedExcelRow {
  姓名: ExcelCell;
  日期: ExcelCell;
  廠區: ExcelCell;
  工作區域代號?: ExcelCell;
  進場時間: ExcelCell;
  出場時間: ExcelCell;
  廠商編號?: ExcelCell;
  部門名稱?: ExcelCell;
}

/**
 * 預覽表格的資料型別（含匹配狀態；匯入後 task_id 一律為 NULL，於認領階段指派）
 */
interface PreviewRow extends ParsedExcelRow {
  matchedStaffId: string | null;
  matchedStaffName: string | null;
  matchStatus: 'matched' | 'unmatched' | 'manual';
}

const buildPreviewRows = (
  rows: Record<string, ExcelCell>[],
  map: Partial<Record<RequiredHeaderKey, string>>,
  optionalMap: Partial<Record<OptionalHeaderKey, string>>,
  staffList: Array<{ id: string; name: string }>,
  matcher: (
    excelName: ExcelCell,
    list: Array<{ id: string; name: string }>
  ) => { id: string; name: string } | null
): PreviewRow[] =>
  rows.map((row) => {
    const mappedRow: ParsedExcelRow = {
      姓名: getCellValue(row, map.姓名),
      日期: getCellValue(row, map.日期) ?? getCellValue(row, map.進場時間),
      廠區: getCellValue(row, map.廠區),
      進場時間: getCellValue(row, map.進場時間),
      出場時間: getCellValue(row, map.出場時間),
    };
    if (optionalMap.廠商編號) {
      mappedRow.廠商編號 = getCellValue(row, optionalMap.廠商編號);
    }
    if (optionalMap.部門名稱) {
      mappedRow.部門名稱 = getCellValue(row, optionalMap.部門名稱);
    }
    if (optionalMap.工作區域代號) {
      mappedRow.工作區域代號 = getCellValue(row, optionalMap.工作區域代號);
    }
    const matched = matcher(mappedRow.姓名, staffList);
    return {
      ...mappedRow,
      matchedStaffId: matched?.id || null,
      matchedStaffName: matched?.name || null,
      matchStatus: matched ? 'matched' : 'unmatched',
    };
  });

/** 未匹配列內嵌的「建立人員」Popover（新建帳號 or 連結既有 auth 帳號，不導頁） */
function CreateStaffPopoverInRow({
  rowIndex,
  excelName,
  open,
  onOpenChange,
  onSuccess,
}: {
  rowIndex: number;
  excelName: ExcelCell;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (excelName: ExcelCell, staffId: string, staffName: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [employeeNo, setEmployeeNo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** 'create' = 新建 auth + staff；'link' = 僅連結既有 auth 建立 staff */
  const [mode, setMode] = useState<'create' | 'link'>('create');
  const displayName =
    typeof excelName === 'string' ? excelName.trim() : String(excelName ?? '');

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error('請輸入 Email');
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await createStaffProfile({
        name: displayName || trimmedEmail,
        email: trimmedEmail,
        employeeNo: employeeNo.trim() || undefined,
      });
      if (!result.success) {
        toast.error(result.error ?? '建立人員失敗');
        return;
      }
      if (result.data) {
        onSuccess(excelName, result.data.id, result.data.name);
        toast.success(`已建立人員：${result.data.name}`);
        setEmail('');
        setEmployeeNo('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error('請輸入 Email');
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await ensureStaffProfileFromAuthUser({
        name: displayName || trimmedEmail,
        email: trimmedEmail,
        employeeNo: employeeNo.trim() || undefined,
      });
      if (!result.success) {
        toast.error(result.error ?? '連結失敗');
        return;
      }
      if (result.data) {
        onSuccess(excelName, result.data.id, result.data.name);
        toast.success(`已連結人員：${result.data.name}`);
        setEmail('');
        setEmployeeNo('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLink = mode === 'link';

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          建立人員
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start" side="right">
        <PopoverHeader>
          <PopoverTitle>建立人員：{displayName || '(未填姓名)'}</PopoverTitle>
        </PopoverHeader>
        <form
          onSubmit={isLink ? handleSubmitLink : handleSubmitCreate}
          className="mt-3 space-y-3"
        >
          <div>
            <Label htmlFor={`create-email-${rowIndex}`}>Email（必填）</Label>
            <Input
              id={`create-email-${rowIndex}`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor={`create-employee-no-${rowIndex}`}>工號（選填）</Label>
            <Input
              id={`create-employee-no-${rowIndex}`}
              type="text"
              value={employeeNo}
              onChange={(e) => setEmployeeNo(e.target.value)}
              placeholder="選填"
              className="mt-1"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setMode(isLink ? 'create' : 'link')}
            >
              {isLink ? '改為新建帳號' : '已有帳號？連結既有帳號'}
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                取消
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting
                  ? '處理中...'
                  : isLink
                    ? '連結'
                    : '確認'}
              </Button>
            </div>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Excel 匯入頁面
 */
export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [staffProfiles, setStaffProfiles] = useState<Array<{ id: string; name: string }>>([]);
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, ExcelCell>[]>([]);
  const [availableHeaders, setAvailableHeaders] = useState<string[]>([]);
  const [headerMap, setHeaderMap] = useState<Partial<Record<RequiredHeaderKey, string>>>({});
  const [optionalHeaderMap, setOptionalHeaderMap] = useState<
    Partial<Record<OptionalHeaderKey, string>>
  >({});
  const [headerSignature, setHeaderSignature] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  /** 匯入 session：同一匯入流程內，姓名 → 已匹配的 staff（建立人員後同步同名稱所有行，不寫入 DB） */
  const [importSessionState, setImportSessionState] = useState<
    Record<string, { staffId: string; staffName: string }>
  >({});
  /** 僅顯示未匹配人員（表格過濾） */
  const [showUnmatchedOnly, setShowUnmatchedOnly] = useState(false);
  /** 僅顯示將與其他列合併為同一邏輯工時的列（跨廠區／代號，logical key 相同） */
  const [showMergeCandidatesOnly, setShowMergeCandidatesOnly] = useState(false);
  /** 摘要區批次建立：每個未匹配姓名 key → { email, employeeNo }，直接顯示欄位一次填完再批次建立 */
  const [batchCreateForm, setBatchCreateForm] = useState<
    Record<string, { email: string; employeeNo: string }>
  >({});
  /** 批次建立中（按鈕 disabled） */
  const [isBatchCreating, setIsBatchCreating] = useState(false);

  /** 載入員工資料；失敗時回傳 { success: false } 以便上傳流程不繼續、不顯示預覽 */
  const loadStaffProfiles = async (): Promise<
    { success: true; data: Array<{ id: string; name: string }> } | { success: false }
  > => {
    const result = await getAllStaffProfiles();
    if (result.success && result.data) {
      setStaffProfiles(result.data);
      return { success: true, data: result.data };
    }
    toast.error('載入員工資料失敗');
    return { success: false };
  };

  // 姓名匹配邏輯（自動比對）
  const matchStaffName = (
    excelName: ExcelCell,
    staffList: Array<{ id: string; name: string }>
  ): { id: string; name: string } | null => {
    if (typeof excelName !== 'string') {
      return null;
    }
    const trimmedName = excelName.trim();
    if (!trimmedName) {
      return null;
    }
    // 移除空格並轉小寫進行比對
    const normalizedExcelName = trimmedName.toLowerCase();

    // 完全匹配
    const exactMatch = staffList.find(
      (staff) => staff.name.trim().toLowerCase() === normalizedExcelName
    );
    if (exactMatch) return exactMatch;

    // 部分匹配（Excel 名稱包含在 staff 名稱中，或相反）
    const partialMatch = staffList.find((staff) => {
      const normalizedStaffName = staff.name.trim().toLowerCase();
      return (
        normalizedStaffName.includes(normalizedExcelName) ||
        normalizedExcelName.includes(normalizedStaffName)
      );
    });
    if (partialMatch) return partialMatch;

    return null;
  };

  // 處理 Excel 檔案上傳
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);

    try {
      // 載入員工資料；失敗則不繼續，避免先顯示失敗又載入內容
      const staffResult = await loadStaffProfiles();
      if (!staffResult.success) {
        setIsLoading(false);
        return;
      }
      const staffList = staffResult.data;

      // 讀取 Excel
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, ExcelCell>>(firstSheet, {
        defval: null,
      });

      if (jsonData.length === 0) {
        toast.error('Excel 檔案為空');
        setIsLoading(false);
        return;
      }

      const headers = Object.keys(jsonData[0] ?? {});
      const { map } = buildHeaderMap(headers);
      const signature = buildHeaderSignature(headers);
      const storedMap = loadStoredHeaderMap(signature, headers);
      const resolvedMap = {
        ...map,
        ...(storedMap || {}),
      };

      const optionalAuto = buildOptionalHeaderMap(headers);
      const storedOptional = loadStoredOptionalHeaderMap(signature, headers);
      const resolvedOptional = {
        ...optionalAuto,
        ...(storedOptional || {}),
      };

      setAvailableHeaders(headers);
      setRawRows(jsonData);
      setHeaderMap(resolvedMap);
      setOptionalHeaderMap(resolvedOptional);
      setHeaderSignature(signature);
      setImportSessionState({});
      setCreateStaffPopoverIndex(null);
      setBatchCreateForm({});

      const previewRows = buildPreviewRows(
        jsonData,
        resolvedMap,
        resolvedOptional,
        staffList,
        matchStaffName
      );
      setPreviewData(previewRows);

      const missingRequired = getMissingRequiredKeys(resolvedMap);
      if (missingRequired.length > 0) {
        toast.warning(`請於下方欄位對應完成：${missingRequired.join('、')}`);
      } else {
        toast.success(`已解析 ${previewRows.length} 筆資料`);
      }
    } catch (error) {
      console.error('解析 Excel 失敗:', error);
      const message = error instanceof Error ? error.message : '';
      toast.error(message ? `資料格式解析錯誤: ${message}` : '資料格式解析錯誤');
    } finally {
      setIsLoading(false);
    }
  };

  const handleHeaderMappingChange = (key: RequiredHeaderKey, value: string) => {
    const nextMap: Partial<Record<RequiredHeaderKey, string>> = {
      ...headerMap,
      [key]: value || undefined,
    };
    setHeaderMap(nextMap);
    if (headerSignature) {
      persistHeaderMap(headerSignature, nextMap);
    }
    const previewRows = buildPreviewRows(
      rawRows,
      nextMap,
      optionalHeaderMap,
      staffProfiles,
      matchStaffName
    );
    const withSession = previewRows.map((r) => {
      const key = nameKey(r.姓名);
      const session = key ? importSessionState[key] : undefined;
      if (session && !r.matchedStaffId) {
        return {
          ...r,
          matchedStaffId: session.staffId,
          matchedStaffName: session.staffName,
          matchStatus: 'manual' as const,
        };
      }
      return r;
    });
    setPreviewData(withSession);
  };

  const handleOptionalHeaderMappingChange = (key: OptionalHeaderKey, value: string) => {
    const nextMap: Partial<Record<OptionalHeaderKey, string>> = {
      ...optionalHeaderMap,
      [key]: value || undefined,
    };
    setOptionalHeaderMap(nextMap);
    if (headerSignature) {
      persistOptionalHeaderMap(headerSignature, nextMap);
    }
    const previewRows = buildPreviewRows(
      rawRows,
      headerMap,
      nextMap,
      staffProfiles,
      matchStaffName
    );
    const withSession = previewRows.map((r) => {
      const keyName = nameKey(r.姓名);
      const session = keyName ? importSessionState[keyName] : undefined;
      if (session && !r.matchedStaffId) {
        return {
          ...r,
          matchedStaffId: session.staffId,
          matchedStaffName: session.staffName,
          matchStatus: 'manual' as const,
        };
      }
      return r;
    });
    setPreviewData(withSession);
  };

  /** 用於匯入 session 的姓名 key（同名稱同步） */
  const nameKey = (excelName: ExcelCell) =>
    typeof excelName === 'string' ? excelName.trim().toLowerCase() : '';

  /** 未匹配人員的唯一姓名列表（用於摘要看板） */
  const unmatchedUniqueNames = useMemo(() => {
    const seen = new Set<string>();
    const list: ExcelCell[] = [];
    for (const row of previewData) {
      if (row.matchStatus !== 'unmatched') continue;
      const key = nameKey(row.姓名);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      list.push(row.姓名);
    }
    return list;
  }, [previewData]);


  /** 未匹配行的「建立人員」Popover 是否開啟（由列 index 控制） */
  const [createStaffPopoverIndex, setCreateStaffPopoverIndex] = useState<number | null>(null);

  /** 建立人員成功後：加入 staff 列表、更新 session、同步同名稱行、關閉 Popover */
  const handleCreateStaffSuccess = (
    excelName: ExcelCell,
    staffId: string,
    staffName: string
  ) => {
    const key = nameKey(excelName);
    if (!key) return;
    setStaffProfiles((prev) => {
      if (prev.some((s) => s.id === staffId)) return prev;
      return [...prev, { id: staffId, name: staffName }];
    });
    setImportSessionState((prev) => ({
      ...prev,
      [key]: { staffId, staffName },
    }));
    setPreviewData((prev) =>
      prev.map((r) =>
        nameKey(r.姓名) === key
          ? {
              ...r,
              matchedStaffId: staffId,
              matchedStaffName: staffName,
              matchStatus: 'manual',
            }
          : r
      )
    );
    setCreateStaffPopoverIndex(null);
    setBatchCreateForm((prev) => {
      const key = nameKey(excelName);
      if (!key) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  /** 摘要區批次建立：對所有已填 Email 的未匹配姓名依序建立人員，完成後一次提示 */
  const handleBatchCreate = async () => {
    const toCreate: { key: string; excelName: ExcelCell; email: string; employeeNo: string }[] = [];
    for (const excelName of unmatchedUniqueNames) {
      const key = nameKey(excelName);
      if (!key) continue;
      const form = batchCreateForm[key] ?? { email: '', employeeNo: '' };
      const email = form.email.trim();
      if (!email) continue;
      toCreate.push({
        key,
        excelName,
        email,
        employeeNo: form.employeeNo.trim() || '',
      });
    }
    if (toCreate.length === 0) {
      toast.error('請至少為一位未匹配人員填寫 Email');
      return;
    }
    const displayName = (n: ExcelCell) =>
      typeof n === 'string' ? n.trim() : String(n ?? '');
    const namesByEmailLower = new Map<string, string[]>();
    for (const row of toCreate) {
      const el = row.email.toLowerCase();
      const label = displayName(row.excelName) || row.email;
      const arr = namesByEmailLower.get(el);
      if (arr) arr.push(label);
      else namesByEmailLower.set(el, [label]);
    }
    const duplicateEmailGroups = Array.from(namesByEmailLower.entries()).filter(
      ([, names]) => names.length > 1
    );
    if (duplicateEmailGroups.length > 0) {
      const detail = duplicateEmailGroups
        .map(([el, names]) => `${el}（${names.join('、')}）`)
        .join('；');
      toast.error(
        `批次內 Email 重複（不分大小寫），請為每位人員使用不同 Email：${detail}`
      );
      return;
    }
    setIsBatchCreating(true);
    const succeeded: string[] = [];
    const failed: { name: string; error: string }[] = [];
    try {
      for (const { excelName, email, employeeNo } of toCreate) {
        const result = await createStaffProfile({
          name: displayName(excelName) || email,
          email,
          employeeNo: employeeNo || undefined,
        });
        if (result.success && result.data) {
          succeeded.push(result.data.name);
          handleCreateStaffSuccess(excelName, result.data.id, result.data.name);
        } else {
          failed.push({ name: displayName(excelName) || email, error: result.error ?? '建立失敗' });
        }
      }
      if (succeeded.length > 0) {
        toast.success(
          `已建立 ${succeeded.length} 位人員${failed.length > 0 ? `；${failed.length} 位失敗` : ''}`,
          { duration: 3000 }
        );
      }
      if (failed.length > 0 && succeeded.length === 0) {
        toast.error(failed.map((f) => `${f.name}: ${f.error}`).join('；'));
      }
    } finally {
      setIsBatchCreating(false);
    }
  };

  const pad2 = (value: number) => String(value).padStart(2, '0');
  const timeOnlyPattern = /^\s*\d{1,2}:\d{2}(:\d{2})?\s*$/;

  const isTimeOnlyValue = (value: ExcelCell) => {
    if (typeof value === 'number') {
      return value > 0 && value < 1;
    }
    if (value instanceof Date) {
      const year = value.getUTCFullYear();
      const month = value.getUTCMonth();
      const day = value.getUTCDate();
      return (
        (year === 1899 && month === 11 && day === 30) ||
        (year === 1970 && month === 0 && day === 1)
      );
    }
    if (typeof value === 'string') {
      return timeOnlyPattern.test(value);
    }
    return false;
  };

  // 解析完整日期時間
  const parseDateTime = (value: ExcelCell, isDate: boolean = false): string => {
    if (value === null || value === undefined) {
      return '';
    }
    if (value instanceof Date) {
      return isDate ? value.toISOString().split('T')[0] : value.toISOString();
    }
    if (typeof value === 'number') {
      if (value > 0 && value < 1) {
        return '';
      }
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) {
        const d = new Date(
          Date.UTC(
            parsed.y,
            parsed.m - 1,
            parsed.d,
            parsed.H || 0,
            parsed.M || 0,
            parsed.S || 0
          )
        );
        return isDate ? d.toISOString().split('T')[0] : d.toISOString();
      }
      const fallback = new Date(value);
      if (!isNaN(fallback.getTime())) {
        return isDate ? fallback.toISOString().split('T')[0] : fallback.toISOString();
      }
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed || timeOnlyPattern.test(trimmed)) {
        return '';
      }
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        return isDate ? parsed.toISOString().split('T')[0] : parsed.toISOString();
      }
    }
    return '';
  };

  const parseDatePart = (value: ExcelCell) => {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'number' && value > 0 && value < 1) {
      return '';
    }
    if (typeof value === 'string' && timeOnlyPattern.test(value)) {
      return '';
    }
    return parseDateTime(value, true);
  };

  const parseTimePart = (value: ExcelCell) => {
    if (value === null || value === undefined) {
      return '';
    }
    if (value instanceof Date) {
      return value.toISOString().split('T')[1]?.replace('Z', '') || '';
    }
    if (typeof value === 'number') {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) {
        return `${pad2(parsed.H || 0)}:${pad2(parsed.M || 0)}:${pad2(parsed.S || 0)}`;
      }
      return '';
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return '';
      }
      if (timeOnlyPattern.test(trimmed)) {
        return trimmed.split(':').length === 2 ? `${trimmed}:00` : trimmed;
      }
      const parsed = parseDateTime(trimmed);
      if (parsed) {
        return parsed.split('T')[1]?.replace('Z', '') || '';
      }
    }
    return '';
  };

  const resolveDateTime = (dateCell: ExcelCell, timeCell: ExcelCell) => {
    if (timeCell === null || timeCell === undefined || timeCell === '') {
      return '';
    }
    if (!isTimeOnlyValue(timeCell)) {
      const full = parseDateTime(timeCell);
      if (full) {
        return full;
      }
    }
    const datePart = parseDatePart(dateCell);
    const timePart = parseTimePart(timeCell);
    if (datePart && timePart) {
      const combined = new Date(`${datePart}T${timePart}`);
      if (!isNaN(combined.getTime())) {
        return combined.toISOString();
      }
    }
    return parseDateTime(timeCell);
  };

  const renderRecordDateValue = (row: ParsedExcelRow) => {
    const datePart = parseDatePart(row.日期 ?? row.進場時間);
    if (!datePart) {
      return '-';
    }
    const date = new Date(`${datePart}T00:00:00`);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('zh-TW');
    }
    return datePart;
  };

  const renderRecordTimeValue = (value: ExcelCell) => {
    const timePart = parseTimePart(value);
    if (!timePart) {
      return '-';
    }
    return timePart;
  };

  const normalizeText = (value: ExcelCell) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  };

  const resolveRecordDate = (row: ParsedExcelRow) => {
    const candidate = row.日期 ?? row.進場時間;
    const parsed = parseDatePart(candidate);
    if (!parsed) {
      throw new Error('日期欄位缺失，且進場時間無法解析日期');
    }
    return parsed;
  };

  /** 與 actions/upload/import.ts logical key 一致，供預覽合併提示（僅已匹配人員且可匯入列） */
  const crossFacilityMergePreview = useMemo(() => {
    const keyToIndices = new Map<string, number[]>();
    previewData.forEach((row, index) => {
      if (!row.matchedStaffId) return;
      let recordDate: string;
      try {
        recordDate = resolveRecordDate(row);
      } catch {
        return;
      }
      const dateCell = row.日期 ?? row.進場時間;
      const checkIn = resolveDateTime(dateCell, row.進場時間);
      if (!checkIn) return;
      if (!row.出場時間) return;
      const checkOut = resolveDateTime(dateCell, row.出場時間);
      if (!checkOut) return;
      const durationMinutes =
        (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60);
      if (
        IMPORT_MIN_DURATION_MINUTES > 0 &&
        durationMinutes < IMPORT_MIN_DURATION_MINUTES
      ) {
        return;
      }
      const key = `${row.matchedStaffId}|${recordDate}|${checkIn}|${checkOut}`;
      const arr = keyToIndices.get(key) ?? [];
      arr.push(index);
      keyToIndices.set(key, arr);
    });

    const mergeGroups = Array.from(keyToIndices.entries()).filter(
      ([, indices]) => indices.length > 1
    );
    const mergeRowIndexSet = new Set<number>();
    mergeGroups.forEach(([, indices]) => {
      indices.forEach((i) => mergeRowIndexSet.add(i));
    });

    const facilitySummary = mergeGroups.map(([key, indices]) => {
      const distinctPairs = Array.from(
        new Set(
          indices.map((i) => {
            const r = previewData[i];
            const fac = normalizeText(r.廠區) || '—';
            const wa = normalizeText(r.工作區域代號) || fac;
            return `${fac}／${wa}`;
          })
        )
      );
      return { key, rowIndices: indices, distinctPairs };
    });

    return {
      mergeGroupCount: mergeGroups.length,
      mergeRowCount: mergeRowIndexSet.size,
      mergeRowIndexSet,
      facilitySummary,
    };
  }, [previewData]);

  const previewTableRows = useMemo(() => {
    const base = previewData.map((row, index) => ({ row, index }));
    let out = base;
    if (showUnmatchedOnly) {
      out = out.filter(({ row }) => row.matchStatus === 'unmatched');
    }
    if (showMergeCandidatesOnly) {
      out = out.filter(({ index }) => crossFacilityMergePreview.mergeRowIndexSet.has(index));
    }
    return out;
  }, [previewData, showUnmatchedOnly, showMergeCandidatesOnly, crossFacilityMergePreview]);

  // 執行匯入（先匯入、後認領：time_records.task_id 一律為 NULL）
  const handleImport = async () => {
    const missingMappings = getMissingRequiredKeys(headerMap);
    if (missingMappings.length > 0) {
      toast.error(`請先完成欄位對應: ${missingMappings.join('、')}`);
      return;
    }

    // 檢查是否有未匹配的員工
    const unmatched = previewData.filter((row) => !row.matchedStaffId);
    if (unmatched.length > 0) {
      toast.error(`尚有 ${unmatched.length} 筆資料未匹配員工，請先完成匹配`);
      return;
    }

    setIsImporting(true);

    try {
      // 準備匯入資料（task_id 一律為 null，於認領中心指派）
      const importRecords: ImportTimeRecord[] = previewData.map((row) => {
        const recordDate = resolveRecordDate(row);
        const checkInTime = resolveDateTime(row.日期 ?? row.進場時間, row.進場時間);
        if (!checkInTime) {
          throw new Error('進場時間無法解析');
        }
        const checkOutTime = row.出場時間
          ? resolveDateTime(row.日期 ?? row.進場時間, row.出場時間)
          : null;
        if (row.出場時間 && !checkOutTime) {
          throw new Error('出場時間無法解析');
        }

        const displayName = normalizeText(row.姓名);
        const vendorNo = normalizeText(row.廠商編號);
        const deptName = normalizeText(row.部門名稱);
        const workAreaCode = normalizeText(row.工作區域代號);
        const factoryLocation = normalizeText(row.廠區);
        return {
          staff_id: row.matchedStaffId!,
          record_date: recordDate,
          factory_location: factoryLocation,
          work_area_code: workAreaCode || factoryLocation,
          check_in_time: checkInTime,
          check_out_time: checkOutTime,
          notes: `匯入自 Excel - ${displayName}`,
          import_vendor_no: vendorNo || null,
          department_name: deptName || null,
        };
      });

      // 執行匯入
      const result = await importTimeRecords(importRecords);

      if (!result.success) {
        toast.error(result.error || '匯入失敗');
        setIsImporting(false);
        return;
      }

      const {
        imported,
        errors,
        skippedNoCheckOut,
        skippedDuration,
        mergedAsExtraFacilities,
      } = result.data!;

      if (errors.length > 0) {
        console.error('匯入錯誤:', errors);
      }

      const skipParts: string[] = [];
      if ((skippedNoCheckOut ?? 0) > 0) skipParts.push(`缺出場時間 ${skippedNoCheckOut} 筆`);
      if ((skippedDuration ?? 0) > 0) {
        skipParts.push(`時長<${IMPORT_MIN_DURATION_MINUTES}分 ${skippedDuration} 筆`);
      }
      const mergeCount = mergedAsExtraFacilities ?? 0;
      const mergeMsg =
        mergeCount > 0 ? `，跨廠區併入同一邏輯工時 ${mergeCount} 列（已寫入多組廠區／代號）` : '';
      const skipMsg = skipParts.length > 0 ? `，未寫入: ${skipParts.join('、')}` : '';

      toast.success(
        `匯入完成！新建邏輯工時: ${imported} 筆${mergeMsg}${skipMsg}${errors.length > 0 ? `，錯誤: ${errors.length} 筆` : ''}`
      );

      // 導向認領看板並強制重取資料，避免 Router Cache 顯示舊（空）清單
      router.push('/dashboard/billing');
      router.refresh();
    } catch (error) {
      console.error('匯入失敗:', error);
      toast.error('匯入失敗');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Excel 時數紀錄匯入</h1>
        <p className="text-muted-foreground mt-1">
          上傳業主格式的進出廠紀錄 Excel 檔案
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>上傳 Excel 檔案</CardTitle>
          <CardDescription>
            請上傳包含以下欄位的 Excel 檔案：姓名、日期、廠區、進場時間、出場時間（選填：廠商編號、部門名稱、工作區域代號）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            disabled={isLoading}
          />
        </CardContent>
      </Card>

      {previewData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>預覽資料</CardTitle>
            <CardDescription>
              請確認人員匹配是否正確，未匹配的資料請參考上方摘要處理
            </CardDescription>
          </CardHeader>
          <CardContent>
            {availableHeaders.length > 0 && (
              <div className="mb-4 rounded-md border bg-muted/30 p-4">
                <div className="mb-2 text-sm font-medium">欄位對應</div>
                <div className="grid gap-4 md:grid-cols-2">
                  {REQUIRED_HEADER_DEFINITIONS.map((definition) => {
                    const isOptional =
                      definition.key === '日期' || definition.key === '出場時間';
                    const isMissing = !headerMap[definition.key];
                    return (
                      <div key={definition.key}>
                        <label className="mb-1 block text-sm font-medium">
                          {definition.key}
                          <span
                            className={`ml-2 text-xs ${
                              isOptional
                                ? 'text-muted-foreground'
                                : isMissing
                                ? 'text-red-600'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {isOptional ? '可選' : isMissing ? '必填' : '已選'}
                          </span>
                        </label>
                        <Select
                          value={headerMap[definition.key] ?? ''}
                          onChange={(event) =>
                            handleHeaderMappingChange(definition.key, event.target.value)
                          }
                          className="bg-background"
                        >
                          <option value="" className="bg-background">(未選擇)</option>
                          {availableHeaders.map((header) => (
                            <option key={header} value={header} className="bg-background">
                              {header}
                            </option>
                          ))}
                        </Select>
                        {definition.key === '日期' && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            未提供日期時，會從進場時間自動推導
                          </p>
                        )}
                        {definition.key === '出場時間' && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            未對應或空值時，該列不會匯入，也不會出現在認領看板
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 border-t border-border pt-4">
                  <div className="mb-2 text-sm font-medium">選填欄位對應</div>
                  <p className="mb-3 text-xs text-muted-foreground">
                    對應後會一併寫入紀錄並顯示於請款認領看板（未對應則留空）
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    {OPTIONAL_HEADER_DEFINITIONS.map((definition) => (
                      <div key={definition.key}>
                        <label className="mb-1 block text-sm font-medium">
                          {definition.key}
                          <span className="ml-2 text-xs text-muted-foreground">可選</span>
                        </label>
                        <Select
                          value={optionalHeaderMap[definition.key] ?? ''}
                          onChange={(event) =>
                            handleOptionalHeaderMappingChange(
                              definition.key,
                              event.target.value
                            )
                          }
                          className="bg-background"
                        >
                          <option value="" className="bg-background">
                            (未選擇)
                          </option>
                          {availableHeaders.map((header) => (
                            <option key={header} value={header} className="bg-background">
                              {header}
                            </option>
                          ))}
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {unmatchedUniqueNames.length > 0 && (
              <Card className="mb-4 border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30">
                <CardHeader className="py-3">
                  <CardTitle className="text-base">未匹配人員摘要</CardTitle>
                  <CardDescription>
                    以下姓名尚未對應到系統人員。建議先至「基礎資料 &gt; 人員名冊」匯入最新名冊，或填寫 Email／工號後按「批次建立」。表格中同姓名列會一併更新
                  </CardDescription>
                </CardHeader>
                <CardContent className="py-3">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-28">姓名</TableHead>
                          <TableHead className="min-w-[200px]">Email（建立用）</TableHead>
                          <TableHead className="min-w-[100px]">工號（選填）</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {unmatchedUniqueNames.map((excelName, i) => {
                          const displayName =
                            typeof excelName === 'string' ? excelName.trim() : String(excelName ?? '');
                          const key = nameKey(excelName);
                          const form = batchCreateForm[key] ?? { email: '', employeeNo: '' };
                          return (
                            <TableRow key={key || i}>
                              <TableCell className="font-medium">{displayName || '(未填)'}</TableCell>
                              <TableCell>
                                <Input
                                  type="email"
                                  placeholder="name@example.com"
                                  value={form.email}
                                  onChange={(e) =>
                                    setBatchCreateForm((prev) => ({
                                      ...prev,
                                      [key]: { ...form, email: e.target.value },
                                    }))
                                  }
                                  className="h-8 bg-background"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="text"
                                  placeholder="選填"
                                  value={form.employeeNo}
                                  onChange={(e) =>
                                    setBatchCreateForm((prev) => ({
                                      ...prev,
                                      [key]: { ...form, employeeNo: e.target.value },
                                    }))
                                  }
                                  className="h-8 bg-background"
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleBatchCreate}
                      disabled={isBatchCreating}
                    >
                      {isBatchCreating ? '建立中...' : '批次建立（已填 Email 的人員）'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            {crossFacilityMergePreview.mergeGroupCount > 0 && (
              <Card className="mb-4 border-sky-200 bg-sky-50/50 dark:border-sky-900 dark:bg-sky-950/30">
                <CardHeader className="py-3">
                  <CardTitle className="text-base">跨廠區／工作區代號合併摘要</CardTitle>
                  <CardDescription>
                    下列列在員工、日期與進出場時間（與匯入後端 logical key）完全一致，且時長≥5
                    分鐘、有出場時間；匯入後會合併為{' '}
                    <span className="font-medium text-foreground">同一筆</span> 邏輯工時，並以多組
                    （所屬廠區、工作區域代號）保存。
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 py-3">
                  <p className="text-sm">
                    共{' '}
                    <span className="font-semibold text-foreground">
                      {crossFacilityMergePreview.mergeGroupCount}
                    </span>{' '}
                    組將合併，涉及 Excel{' '}
                    <span className="font-semibold text-foreground">
                      {crossFacilityMergePreview.mergeRowCount}
                    </span>{' '}
                    列。
                  </p>
                  <ul className="max-h-40 list-inside list-disc space-y-1 overflow-y-auto text-sm text-muted-foreground">
                    {crossFacilityMergePreview.facilitySummary.slice(0, 12).map((g) => (
                      <li key={g.key}>
                        {g.rowIndices.length} 列 → 廠區／代號：{g.distinctPairs.join('；')}
                      </li>
                    ))}
                  </ul>
                  {crossFacilityMergePreview.facilitySummary.length > 12 && (
                    <p className="text-xs text-muted-foreground">
                      其餘 {crossFacilityMergePreview.facilitySummary.length - 12} 組請用下方篩選檢視表格。
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
            <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="filter-unmatched"
                  checked={showUnmatchedOnly}
                  onCheckedChange={(checked) => setShowUnmatchedOnly(checked === true)}
                />
                <Label htmlFor="filter-unmatched" className="cursor-pointer text-sm">
                  僅顯示未匹配人員
                </Label>
              </div>
              {crossFacilityMergePreview.mergeGroupCount > 0 && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="filter-merge-candidates"
                    checked={showMergeCandidatesOnly}
                    onCheckedChange={(checked) => setShowMergeCandidatesOnly(checked === true)}
                  />
                  <Label htmlFor="filter-merge-candidates" className="cursor-pointer text-sm">
                    僅顯示將合併的列（跨廠區／代號）
                  </Label>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>姓名</TableHead>
                    <TableHead>日期</TableHead>
                    <TableHead>廠區</TableHead>
                    <TableHead>工作區域代號</TableHead>
                    <TableHead>廠商編號</TableHead>
                    <TableHead>部門名稱</TableHead>
                    <TableHead>進場時間</TableHead>
                    <TableHead>出場時間</TableHead>
                    <TableHead>匹配狀態</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewTableRows.map(({ row, index }) => (
                    <TableRow key={index}>
                      <TableCell>{normalizeText(row.姓名) || '-'}</TableCell>
                      <TableCell>
                        {renderRecordDateValue(row)}
                      </TableCell>
                      <TableCell>{normalizeText(row.廠區) || '-'}</TableCell>
                      <TableCell>{normalizeText(row.工作區域代號) || '-'}</TableCell>
                      <TableCell>{normalizeText(row.廠商編號) || '-'}</TableCell>
                      <TableCell>{normalizeText(row.部門名稱) || '-'}</TableCell>
                      <TableCell>
                        {renderRecordTimeValue(row.進場時間)}
                      </TableCell>
                      <TableCell>
                        {renderRecordTimeValue(row.出場時間)}
                      </TableCell>
                      <TableCell>
                        {row.matchStatus === 'matched' && (
                          <span className="text-green-600">✓ 已匹配: {row.matchedStaffName}</span>
                        )}
                        {row.matchStatus === 'manual' && (
                          <span className="text-blue-600">✓ 已對應: {row.matchedStaffName}</span>
                        )}
                        {row.matchStatus === 'unmatched' && (
                          <div className="flex items-center gap-2">
                            <span className="text-red-600">✗ 未匹配</span>
                            <CreateStaffPopoverInRow
                              rowIndex={index}
                              excelName={row.姓名}
                              open={createStaffPopoverIndex === index}
                              onOpenChange={(open) =>
                                setCreateStaffPopoverIndex(open ? index : null)
                              }
                              onSuccess={handleCreateStaffSuccess}
                            />
                          </div>
                        )}
                      </TableCell>
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
