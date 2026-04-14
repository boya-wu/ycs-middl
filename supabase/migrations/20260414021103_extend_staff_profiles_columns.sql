-- 擴充 staff_profiles：新增人員名冊欄位 + employee_no 唯一約束
ALTER TABLE staff_profiles
  ADD COLUMN IF NOT EXISTS name_en TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS mobile_phone TEXT,
  ADD COLUMN IF NOT EXISTS card_no TEXT;

COMMENT ON COLUMN staff_profiles.name_en IS '英文姓名';
COMMENT ON COLUMN staff_profiles.department IS '部門碼（含部門名稱）';
COMMENT ON COLUMN staff_profiles.job_title IS '職稱';
COMMENT ON COLUMN staff_profiles.mobile_phone IS '公務手機';
COMMENT ON COLUMN staff_profiles.card_no IS '紅卡卡號';

-- employee_no Partial Unique Index：允許 NULL 但禁止重複
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_profiles_employee_no
  ON staff_profiles (employee_no)
  WHERE employee_no IS NOT NULL;
