-- Add a JSONB column to subjects to store predefined unit names
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS unit_names JSONB DEFAULT '{}'::jsonb;
