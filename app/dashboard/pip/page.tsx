'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  CreditCard,
  ClipboardCheck,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  X,
  Check,
  AlertCircle,
  Loader2,
  History,
} from 'lucide-react';
import {
  lookupStaffByVendorNo,
  fetchWorkHistory,
  fetchFactoryLocations,
} from '@/actions/pip/lookup';
import { normalizeVendorNo } from '@/lib/pip/normalize-vendor-no';
import { submitPipInspection } from '@/actions/pip/submit';

const PIP_TEST_MODE = process.env.NEXT_PUBLIC_PIP_TEST_MODE === 'true';
/** 生產模式：自第一字元至送出（Enter）須在此毫秒內，視為讀卡機掃描 */
const SCAN_BURST_MAX_MS = 900;

function toLocalDatetimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

type Step = 1 | 2 | 3 | 4 | 5;

interface FormState {
  rawVendorInput: string;
  vendorNo: string;
  staffId: string | null;
  staffName: string;
  nameLocked: boolean;
  inspectionDatetime: string;
  factoryLocation: string;
  factoryOther: string;
  workContent: string;
  locationTgcm: boolean;
  locationIoRoom: boolean;
  pipNoPhone: boolean;
  pipNoElectronic: boolean;
  pipNoUsb: boolean;
  pipCheckedUpperPocket: boolean;
  pipCheckedPantsPocket: boolean;
  pipCheckedRedCard: boolean;
}

function initialForm(): FormState {
  return {
    rawVendorInput: '',
    vendorNo: '',
    staffId: null,
    staffName: '',
    nameLocked: false,
    inspectionDatetime: toLocalDatetimeValue(new Date()),
    factoryLocation: '',
    factoryOther: '',
    workContent: '',
    locationTgcm: false,
    locationIoRoom: false,
    pipNoPhone: false,
    pipNoElectronic: false,
    pipNoUsb: false,
    pipCheckedUpperPocket: false,
    pipCheckedPantsPocket: false,
    pipCheckedRedCard: false,
  };
}

const STEPS: { id: Step; label: string; icon: typeof CreditCard }[] = [
  { id: 1, label: '掃描工作證', icon: CreditCard },
  { id: 2, label: '基本資訊', icon: ClipboardCheck },
  { id: 3, label: '作業地點', icon: MapPin },
  { id: 4, label: 'PIP 項目', icon: ShieldCheck },
  { id: 5, label: '確認送出', icon: CheckCircle2 },
];

