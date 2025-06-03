-- ─────────────────────────────────────────────────────────────────────────────
-- Bulk Import Script for TikTok Handles
-- Use this to import thousands of creators at once
-- ─────────────────────────────────────────────────────────────────────────────

-- Method 1: If you have usernames in a CSV file
-- First create a temporary table to load the CSV
CREATE TEMP TABLE temp_creators (
  username TEXT
);

-- Import from CSV (replace 'path/to/your/creators.csv' with actual path)
-- Note: This may need to be done via psql command line or Supabase's bulk import feature
-- \COPY temp_creators(username) FROM 'creators.csv' WITH CSV HEADER;

-- Insert into main table with deduplication
INSERT INTO tiktok_handles (username, discovery_source, status)
SELECT DISTINCT 
  username,
  'manual' as discovery_source,
  'active' as status
FROM temp_creators
WHERE username IS NOT NULL 
  AND LENGTH(TRIM(username)) > 0
  AND username NOT IN (SELECT username FROM tiktok_handles)
ON CONFLICT (username) DO NOTHING;

-- Clean up
DROP TABLE temp_creators;

-- Method 2: Direct insert with VALUES (for smaller batches)
-- Copy this pattern and repeat for your usernames
INSERT INTO tiktok_handles (username, discovery_source) VALUES 
('creator1', 'manual'),
('creator2', 'manual'),
('creator3', 'manual')
-- ... add up to 1000 at a time
ON CONFLICT (username) DO NOTHING;

-- Method 3: Batch insert function (most efficient for programmatic import)
-- This creates a function to handle large batches
CREATE OR REPLACE FUNCTION bulk_insert_handles(usernames TEXT[])
RETURNS INTEGER AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  INSERT INTO tiktok_handles (username, discovery_source, status)
  SELECT DISTINCT 
    unnest(usernames),
    'manual',
    'active'
  WHERE unnest(usernames) NOT IN (SELECT username FROM tiktok_handles);
  
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;

-- Example usage of bulk function:
-- SELECT bulk_insert_handles(ARRAY['user1', 'user2', 'user3', ...]);

-- Verify your import
SELECT 
  COUNT(*) as total_handles,
  COUNT(*) FILTER (WHERE discovery_source = 'manual') as manual_imports,
  COUNT(*) FILTER (WHERE status = 'active') as active_handles
FROM tiktok_handles;