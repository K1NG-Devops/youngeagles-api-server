-- Add profile_data column to children table for extended profile information
-- This will store JSON data containing medical, emergency, dietary, academic info

ALTER TABLE children 
ADD COLUMN profile_data JSON DEFAULT NULL 
COMMENT 'Extended profile data including medical, emergency contacts, dietary requirements, etc.';

-- Add index for better JSON query performance (optional)
ALTER TABLE children 
ADD INDEX idx_profile_data_type ((JSON_TYPE(profile_data)));

-- Update existing children with empty profile_data if needed
-- UPDATE children SET profile_data = '{}' WHERE profile_data IS NULL; 