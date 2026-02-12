-- =====================================================
-- Token-Based Pricing System Migration
-- Created: 2026-02-10
-- Description: Adds comprehensive token tracking, creator plans, and token packs
-- =====================================================

-- =====================================================
-- NEW TABLES
-- =====================================================

-- 1. Token Usage Tracking (Detailed per-message tracking)
CREATE TABLE IF NOT EXISTS token_usage (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,

    -- Who used tokens
    user_id TEXT REFERENCES "User"(id) ON DELETE CASCADE,
    creator_id TEXT REFERENCES "User"(id) ON DELETE CASCADE,
    session_id TEXT REFERENCES chat_sessions(id) ON DELETE SET NULL,
    message_id TEXT REFERENCES chat_messages(id) ON DELETE CASCADE,

    -- Token breakdown
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    system_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens + system_tokens) STORED,

    -- Which model was used
    model_used VARCHAR(100), -- 'gpt-4o', 'gpt-4o-mini', 'claude-3-opus', etc.

    -- What type of access was used
    access_type VARCHAR(50), -- 'subscription', 'token_pack', 'free'

    -- Cost tracking (for internal analytics)
    estimated_cost_usd NUMERIC(10, 6), -- Actual API cost

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_token_usage_user ON token_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_usage_creator ON token_usage(creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_usage_session ON token_usage(session_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_access_type ON token_usage(access_type);

-- 2. Creator Token Aggregates (For fast dashboard queries)
CREATE TABLE IF NOT EXISTS creator_token_aggregates (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    creator_id TEXT REFERENCES "User"(id) ON DELETE CASCADE UNIQUE,

    -- Current period (resets monthly)
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT DATE_TRUNC('month', NOW()),
    current_period_end TIMESTAMPTZ NOT NULL DEFAULT DATE_TRUNC('month', NOW()) + INTERVAL '1 month',
    tokens_used_this_period BIGINT DEFAULT 0,

    -- All-time stats
    total_tokens_all_time BIGINT DEFAULT 0,
    total_conversations_all_time INTEGER DEFAULT 0,

    -- Last updated
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creator_token_agg ON creator_token_aggregates(creator_id);

-- 3. User-Creator Token Aggregates (For subscription limits)
CREATE TABLE IF NOT EXISTS user_creator_token_aggregates (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id TEXT REFERENCES "User"(id) ON DELETE CASCADE,
    creator_id TEXT REFERENCES "User"(id) ON DELETE CASCADE,

    -- Current period (resets monthly for subscriptions)
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT DATE_TRUNC('month', NOW()),
    current_period_end TIMESTAMPTZ NOT NULL DEFAULT DATE_TRUNC('month', NOW()) + INTERVAL '1 month',
    tokens_used_this_period BIGINT DEFAULT 0,

    -- All-time with this creator
    total_tokens_all_time BIGINT DEFAULT 0,

    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_user_creator UNIQUE(user_id, creator_id)
);

CREATE INDEX IF NOT EXISTS idx_user_creator_agg ON user_creator_token_aggregates(user_id, creator_id);

-- 4. Token Packs (One-time purchases)
CREATE TABLE IF NOT EXISTS token_packs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id TEXT REFERENCES "User"(id) ON DELETE CASCADE,
    creator_id TEXT REFERENCES "User"(id) ON DELETE CASCADE,

    -- Pack details
    tokens_purchased BIGINT NOT NULL,
    tokens_remaining BIGINT NOT NULL,
    amount_paid_cents INTEGER NOT NULL, -- Stored in cents for precision
    currency VARCHAR(3) DEFAULT 'USD',

    -- Payment info
    stripe_payment_intent_id VARCHAR(255),
    razorpay_order_id VARCHAR(255),
    razorpay_payment_id VARCHAR(255),

    -- Timestamps
    purchased_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_packs_user ON token_packs(user_id);
CREATE INDEX IF NOT EXISTS idx_token_packs_creator ON token_packs(creator_id);
CREATE INDEX IF NOT EXISTS idx_token_packs_remaining ON token_packs(user_id, creator_id, tokens_remaining) WHERE tokens_remaining > 0;

-- =====================================================
-- ALTER EXISTING TABLES
-- =====================================================

-- 5. Update marketplace_subscriptions (Add token tracking)
DO $$
BEGIN
    -- Add token_limit column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'marketplace_subscriptions' AND column_name = 'token_limit'
    ) THEN
        ALTER TABLE marketplace_subscriptions ADD COLUMN token_limit BIGINT;
    END IF;

    -- Add tokens_used_this_period column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'marketplace_subscriptions' AND column_name = 'tokens_used_this_period'
    ) THEN
        ALTER TABLE marketplace_subscriptions ADD COLUMN tokens_used_this_period BIGINT DEFAULT 0;
    END IF;

    -- Add period_start column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'marketplace_subscriptions' AND column_name = 'period_start'
    ) THEN
        ALTER TABLE marketplace_subscriptions ADD COLUMN period_start TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- Add period_end column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'marketplace_subscriptions' AND column_name = 'period_end'
    ) THEN
        ALTER TABLE marketplace_subscriptions ADD COLUMN period_end TIMESTAMPTZ;
    END IF;
END $$;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_subs_user_creator
ON marketplace_subscriptions(user_id, creator_id, status);