export default function PipInspectionPage() {
  const [step, setStep] = useState<Step>(1);
  const [success, setSuccess] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [factoryOptions, setFactoryOptions] = useState<string[]>([]);
  const [workHistory, setWorkHistory] = useState<string[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const cardInputRef = useRef<HTMLInputElement>(null);
  const scanFirstKeyAt = useRef<number | null>(null);
  const scanLastKeyAt = useRef<number | null>(null);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { locations, error } = await fetchFactoryLocations();
      if (!cancelled && !error) setFactoryOptions(locations);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const resolvedFactoryLocation = (() => {
    if (factoryOptions.length === 0) return form.factoryOther.trim();
    if (form.factoryLocation === '__other__') return form.factoryOther.trim();
    return form.factoryLocation.trim();
  })();

  useEffect(() => {
    let cancelled = false;
    const loc = resolvedFactoryLocation;
    if (!loc || step < 2) {
      setWorkHistory([]);
      return;
    }
    (async () => {
      const { items, error } = await fetchWorkHistory(loc);
      if (!cancelled && !error) setWorkHistory(items);
      else if (!cancelled) setWorkHistory([]);
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedFactoryLocation, step, factoryOptions.length]);

  useEffect(() => {
    if (step === 1) {
      const t = setTimeout(() => cardInputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [step]);

  const resetScanTiming = useCallback(() => {
    scanFirstKeyAt.current = null;
    scanLastKeyAt.current = null;
  }, []);

  const validateScanTiming = useCallback(
    (raw: string): string | null => {
      if (PIP_TEST_MODE) return null;
      const trimmed = raw.trim();
      if (trimmed.length < 4) return null;
      const first = scanFirstKeyAt.current;
      const last = scanLastKeyAt.current;
      if (first == null || last == null) return null;
      if (last - first > SCAN_BURST_MAX_MS) {
        return (
          '偵測為手動輸入。生產環境請使用讀卡機掃描；測試請在 .env.local 設定 NEXT_PUBLIC_PIP_TEST_MODE=true'
        );
      }
      return null;
    },
    []
  );

  const runStep1Lookup = useCallback(async () => {
    const raw = form.rawVendorInput.trim();
    if (!raw) {
      setErrorMsg('請輸入或掃描工作證號碼');
      return;
    }
    const timingErr = validateScanTiming(raw);
    if (timingErr) {
      setErrorMsg(timingErr);
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    const result = await lookupStaffByVendorNo(raw);
    setLoading(false);

    if (result.error) {
      setErrorMsg(`查詢失敗：${result.error}`);
      return;
    }

    const hasName = Boolean(result.name?.trim());
    setForm((prev) => ({
      ...prev,
      vendorNo: result.vendorNo,
      staffId: result.staffId,
      staffName: result.name ?? '',
      nameLocked: hasName,
    }));
    resetScanTiming();
    setStep(2);
  }, [form.rawVendorInput, resetScanTiming, validateScanTiming]);

  const handleCardKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (PIP_TEST_MODE) {
      if (e.key === 'Enter') {
        e.preventDefault();
        void runStep1Lookup();
      }
      return;
    }
    const now = Date.now();
    if (e.key === 'Enter') {
      e.preventDefault();
      void runStep1Lookup();
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (scanFirstKeyAt.current == null) scanFirstKeyAt.current = now;
      scanLastKeyAt.current = now;
    }
  };

  const handleCardPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (PIP_TEST_MODE) return;
    e.preventDefault();
    setErrorMsg('生產模式不允許貼上，請使用讀卡機掃描');
  };

  const handleCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setField('rawVendorInput', e.target.value);
    if (PIP_TEST_MODE) return;
    if (e.target.value.length === 0) resetScanTiming();
  };

  const validateStep2 = (): string | null => {
    if (!form.inspectionDatetime) return '請選擇日期與時間';
    const fac = resolvedFactoryLocation;
    if (!fac) return '請選擇或填寫廠區';
    if (!form.workContent.trim()) return '請輸入工作內容';
    if (!form.staffName.trim()) return '請填寫姓名';
    return null;
  };

  const goNext = () => {
    setErrorMsg(null);
    if (step === 2) {
      const err = validateStep2();
      if (err) {
        setErrorMsg(err);
        return;
      }
    }
    if (step < 5) setStep((s) => (s + 1) as Step);
  };

  const goPrev = () => {
    setErrorMsg(null);
    if (step > 1) setStep((s) => (s - 1) as Step);
  };

  const handleFinalSubmit = async () => {
    setLoading(true);
    setErrorMsg(null);
    const iso = new Date(form.inspectionDatetime).toISOString();
    const result = await submitPipInspection({
      vendor_no: form.vendorNo,
      staff_id: form.staffId,
      staff_name: form.staffName.trim(),
      inspection_datetime: iso,
      factory_location: resolvedFactoryLocation,
      work_content: form.workContent.trim(),
      location_tgcm: form.locationTgcm,
      location_io_room: form.locationIoRoom,
      pip_no_phone: form.pipNoPhone,
      pip_no_electronic: form.pipNoElectronic,
      pip_no_usb: form.pipNoUsb,
      pip_checked_upper_pocket: form.pipCheckedUpperPocket,
      pip_checked_pants_pocket: form.pipCheckedPantsPocket,
      pip_checked_red_card: form.pipCheckedRedCard,
    });
    setLoading(false);
    if (result.error) {
      setErrorMsg(`儲存失敗：${result.error}`);
      return;
    }
    setSubmittedId(result.id);
    setSuccess(true);
  };

  const handleReset = () => {
    setForm(initialForm());
    setStep(1);
    setSuccess(false);
    setSubmittedId(null);
    setErrorMsg(null);
    resetScanTiming();
  };

  if (success) {
    return (
      <div className="container mx-auto max-w-2xl p-6">
        <div className="rounded-xl border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-xl font-bold">PIP 自我檢查已送出</h2>
          <p className="mt-2 text-muted-foreground">
            {form.staffName} 的紀錄已成功儲存
          </p>
          {submittedId && (
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              紀錄編號：{submittedId}
            </p>
          )}
          <div className="mt-6 rounded-lg border border-dashed p-3 text-left text-xs text-muted-foreground">
            <span className="font-medium text-foreground">維護紀錄表</span>
            ：PM 指派與確認日期將於後續補登（資料庫欄位已預留）。
          </div>
          <Button className="mt-6 w-full" onClick={handleReset}>
            <CreditCard className="mr-2 h-4 w-4" />
            下一位人員
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl p-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ShieldCheck className="h-6 w-6 text-primary" />
          進廠 PIP 自我檢查
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          依序完成掃描、基本資料、地點與 PIP 確認，最後預覽送出
        </p>
        {!PIP_TEST_MODE && (
          <p className="mt-2 rounded-md bg-muted/80 px-3 py-2 text-xs text-muted-foreground">
            目前為<strong className="text-foreground">生產模式</strong>
            ：請使用讀卡機掃描（禁止貼上）。開發測試請設定{' '}
            <code className="rounded bg-muted px-1">NEXT_PUBLIC_PIP_TEST_MODE=true</code>
          </p>
        )}
      </div>

      {/* 進度列 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            const isDone = step > s.id;
            const isCurrent = step === s.id;
            return (
              <div key={s.id} className="flex flex-1 items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors',
                      isDone
                        ? 'border-primary bg-primary text-primary-foreground'
                        : isCurrent
                          ? 'border-primary bg-background text-primary'
                          : 'border-muted-foreground/30 text-muted-foreground/50'
                    )}
                  >
                    {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span
                    className={cn(
                      'mt-1 text-center text-[10px] font-medium sm:text-xs',
                      isCurrent ? 'text-primary' : 'text-muted-foreground'
                    )}
                  >
                    {s.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={cn(
                      'mx-1 mt-[-18px] h-0.5 flex-1 sm:mx-2',
                      step > s.id ? 'bg-primary' : 'bg-muted-foreground/20'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Step 1 */}
      {step === 1 && (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">掃描工作證</h2>
              <p className="text-sm text-muted-foreground">
                焦點於輸入框後刷卡；讀卡機通常會自動送出 Enter
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <Label htmlFor="vendorRaw">工作證 / 廠商編號</Label>
              <Input
                ref={cardInputRef}
                id="vendorRaw"
                autoComplete="off"
                className="mt-1.5 font-mono text-base tracking-wide"
                placeholder="例：V001H5406340 或 H5406340"
                value={form.rawVendorInput}
                onChange={handleCardChange}
                onKeyDown={handleCardKeyDown}
                onPaste={handleCardPaste}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                系統會自動去除讀卡前綴 <code className="rounded bg-muted px-1">V001</code>
              </p>
            </div>
            {form.rawVendorInput.trim() !== '' && (
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                <span className="text-muted-foreground">正規化後：</span>
                <span className="ml-2 font-mono font-medium">
                  {normalizeVendorNo(form.rawVendorInput)}
                </span>
              </div>
            )}
            <Button
              className="w-full"
              onClick={() => void runStep1Lookup()}
              disabled={loading || !form.rawVendorInput.trim()}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ChevronRight className="mr-2 h-4 w-4" />
              )}
              確認並繼續
            </Button>
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <ClipboardCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">基本資訊</h2>
              <p className="text-sm text-muted-foreground">檢查時間、廠區與工作內容</p>
            </div>
          </div>
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>廠商編號</Label>
                <div className="mt-1.5 flex h-9 items-center rounded-md border bg-muted/50 px-3 font-mono text-sm">
                  {form.vendorNo}
                </div>
              </div>
              <div>
                <Label htmlFor="staffName">姓名</Label>
                {form.nameLocked ? (
                  <Input
                    id="staffName"
                    readOnly
                    className="mt-1.5 bg-muted/50"
                    value={form.staffName}
                  />
                ) : (
                  <Input
                    id="staffName"
                    className="mt-1.5"
                    placeholder="查無資料時請手動輸入"
                    value={form.staffName}
                    onChange={(e) => setField('staffName', e.target.value)}
                  />
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="inspectionDt">檢查日期與時間</Label>
              <Input
                id="inspectionDt"
                type="datetime-local"
                className="mt-1.5"
                value={form.inspectionDatetime}
                onChange={(e) => setField('inspectionDatetime', e.target.value)}
              />
            </div>
            <div>
              <Label>廠區</Label>
              {factoryOptions.length > 0 ? (
                <Select
                  value={form.factoryLocation || undefined}
                  onValueChange={(v) => setField('factoryLocation', v)}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="請選擇廠區" />
                  </SelectTrigger>
                  <SelectContent>
                    {factoryOptions.map((loc) => (
                      <SelectItem key={loc} value={loc}>
                        {loc}
                      </SelectItem>
                    ))}
                    <SelectItem value="__other__">其他（手動輸入）</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  尚無歷史廠區資料，請於下方手動填寫。
                </p>
              )}
              {(factoryOptions.length === 0 || form.factoryLocation === '__other__') && (
                <Input
                  className="mt-2"
                  placeholder="廠區名稱"
                  value={form.factoryOther}
                  onChange={(e) => setField('factoryOther', e.target.value)}
                />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="workContent">工作內容</Label>
                <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      disabled={!resolvedFactoryLocation || workHistory.length === 0}
                    >
                      <History className="h-3.5 w-3.5" />
                      歷史建議（{workHistory.length}）
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="start">
                    <p className="mb-2 text-xs text-muted-foreground">
                      同廠區近期紀錄（已去重）
                    </p>
                    <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
                      {workHistory.map((item, i) => (
                        <button
                          key={i}
                          type="button"
                          className="rounded-md border border-border px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent"
                          onClick={() => {
                            setField('workContent', item);
                            setHistoryOpen(false);
                          }}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <Textarea
                id="workContent"
                className="mt-1.5 resize-none"
                rows={3}
                placeholder="請描述本次工作內容"
                value={form.workContent}
                onChange={(e) => setField('workContent', e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">作業地點</h2>
              <p className="text-sm text-muted-foreground">有進入請勾選（✓），未進入顯示（✗）</p>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { key: 'locationTgcm' as const, label: 'TGCM' },
              { key: 'locationIoRoom' as const, label: 'IO Room' },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setField(key, !form[key])}
                className={cn(
                  'flex w-full items-center gap-4 rounded-lg border-2 p-4 text-left transition-colors',
                  form[key]
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
                )}
              >
                <Checkbox
                  checked={form[key]}
                  onCheckedChange={(v) => setField(key, !!v)}
                  className="pointer-events-none h-5 w-5"
                />
                <span className="flex-1 font-medium">{label}</span>
                <span
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold',
                    form[key]
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                  aria-hidden
                >
                  {form[key] ? '✓' : '✗'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 4 */}
      {step === 4 && (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">PIP 檢查項目</h2>
              <p className="text-sm text-muted-foreground">
                未攜帶物品以 ✓ 表示已確認未攜帶；口袋與紅卡請勾選完成檢查
              </p>
            </div>
          </div>
          <div className="mb-6">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive">
              <X className="h-4 w-4" />
              未攜帶（打 ✓ = 確認未攜帶）
            </div>
            <div className="space-y-2">
              {[
                { k: 'pipNoPhone' as const, t: '私人手機' },
                { k: 'pipNoElectronic' as const, t: '電子設備' },
                { k: 'pipNoUsb' as const, t: '隨身碟' },
              ].map(({ k, t }) => (
                <label
                  key={k}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg border p-3',
                    form[k] ? 'border-green-500/50 bg-green-50/80 dark:bg-green-950/20' : ''
                  )}
                >
                  <Checkbox
                    checked={form[k]}
                    onCheckedChange={(v) => setField(k, !!v)}
                  />
                  <span className="flex-1 text-sm font-medium">{t}</span>
                  <span className="text-xs">{form[k] ? '✓ 未攜帶' : '—'}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
              <Check className="h-4 w-4" />
              已檢查（請勾選）
            </div>
            <div className="space-y-2">
              {[
                { k: 'pipCheckedUpperPocket' as const, t: '上衣口袋' },
                { k: 'pipCheckedPantsPocket' as const, t: '褲子口袋' },
                { k: 'pipCheckedRedCard' as const, t: '紅卡' },
              ].map(({ k, t }) => (
                <label
                  key={k}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border p-3"
                >
                  <Checkbox
                    checked={form[k]}
                    onCheckedChange={(v) => setField(k, !!v)}
                  />
                  <span className="flex-1 text-sm font-medium">{t}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 5 */}
      {step === 5 && (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">確認送出</h2>
              <p className="text-sm text-muted-foreground">請核對以下內容後送出</p>
            </div>
          </div>
          <dl className="space-y-2 rounded-lg bg-muted/40 p-4 text-sm">
            <div className="grid grid-cols-3 gap-2">
              <dt className="text-muted-foreground">廠商編號</dt>
              <dd className="col-span-2 font-mono">{form.vendorNo}</dd>
              <dt className="text-muted-foreground">姓名</dt>
              <dd className="col-span-2 font-medium">{form.staffName}</dd>
              <dt className="text-muted-foreground">時間</dt>
              <dd className="col-span-2">
                {new Date(form.inspectionDatetime).toLocaleString('zh-TW')}
              </dd>
              <dt className="text-muted-foreground">廠區</dt>
              <dd className="col-span-2">{resolvedFactoryLocation}</dd>
              <dt className="text-muted-foreground">工作內容</dt>
              <dd className="col-span-2">{form.workContent}</dd>
              <dt className="text-muted-foreground">地點</dt>
              <dd className="col-span-2">
                {[form.locationTgcm && 'TGCM', form.locationIoRoom && 'IO Room']
                  .filter(Boolean)
                  .join('、') || '（皆未勾選）'}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            維護紀錄（PM / 確認日）將於後續流程補登，本次送出不填寫。
          </p>
        </div>
      )}

      {step > 1 && (
        <div className="mt-4 flex justify-between gap-2">
          <Button type="button" variant="outline" onClick={goPrev} disabled={loading}>
            <ChevronLeft className="mr-1.5 h-4 w-4" />
            上一步
          </Button>
          {step < 5 ? (
            <Button type="button" onClick={goNext} disabled={loading}>
              下一步
              <ChevronRight className="ml-1.5 h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" onClick={() => void handleFinalSubmit()} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              確認送出
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
