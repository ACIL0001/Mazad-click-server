-- Create notify_me_requests table
CREATE TABLE IF NOT EXISTS notify_me_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES "user"(id) ON DELETE CASCADE,
  search_query VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'resolved', 'expired'
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '30 days'),
  resolved_at TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notify_me_status ON notify_me_requests(status);
CREATE INDEX IF NOT EXISTS idx_notify_me_user ON notify_me_requests(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notify_me_expires ON notify_me_requests(expires_at);
CREATE INDEX IF NOT EXISTS idx_notify_me_query ON notify_me_requests(search_query);

COMMENT ON TABLE notify_me_requests IS 'Stores user requests to be notified when unavailable items become available';
COMMENT ON COLUMN notify_me_requests.expires_at IS 'Automatically set to 30 days from creation';
COMMENT ON COLUMN notify_me_requests.status IS 'pending: waiting, resolved: item now available, expired: past expiration date';
