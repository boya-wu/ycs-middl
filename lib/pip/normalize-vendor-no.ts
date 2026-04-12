const VENDOR_PREFIX = 'V001';

/** 去除讀卡機前綴，統一廠商編號（純函式，不可置於 'use server' 檔案中 export） */
export function normalizeVendorNo(raw: string): string {
  const trimmed = raw.trim().toUpperCase();
  if (trimmed.startsWith(VENDOR_PREFIX)) {
    return trimmed.slice(VENDOR_PREFIX.length);
  }
  return trimmed;
}
