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

-- Insert the initial state (only if table is empty)
INSERT INTO pc_monitor_state (state, monitor_healthy)
SELECT 'NORMAL', TRUE
WHERE NOT EXISTS (SELECT 1 FROM pc_monitor_state);

-- 2. Table for historical queue events (Log)
CREATE TABLE IF NOT EXISTS pc_queue_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type VARCHAR(30) NOT NULL, -- QUEUE_STARTED, QUEUE_ENDED, MONITOR_ERROR
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

-- 4. Table for subscriber tracking
CREATE TABLE IF NOT EXISTS pc_monitor_subscribers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    fcm_token TEXT NOT NULL,
    subscribed_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(user_id, fcm_token)
);

-- 5. Enable RLS (Security)
ALTER TABLE pc_monitor_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE pc_queue_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE pc_monitor_subscribers ENABLE ROW LEVEL SECURITY;

-- 6. Safely re-create policies (Drops them first if they exist)
DO $$
BEGIN
    -- Handle pc_monitor_state policy
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access on state' AND tablename = 'pc_monitor_state') THEN
        DROP POLICY "Service role full access on state" ON pc_monitor_state;
    END IF;
    CREATE POLICY "Service role full access on state" ON pc_monitor_state FOR ALL USING (auth.role() = 'service_role');

    -- Handle pc_queue_events policy
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access on events' AND tablename = 'pc_queue_events') THEN
        DROP POLICY "Service role full access on events" ON pc_queue_events;
    END IF;
    CREATE POLICY "Service role full access on events" ON pc_queue_events FOR ALL USING (auth.role() = 'service_role');

    -- Handle pc_monitor_subscribers policy
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access on subscribers' AND tablename = 'pc_monitor_subscribers') THEN
        DROP POLICY "Service role full access on subscribers" ON pc_monitor_subscribers;
    END IF;
    CREATE POLICY "Service role full access on subscribers" ON pc_monitor_subscribers FOR ALL USING (auth.role() = 'service_role');
END
$$;
