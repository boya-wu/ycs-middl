/**
 * 匯入最短時長（分鐘）。0 表示不過濾短時段。
 * 暫時關閉潔癖；還原時改為 5 或設環境變數。
 *
 * Server Actions 可設 `IMPORT_MIN_DURATION_MINUTES`；預覽頁（client）需同步設
 * `NEXT_PUBLIC_IMPORT_MIN_DURATION_MINUTES` 為相同數值，否則僅後端會過濾。
 */
const DEFAULT_IMPORT_MIN_DURATION_MINUTES = 0;

function readImportMinDurationMinutes(): number {
  if (typeof process === 'undefined') return DEFAULT_IMPORT_MIN_DURATION_MINUTES;
  const rawServer = process.env.IMPORT_MIN_DURATION_MINUTES;
  const rawPublic = process.env.NEXT_PUBLIC_IMPORT_MIN_DURATION_MINUTES;
  const raw =
    rawServer !== undefined && rawServer !== ''
      ? rawServer
      : rawPublic !== undefined && rawPublic !== ''
        ? rawPublic
        : '';
  if (raw === '') return DEFAULT_IMPORT_MIN_DURATION_MINUTES;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_IMPORT_MIN_DURATION_MINUTES;
  return Math.floor(n);
}

export const IMPORT_MIN_DURATION_MINUTES = readImportMinDurationMinutes();
