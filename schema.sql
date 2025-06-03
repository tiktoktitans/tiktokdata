-- ─────────────────────────────────────────────────────────────────────────────
-- Supabase SQL Schema for TikTok Handle Management
-- Run these commands in your Supabase SQL editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Table: tiktok_handles
-- Manages TikTok usernames with activity tracking and auto-removal logic
CREATE TABLE IF NOT EXISTS tiktok_handles (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  last_scraped_at TIMESTAMPTZ,
  total_videos_found INTEGER DEFAULT 0,
  shop_videos_found INTEGER DEFAULT 0,
  shop_ratio DECIMAL(5,4) DEFAULT 0, -- 0.0000 to 1.0000 (0% to 100%)
  consecutive_days_no_shop INTEGER DEFAULT 0,
  consecutive_days_no_posts INTEGER DEFAULT 0,
  status TEXT CHECK (status IN ('active', 'inactive', 'removed')) DEFAULT 'active',
  discovery_source TEXT CHECK (discovery_source IN ('hashtag', 'manual', 'video_mention')) DEFAULT 'hashtag',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_tiktok_handles_status ON tiktok_handles(status);
CREATE INDEX IF NOT EXISTS idx_tiktok_handles_last_scraped ON tiktok_handles(last_scraped_at);
CREATE INDEX IF NOT EXISTS idx_tiktok_handles_shop_ratio ON tiktok_handles(shop_ratio);

-- Table: handle_discovery_queue
-- Queue for newly discovered handles before they're processed
CREATE TABLE IF NOT EXISTS handle_discovery_queue (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  source_video_id TEXT, -- aweme_id of video where handle was discovered
  discovery_method TEXT CHECK (discovery_method IN ('video_author', 'video_mention', 'comment', 'manual')),
  priority INTEGER DEFAULT 1, -- 1=low, 2=medium, 3=high
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discovery_queue_processed ON handle_discovery_queue(processed);
CREATE INDEX IF NOT EXISTS idx_discovery_queue_priority ON handle_discovery_queue(priority DESC);

-- Table: handle_scrape_history
-- Track scraping history for analytics and debugging
CREATE TABLE IF NOT EXISTS handle_scrape_history (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  videos_found INTEGER DEFAULT 0,
  shop_videos_found INTEGER DEFAULT 0,
  pages_scraped INTEGER DEFAULT 0,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  
  FOREIGN KEY (username) REFERENCES tiktok_handles(username) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scrape_history_username ON handle_scrape_history(username);
CREATE INDEX IF NOT EXISTS idx_scrape_history_scraped_at ON handle_scrape_history(scraped_at);

-- Function: Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger: Auto-update updated_at on tiktok_handles
CREATE TRIGGER update_tiktok_handles_updated_at 
  BEFORE UPDATE ON tiktok_handles 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- View: Active handles with performance metrics
CREATE OR REPLACE VIEW active_handles_performance AS
SELECT 
  username,
  shop_ratio,
  shop_videos_found,
  total_videos_found,
  consecutive_days_no_shop,
  consecutive_days_no_posts,
  last_scraped_at,
  CASE 
    WHEN shop_ratio >= 0.3 THEN 'high'
    WHEN shop_ratio >= 0.1 THEN 'medium'
    ELSE 'low'
  END as performance_tier,
  EXTRACT(EPOCH FROM (NOW() - last_scraped_at))/3600 as hours_since_last_scrape
FROM tiktok_handles 
WHERE status = 'active'
ORDER BY shop_ratio DESC, shop_videos_found DESC;

-- View: Handle discovery analytics
CREATE OR REPLACE VIEW handle_discovery_stats AS
SELECT 
  discovery_method,
  COUNT(*) as total_discovered,
  COUNT(*) FILTER (WHERE processed = true) as processed_count,
  COUNT(*) FILTER (WHERE processed = false) as pending_count,
  AVG(EXTRACT(EPOCH FROM (NOW() - created_at))/3600) as avg_age_hours
FROM handle_discovery_queue
GROUP BY discovery_method
ORDER BY total_discovered DESC;

-- Sample data: Add some initial handles (modify usernames as needed)
INSERT INTO tiktok_handles (username, discovery_source) VALUES 
('tiktokmademebuyit', 'manual'),
('tiktokfinds', 'manual'),
('shopwithkennedi', 'manual'),
('tiktokmademeshop', 'manual')
ON CONFLICT (username) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Useful queries for monitoring
-- ─────────────────────────────────────────────────────────────────────────────

-- Check handle performance
-- SELECT * FROM active_handles_performance LIMIT 20;

-- Find handles ready for removal
-- SELECT username, consecutive_days_no_shop, consecutive_days_no_posts, shop_ratio 
-- FROM tiktok_handles 
-- WHERE status = 'active' 
-- AND (consecutive_days_no_posts >= 7 OR consecutive_days_no_shop >= 14 OR shop_ratio < 0.1);

-- Discovery queue status
-- SELECT * FROM handle_discovery_stats;

-- Recent scraping activity
-- SELECT username, scraped_at, videos_found, shop_videos_found, success
-- FROM handle_scrape_history 
-- ORDER BY scraped_at DESC 
-- LIMIT 50;