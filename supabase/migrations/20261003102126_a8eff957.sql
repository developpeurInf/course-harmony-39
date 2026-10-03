-- Add quiz availability window columns to exams table
ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS available_from  timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS available_until timestamptz DEFAULT NULL;

COMMENT ON COLUMN exams.available_from  IS 'Quiz becomes accessible to students from this datetime (null = always accessible if visible)';
COMMENT ON COLUMN exams.available_until IS 'Quiz is hidden from students after this datetime (null = no expiry)';
