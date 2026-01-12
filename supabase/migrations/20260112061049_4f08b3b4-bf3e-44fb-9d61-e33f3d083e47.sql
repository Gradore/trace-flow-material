-- Drop the old check constraint that doesn't include betriebsleiter
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add updated check constraint with betriebsleiter
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('admin', 'intake', 'production', 'qa', 'customer', 'supplier', 'logistics', 'betriebsleiter'));