-- 1. Table for current monitor state (Single row)
CREATE TABLE IF NOT EXISTS pc_monitor_state (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    state VARCHAR(20) NOT NULL DEFAULT 'NORMAL', -- NORMAL, QUEUE_ACTIVE, ERROR
    detected_at TIMESTAMPTZ,
    last_checked TIMESTAMPTZ DEFAULT NOW(),
    confidence_score FLOAT DEFAULT 0.0,
    queue_details JSONB DEFAULT '{}',
    monitor_healthy BOOLEAN DEFAULT TRUE,
    consecutive_errors INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert the initial state
INSERT INTO pc_monitor_state (state, monitor_healthy)
VALUES ('NORMAL', TRUE)
ON CONFLICT DO NOTHING;

-- 2. Table for historical queue events (Log)
CREATE TABLE IF NOT EXISTS pc_queue_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type VARCHAR(30) NOT NULL, -- QUEUE_STARTED, QUEUE_ENDED
    state_before VARCHAR(20),
    state_after VARCHAR(20),
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    duration_minutes FLOAT,
    confidence_score FLOAT,
    signals_fired JSONB DEFAULT '{}',
    notification_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Index for history lookups
CREATE INDEX IF NOT EXISTS idx_pc_queue_events_detected_at ON pc_queue_events(detected_at DESC);

-- 4. Enable RLS (Security)
ALTER TABLE pc_monitor_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE pc_queue_events ENABLE ROW LEVEL SECURITY;

-- Allow service role (Backend/Monitor) full access
CREATE POLICY "Service role full access on state" ON pc_monitor_state FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on events" ON pc_queue_events FOR ALL USING (auth.role() = 'service_role');