-- 6. Update User table (Add creator plan fields)
DO $$
BEGIN
    -- Add plan_tier column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'plan_tier'
    ) THEN
        ALTER TABLE "User" ADD COLUMN plan_tier VARCHAR(50) DEFAULT 'free';
    END IF;

    -- Add plan_token_quota column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'plan_token_quota'
    ) THEN
        ALTER TABLE "User" ADD COLUMN plan_token_quota BIGINT DEFAULT 100000;
    END IF;

    -- Add plan_storage_mb column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'plan_storage_mb'
    ) THEN
        ALTER TABLE "User" ADD COLUMN plan_storage_mb INTEGER DEFAULT 100;
    END IF;

    -- Add storage_used_mb column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'storage_used_mb'
    ) THEN
        ALTER TABLE "User" ADD COLUMN storage_used_mb INTEGER DEFAULT 0;
    END IF;

    -- Add plan_period_start column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'plan_period_start'
    ) THEN
        ALTER TABLE "User" ADD COLUMN plan_period_start TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- Add plan_period_end column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'plan_period_end'
    ) THEN
        ALTER TABLE "User" ADD COLUMN plan_period_end TIMESTAMPTZ;
    END IF;

    -- Add stripe_subscription_id column (reusing for creator plans)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'creator_plan_subscription_id'
    ) THEN
        ALTER TABLE "User" ADD COLUMN creator_plan_subscription_id VARCHAR(255);
    END IF;

    -- Add plan_status column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'plan_status'
    ) THEN
        ALTER TABLE "User" ADD COLUMN plan_status VARCHAR(50) DEFAULT 'active';
    END IF;
END $$;

-- Create index for plan queries
CREATE INDEX IF NOT EXISTS idx_user_plan ON "User"(plan_tier, plan_status);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to get user's token pack balance with a specific creator
CREATE OR REPLACE FUNCTION get_user_token_pack_balance(p_user_id TEXT, p_creator_id TEXT)
RETURNS BIGINT AS $$
DECLARE
    v_balance BIGINT;
BEGIN
    SELECT COALESCE(SUM(tokens_remaining), 0)
    INTO v_balance
    FROM token_packs
    WHERE user_id = p_user_id
    AND creator_id = p_creator_id
    AND tokens_remaining > 0;

    RETURN v_balance;
END;
$$ LANGUAGE plpgsql;

-- Function to get creator's current period usage
CREATE OR REPLACE FUNCTION get_creator_period_usage(p_creator_id TEXT)
RETURNS TABLE (
    tokens_used BIGINT,
    tokens_quota BIGINT,
    percentage_used NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(cta.tokens_used_this_period, 0) AS tokens_used,
        u.plan_token_quota AS tokens_quota,
        CASE
            WHEN u.plan_token_quota > 0 THEN
                ROUND((COALESCE(cta.tokens_used_this_period, 0)::NUMERIC / u.plan_token_quota::NUMERIC) * 100, 2)
            ELSE 0
        END AS percentage_used
    FROM "User" u
    LEFT JOIN creator_token_aggregates cta ON cta.creator_id = u.id
    WHERE u.id = p_creator_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's free tier usage with a creator this month
CREATE OR REPLACE FUNCTION get_user_free_tier_usage(p_user_id TEXT, p_creator_id TEXT)
RETURNS BIGINT AS $$
DECLARE
    v_usage BIGINT;
BEGIN
    SELECT COALESCE(tokens_used_this_period, 0)
    INTO v_usage
    FROM user_creator_token_aggregates
    WHERE user_id = p_user_id
    AND creator_id = p_creator_id
    AND current_period_start = DATE_TRUNC('month', NOW());

    RETURN v_usage;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- DATA MIGRATION
-- =====================================================

-- Initialize creator_token_aggregates for all existing users
INSERT INTO creator_token_aggregates (creator_id, current_period_start, current_period_end, tokens_used_this_period, total_tokens_all_time, total_conversations_all_time)
SELECT
    u.id,
    DATE_TRUNC('month', NOW()),
    DATE_TRUNC('month', NOW()) + INTERVAL '1 month',
    0,
    0,
    0
FROM "User" u
WHERE NOT EXISTS (
    SELECT 1 FROM creator_token_aggregates cta WHERE cta.creator_id = u.id
)
ON CONFLICT (creator_id) DO NOTHING;

-- Set default plan period dates for existing users
UPDATE "User"
SET
    plan_period_start = COALESCE(plan_period_start, NOW()),
    plan_period_end = COALESCE(plan_period_end, NOW() + INTERVAL '30 days')
WHERE plan_period_start IS NULL OR plan_period_end IS NULL;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check table creation
DO $$
BEGIN
    RAISE NOTICE 'Token system tables created successfully:';
    RAISE NOTICE '- token_usage: %', (SELECT COUNT(*) FROM token_usage);
    RAISE NOTICE '- creator_token_aggregates: %', (SELECT COUNT(*) FROM creator_token_aggregates);
    RAISE NOTICE '- user_creator_token_aggregates: %', (SELECT COUNT(*) FROM user_creator_token_aggregates);
    RAISE NOTICE '- token_packs: %', (SELECT COUNT(*) FROM token_packs);
    RAISE NOTICE 'Migration completed successfully!';
END $$;
