import { db } from './db';
import { logger } from './logger';
import { generateId as generateBackendId } from '../utils/idGenerator';

// SQL to create MVP tables only
const createTablesSQL = `
-- CreateTable: User
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "googleId" TEXT,
    "googleEmail" TEXT,
    "googleEmailVerified" BOOLEAN,
    "handle" TEXT,
    "name" TEXT,
    "dob" DATE,
    "phone" TEXT,
    "bio" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" TIMESTAMPTZ,
    "referralCode" TEXT,
    "onboardingCompleted" BOOLEAN DEFAULT false,
    "usernameLastChanged" TIMESTAMP,
    "usernameChangeCount" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastHandleChangeAt" TIMESTAMPTZ NULL,
    "profileCompleted" BOOLEAN NOT NULL DEFAULT false,
    "profileImage" TEXT,
    "timeZone" TEXT,
    "trialEndsAt" TIMESTAMPTZ,
    "planTier" TEXT NOT NULL DEFAULT 'free' CHECK ("planTier" IN ('free','starter','growth','scale')),
    "onboardingStep" TEXT NOT NULL DEFAULT 'quiz' CHECK ("onboardingStep" IN ('quiz','content','voice','plan','deploy','done')),
    "publicSlug" TEXT UNIQUE,
    "creatorTitle" TEXT,
    "creatorTags" JSONB,
    "priceConfig" JSONB,
    "socialLinks" JSONB,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable: OTP
CREATE TABLE IF NOT EXISTS "OTP" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'generic',
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "OTP_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Event (for analytics/event logging)
CREATE TABLE IF NOT EXISTS "Event" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Invite (optional, for referral system)
CREATE TABLE IF NOT EXISTS "Invite" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "inviterId" TEXT,
    "acceptedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable: rate_limits (for rate limiting)
CREATE TABLE IF NOT EXISTS "rate_limits" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "reset_time" BIGINT NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "window_ms" BIGINT NOT NULL,
    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);

-- CreateTable: session (for express-session)
CREATE TABLE IF NOT EXISTS "session" (
    "sid" VARCHAR NOT NULL,
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP NOT NULL,
    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

-- ========== IDENTITY TABLES (NEW MVP) ==========

-- CreateTable: identities (1 per user)
CREATE TABLE IF NOT EXISTS "identities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL UNIQUE,
    "activeVersionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active' CHECK ("status" IN ('active', 'paused')),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable: identity_versions (versioned identity configs)
CREATE TABLE IF NOT EXISTS "identity_versions" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft' CHECK ("status" IN ('draft', 'active', 'archived')),
    "identityJson" JSONB NOT NULL,
    "createdFromVersionId" TEXT,
    "variantGroupId" TEXT,
    "variantLabel" TEXT,
    "variantWeight" INTEGER DEFAULT 50,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "identity_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: mirror_runs (logs every mirror request)
CREATE TABLE IF NOT EXISTS "mirror_runs" (
    "id" TEXT NOT NULL,
    "identityVersionId" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "incomingMessage" TEXT NOT NULL,
    "outputReply" TEXT NOT NULL,
    "rulesApplied" JSONB,
    "model" TEXT,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "costCents" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mirror_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: trust_events (logs user confirmations)
CREATE TABLE IF NOT EXISTS "trust_events" (
    "id" TEXT NOT NULL,
    "mirrorRunId" TEXT NOT NULL,
    "identityVersionId" TEXT NOT NULL,
    "event" TEXT NOT NULL CHECK ("event" IN ('confirm_yes', 'confirm_no', 'edit_rule', 'regenerate')),
    "note" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "trust_events_pkey" PRIMARY KEY ("id")
);

-- ========== INDEXES ==========

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "User_handle_key" ON "User"("handle");
CREATE INDEX IF NOT EXISTS "User_referralCode_idx" ON "User"("referralCode");
CREATE INDEX IF NOT EXISTS "idx_user_onboarding_completed" ON "User"("onboardingCompleted");
CREATE UNIQUE INDEX IF NOT EXISTS "User_googleId_key" ON "User"("googleId");
CREATE INDEX IF NOT EXISTS "OTP_email_purpose_idx" ON "OTP"("email", "purpose");
CREATE UNIQUE INDEX IF NOT EXISTS "Invite_code_key" ON "Invite"("code");
CREATE INDEX IF NOT EXISTS "Event_createdAt_idx" ON "Event"("createdAt");
CREATE INDEX IF NOT EXISTS "Event_type_createdAt_idx" ON "Event"("type", "createdAt");
CREATE INDEX IF NOT EXISTS "Event_userId_createdAt_idx" ON "Event"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "idx_rate_limits_reset_time" ON "rate_limits"("reset_time");
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session"("expire");

-- Identity indexes
CREATE INDEX IF NOT EXISTS "idx_identities_userId" ON "identities"("userId");
CREATE INDEX IF NOT EXISTS "idx_identity_versions_identityId" ON "identity_versions"("identityId");
CREATE INDEX IF NOT EXISTS "idx_identity_versions_status" ON "identity_versions"("status");
CREATE INDEX IF NOT EXISTS "idx_mirror_runs_identityVersionId" ON "mirror_runs"("identityVersionId");
CREATE INDEX IF NOT EXISTS "idx_mirror_runs_createdAt" ON "mirror_runs"("createdAt");
CREATE INDEX IF NOT EXISTS "idx_trust_events_mirrorRunId" ON "trust_events"("mirrorRunId");
CREATE INDEX IF NOT EXISTS "idx_trust_events_identityVersionId" ON "trust_events"("identityVersionId");

-- ========== FOREIGN KEYS ==========

ALTER TABLE "identities" DROP CONSTRAINT IF EXISTS "identities_userId_fkey";
ALTER TABLE "identities" ADD CONSTRAINT "identities_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "identity_versions" DROP CONSTRAINT IF EXISTS "identity_versions_identityId_fkey";
ALTER TABLE "identity_versions" ADD CONSTRAINT "identity_versions_identityId_fkey" 
    FOREIGN KEY ("identityId") REFERENCES "identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mirror_runs" DROP CONSTRAINT IF EXISTS "mirror_runs_identityVersionId_fkey";
ALTER TABLE "mirror_runs" ADD CONSTRAINT "mirror_runs_identityVersionId_fkey" 
    FOREIGN KEY ("identityVersionId") REFERENCES "identity_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "trust_events" DROP CONSTRAINT IF EXISTS "trust_events_mirrorRunId_fkey";
ALTER TABLE "trust_events" ADD CONSTRAINT "trust_events_mirrorRunId_fkey" 
    FOREIGN KEY ("mirrorRunId") REFERENCES "mirror_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "trust_events" DROP CONSTRAINT IF EXISTS "trust_events_identityVersionId_fkey";
ALTER TABLE "trust_events" ADD CONSTRAINT "trust_events_identityVersionId_fkey" 
    FOREIGN KEY ("identityVersionId") REFERENCES "identity_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Invite" DROP CONSTRAINT IF EXISTS "Invite_inviterId_fkey";
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_inviterId_fkey" 
    FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Invite" DROP CONSTRAINT IF EXISTS "Invite_acceptedBy_fkey";
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_acceptedBy_fkey" 
    FOREIGN KEY ("acceptedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Event" DROP CONSTRAINT IF EXISTS "Event_userId_fkey";
ALTER TABLE "Event" ADD CONSTRAINT "Event_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ========== PHASE 1: MIRROR RUNS UPGRADE (infra-grade audit columns) ==========

-- ✅ Mirror runs: add infra-grade audit columns (safe, idempotent)
ALTER TABLE "mirror_runs" ADD COLUMN IF NOT EXISTS "platform" TEXT;
ALTER TABLE "mirror_runs" ADD COLUMN IF NOT EXISTS "decisionAction" TEXT;
ALTER TABLE "mirror_runs" ADD COLUMN IF NOT EXISTS "decisionReason" TEXT;
ALTER TABLE "mirror_runs" ADD COLUMN IF NOT EXISTS "validatorStatus" TEXT;
ALTER TABLE "mirror_runs" ADD COLUMN IF NOT EXISTS "validatorViolations" JSONB;
ALTER TABLE "mirror_runs" ADD COLUMN IF NOT EXISTS "latencyMs" INTEGER;
ALTER TABLE "mirror_runs" ADD COLUMN IF NOT EXISTS "costCents" INTEGER;

-- ✅ Extension tokens (Phase 3, but safe to create now)
CREATE TABLE IF NOT EXISTS "extension_tokens" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "label" TEXT,
  "scopes" JSONB NOT NULL DEFAULT '["mirror:write","identity:read"]'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMPTZ,
  "revokedAt" TIMESTAMPTZ,
  CONSTRAINT "extension_tokens_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_extension_tokens_userId" ON "extension_tokens"("userId");
CREATE INDEX IF NOT EXISTS "idx_extension_tokens_tokenHash_active"
  ON "extension_tokens"("tokenHash")
  WHERE "revokedAt" IS NULL;

ALTER TABLE "extension_tokens" DROP CONSTRAINT IF EXISTS "extension_tokens_userId_fkey";
ALTER TABLE "extension_tokens" ADD CONSTRAINT "extension_tokens_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ========== SUBSCRIPTIONS (Payments) ==========

CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tier" TEXT NOT NULL CHECK ("tier" IN ('free', 'pro', 'teams')),
  "status" TEXT NOT NULL DEFAULT 'active' CHECK ("status" IN ('active', 'cancelled', 'expired', 'past_due')),
  "razorpayOrderId" TEXT,
  "razorpayPaymentId" TEXT,
  "amount" INTEGER NOT NULL, -- paise (₹999 => 99900)
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
  "currentPeriodStart" TIMESTAMPTZ,
  "currentPeriodEnd" TIMESTAMPTZ,
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "cancelledAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_userId_active_idx"
  ON "subscriptions"("userId")
  WHERE "status" = 'active';

CREATE INDEX IF NOT EXISTS "idx_subscriptions_userId" ON "subscriptions"("userId");
CREATE INDEX IF NOT EXISTS "idx_subscriptions_razorpayOrderId" ON "subscriptions"("razorpayOrderId");
CREATE INDEX IF NOT EXISTS "idx_subscriptions_razorpayPaymentId" ON "subscriptions"("razorpayPaymentId");

ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "subscriptions_userId_fkey";
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ========== VOICE CLONING ==========

CREATE TABLE IF NOT EXISTS "voice_clones" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "voiceId" TEXT, -- ElevenLabs voice_id or provider-specific ID
  "label" TEXT, -- e.g., "Professional", "Casual", "Energetic"
  "sampleAudioUrl" TEXT, -- S3/Cloudinary URL of uploaded sample
  "provider" TEXT NOT NULL DEFAULT 'elevenlabs' CHECK ("provider" IN ('elevenlabs', 'playht', 'coqui')),
  "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'training', 'ready', 'failed')),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "voice_clones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_voice_clones_userId" ON "voice_clones"("userId");
CREATE INDEX IF NOT EXISTS "idx_voice_clones_status" ON "voice_clones"("userId", "status");

ALTER TABLE "voice_clones" DROP CONSTRAINT IF EXISTS "voice_clones_userId_fkey";
ALTER TABLE "voice_clones" ADD CONSTRAINT "voice_clones_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ========== PLATFORM INTEGRATIONS (Phase 1: Instagram/WhatsApp) ==========
CREATE TABLE IF NOT EXISTS "platform_integrations" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "platform" TEXT NOT NULL, -- 'instagram' | 'whatsapp'
  "accessToken" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active' CHECK ("status" IN ('active','paused','disconnected')),
  "config" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_platform_integrations_userId" ON "platform_integrations"("userId");
CREATE INDEX IF NOT EXISTS "idx_platform_integrations_platform" ON "platform_integrations"("platform");

ALTER TABLE "platform_integrations" DROP CONSTRAINT IF EXISTS "platform_integrations_userId_fkey";
ALTER TABLE "platform_integrations" ADD CONSTRAINT "platform_integrations_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ========== WIDGET CHAT LOGS (Phase 1: Website embed analytics) ==========
CREATE TABLE IF NOT EXISTS "widget_chat_logs" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL, -- creator
  "visitorId" TEXT,
  "message" TEXT NOT NULL,
  "reply" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_widget_chat_logs_userId" ON "widget_chat_logs"("userId");
CREATE INDEX IF NOT EXISTS "idx_widget_chat_logs_createdAt" ON "widget_chat_logs"("createdAt");

ALTER TABLE "widget_chat_logs" DROP CONSTRAINT IF EXISTS "widget_chat_logs_userId_fkey";
ALTER TABLE "widget_chat_logs" ADD CONSTRAINT "widget_chat_logs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ========== KNOWLEDGE BASE (Content Upload) ==========
CREATE TABLE IF NOT EXISTS "knowledge_sources" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL CHECK ("type" IN ('paste','file','youtube','url','twitter','linkedin','medium')),
  "title" TEXT,
  "originalUrl" TEXT,
  "storageUrl" TEXT,
  "rawText" TEXT,
  "status" TEXT NOT NULL DEFAULT 'processed' CHECK ("status" IN ('pending','processing','processed','failed')),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastFetchedAt" TIMESTAMPTZ,
  "fetchMetadata" JSONB
);

CREATE TABLE IF NOT EXISTS "knowledge_chunks" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "chunkIndex" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "embedding" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add embedding column if it doesn't exist (for existing databases)
ALTER TABLE "knowledge_chunks" ADD COLUMN IF NOT EXISTS "embedding" JSONB;

CREATE INDEX IF NOT EXISTS "idx_knowledge_sources_userId" ON "knowledge_sources"("userId");
CREATE INDEX IF NOT EXISTS "idx_knowledge_chunks_userId" ON "knowledge_chunks"("userId");
CREATE INDEX IF NOT EXISTS "idx_knowledge_chunks_sourceId" ON "knowledge_chunks"("sourceId");

ALTER TABLE "knowledge_sources" DROP CONSTRAINT IF EXISTS "knowledge_sources_userId_fkey";
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "knowledge_chunks" DROP CONSTRAINT IF EXISTS "knowledge_chunks_userId_fkey";
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "knowledge_chunks" DROP CONSTRAINT IF EXISTS "knowledge_chunks_sourceId_fkey";
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "knowledge_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ========== CHAT HISTORY ==========
CREATE TABLE IF NOT EXISTS "chat_sessions" (
  "id" TEXT PRIMARY KEY,
  "creatorId" TEXT NOT NULL,
  "visitorId" TEXT,
  "userId" TEXT,
  "platform" TEXT NOT NULL DEFAULT 'web',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id" TEXT PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "role" TEXT NOT NULL CHECK ("role" IN ('user','assistant')),
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_chat_sessions_creatorId_createdAt" ON "chat_sessions"("creatorId","createdAt");
CREATE INDEX IF NOT EXISTS "idx_chat_messages_sessionId_createdAt" ON "chat_messages"("sessionId","createdAt");

ALTER TABLE "chat_sessions" DROP CONSTRAINT IF EXISTS "chat_sessions_creatorId_fkey";
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_creatorId_fkey"
  FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_messages" DROP CONSTRAINT IF EXISTS "chat_messages_sessionId_fkey";
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ========== STRIPE ==========
CREATE TABLE IF NOT EXISTS "stripe_customers" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "stripeCustomerId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_stripe_customers_userId" ON "stripe_customers"("userId");

ALTER TABLE "stripe_customers" DROP CONSTRAINT IF EXISTS "stripe_customers_userId_fkey";
ALTER TABLE "stripe_customers" ADD CONSTRAINT "stripe_customers_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "stripe_payments" (
  "id" TEXT PRIMARY KEY,
  "creatorId" TEXT NOT NULL,
  "payerUserId" TEXT,
  "payerVisitorId" TEXT,
  "sessionId" TEXT,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" TEXT NOT NULL DEFAULT 'created' CHECK ("status" IN ('created','succeeded','failed','refunded')),
  "stripePaymentIntentId" TEXT,
  "platformFeeCents" INTEGER,
  "creatorEarningsCents" INTEGER,
  "type" TEXT DEFAULT 'subscription',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_stripe_payments_creatorId_createdAt" ON "stripe_payments"("creatorId","createdAt");
CREATE INDEX IF NOT EXISTS "idx_stripe_payments_sessionId" ON "stripe_payments"("sessionId");

ALTER TABLE "stripe_payments" DROP CONSTRAINT IF EXISTS "stripe_payments_creatorId_fkey";
ALTER TABLE "stripe_payments" ADD CONSTRAINT "stripe_payments_creatorId_fkey"
  FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add missing columns to stripe_payments (idempotent)
ALTER TABLE "stripe_payments" ADD COLUMN IF NOT EXISTS "platformFeeCents" INTEGER;
ALTER TABLE "stripe_payments" ADD COLUMN IF NOT EXISTS "creatorEarningsCents" INTEGER;
ALTER TABLE "stripe_payments" ADD COLUMN IF NOT EXISTS "type" TEXT DEFAULT 'subscription';
ALTER TABLE "stripe_payments" ADD COLUMN IF NOT EXISTS "payoutId" TEXT;

-- Create stripe_payouts table
CREATE TABLE IF NOT EXISTS "stripe_payouts" (
  "id" TEXT PRIMARY KEY,
  "creatorId" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending','processing','completed','failed')),
  "stripePayoutId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS "idx_stripe_payouts_creatorId" ON "stripe_payouts"("creatorId");
CREATE INDEX IF NOT EXISTS "idx_stripe_payouts_status" ON "stripe_payouts"("status");

ALTER TABLE "stripe_payouts" DROP CONSTRAINT IF EXISTS "stripe_payouts_creatorId_fkey";
ALTER TABLE "stripe_payouts" ADD CONSTRAINT "stripe_payouts_creatorId_fkey"
  FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add missing columns to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMPTZ;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "planTier" TEXT NOT NULL DEFAULT 'free';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripeConnectId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "payoutEnabled" BOOLEAN DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "businessHours" JSONB;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notificationPreferences" JSONB;

-- Add missing columns to mirror_runs
ALTER TABLE "mirror_runs" ADD COLUMN IF NOT EXISTS "sessionId" TEXT;
ALTER TABLE "mirror_runs" ADD COLUMN IF NOT EXISTS "visitorId" TEXT;

-- Create missing tables
CREATE TABLE IF NOT EXISTS "active_sessions" (
  "id" TEXT PRIMARY KEY,
  "creatorId" TEXT NOT NULL,
  "visitorId" TEXT,
  "sessionId" TEXT,
  "lastActiveAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_active_sessions_creatorId" ON "active_sessions"("creatorId");
CREATE INDEX IF NOT EXISTS "idx_active_sessions_lastActiveAt" ON "active_sessions"("lastActiveAt");

-- Auth sessions table (for tracking user login sessions across devices)
CREATE TABLE IF NOT EXISTS "auth_sessions" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "deviceInfo" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "lastActiveAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "revokedAt" TIMESTAMPTZ,
  "refreshToken" TEXT UNIQUE,
  "refreshTokenExpiresAt" TIMESTAMPTZ,
  "previousRefreshToken" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_auth_sessions_userId" ON "auth_sessions"("userId");
CREATE INDEX IF NOT EXISTS "idx_auth_sessions_lastActiveAt" ON "auth_sessions"("lastActiveAt");
CREATE INDEX IF NOT EXISTS "idx_auth_sessions_expiresAt" ON "auth_sessions"("expiresAt");
CREATE INDEX IF NOT EXISTS "idx_auth_sessions_revokedAt" ON "auth_sessions"("revokedAt") WHERE "revokedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_auth_sessions_refreshToken" ON "auth_sessions"("refreshToken") WHERE "refreshToken" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_auth_sessions_refreshTokenExpiresAt" ON "auth_sessions"("refreshTokenExpiresAt");

CREATE TABLE IF NOT EXISTS "blocked_topics" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "payout_requests" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "stripeTransferId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS "email_logs" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT,
  "type" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "sentAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

export async function initializeDatabase() {
  try {
    await db.query(createTablesSQL);
    logger.info('✅ Database tables initialized (MVP only)');
  } catch (error) {
    logger.error('Error initializing database:', error);
    throw error;
  }
}

// ========== USER QUERIES ==========
export const userQueries = {
  create: async (email: string, handle?: string, passwordHash?: string, referralCode?: string) => {
    const id = generateBackendId.user();
    // Use CURRENT_TIMESTAMP instead of Date object to avoid timezone/format issues
    const result = await db.query(
      'INSERT INTO "User" (id, email, handle, "passwordHash", "referralCode", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *',
      [id, email, handle, passwordHash, referralCode]
    );
    return result.rows[0];
  },

  findByEmail: async (email: string) => {
    const result = await db.query(
      'SELECT id, email, "passwordHash", "googleId", "googleEmail", "googleEmailVerified", handle, name, dob, phone, bio, active, "referralCode", "createdAt", "profileImage", "lastHandleChangeAt", "profileCompleted", "timeZone", "trialEndsAt", "planTier", "onboardingStep", "publicSlug", "creatorTitle", "creatorTags", "priceConfig" FROM "User" WHERE email = $1',
      [email]
    );
    return result.rows[0];
  },

  findById: async (id: string) => {
    const result = await db.query(
      'SELECT id, email, "passwordHash", "googleId", "googleEmail", "googleEmailVerified", handle, name, dob, phone, bio, active, "referralCode", "createdAt", "profileImage", "trialEndsAt", "planTier", "onboardingStep", "publicSlug", "creatorTitle", "creatorTags", "priceConfig" FROM "User" WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },

  findByReferralCode: async (referralCode: string) => {
    const result = await db.query(
      'SELECT id, email, "passwordHash", "googleId", "googleEmail", "googleEmailVerified", handle, name, dob, phone, bio, active, "referralCode", "createdAt", "profileImage" FROM "User" WHERE "referralCode" = $1',
      [referralCode]
    );
    return result.rows[0];
  },

  updatePassword: async (email: string, passwordHash: string) => {
    const result = await db.query(
      'UPDATE "User" SET "passwordHash" = $1 WHERE email = $2 RETURNING *',
      [passwordHash, email]
    );
    return result.rows[0];
  },

  activateUser: async (email: string) => {
    const result = await db.query(
      'UPDATE "User" SET active = true WHERE email = $1 RETURNING *',
      [email]
    );
    return result.rows[0];
  },

  updateProfile: async (
    email: string,
    name: string,
    handle: string,
    dob: string | null,
    phone: string,
    bio: string,
    profileImage?: string | null,
    timeZone?: string | null
  ) => {
    let dobString: string | null = null;
    if (dob !== null && dob !== undefined) {
      const dobValue = dob as any;
      if (typeof dobValue === 'object' && 'toISOString' in dobValue && typeof dobValue.toISOString === 'function') {
        dobString = dobValue.toISOString().split('T')[0];
      } else if (typeof dobValue === 'string') {
        dobString = dobValue.trim();
      }
    }
    const dobValue = dobString && dobString.length > 0 ? dobString : null;
    
    const profileImageValue = profileImage === undefined 
      ? null
      : (profileImage === null || profileImage === '' 
          ? null
          : profileImage);
    
    const result = await db.query(
      `UPDATE "User"
       SET
         name = $1,
         handle = $2,
         dob = COALESCE($3::date, dob),
         phone = $4,
         bio = $5,
         "profileImage" = $6,
         "timeZone" = COALESCE($7, "timeZone"),
         "profileCompleted" = true
       WHERE email = $8
       RETURNING *`,
      [name, handle, dobValue, phone, bio, profileImageValue, timeZone || null, email]
    );
    
    return result.rows[0];
  },

  findByGoogleId: async (googleId: string) => {
    const result = await db.query(
      'SELECT id, email, "passwordHash", "googleId", "googleEmail", "googleEmailVerified", handle, name, dob, phone, bio, active, "referralCode", "createdAt", "profileImage", "lastHandleChangeAt", "profileCompleted" FROM "User" WHERE "googleId" = $1',
      [googleId]
    );
    return result.rows[0];
  },

  linkGoogleByEmail: async (email: string, googleId: string, googleEmail?: string, googleEmailVerified?: boolean) => {
    const result = await db.query(
      `UPDATE "User" 
       SET "googleId" = $1, "googleEmail" = $2, "googleEmailVerified" = $3, active = true, "updatedAt" = $4
       WHERE email = $5 
       RETURNING *`,
      [googleId, googleEmail || null, googleEmailVerified || false, new Date(), email]
    );
    return result.rows[0];
  },

  findBySlugOrHandle: async (slugOrHandle: string) => {
    const r = await db.query(
      `SELECT * FROM "User"
       WHERE "publicSlug"=$1 OR handle=$1
       LIMIT 1`,
      [slugOrHandle]
    );
    return r.rows[0] || null;
  },

  updatePricing: async (userId: string, priceConfig: any) => {
    const r = await db.query(
      `UPDATE "User" SET "priceConfig"=$1, "updatedAt"=CURRENT_TIMESTAMP WHERE id=$2 RETURNING *`,
      [JSON.stringify(priceConfig), userId]
    );
    return r.rows[0];
  },

  startTrial: async (userId: string, days = 7) => {
    const r = await db.query(
      `UPDATE "User"
       SET "trialEndsAt" = (now() + ($1 || ' days')::interval),
           "updatedAt"=CURRENT_TIMESTAMP
       WHERE id=$2
       RETURNING *`,
      [String(days), userId]
    );
    return r.rows[0];
  },
};

// ========== OTP QUERIES ==========
export const otpQueries = {
  create: async (email: string, codeHash: string, expiresAt: Date, purpose: string) => {
    const id = generateBackendId.otp();
    // Convert Date to ISO string to avoid timestamp format issues
    const expiresAtString = expiresAt instanceof Date ? expiresAt.toISOString() : expiresAt;
    const result = await db.query(
      'INSERT INTO "OTP" (id, email, purpose, "codeHash", "expiresAt") VALUES ($1, $2, $3, $4, $5::timestamptz) RETURNING *',
      [id, email, purpose, codeHash, expiresAtString]
    );
    return result.rows[0];
  },

  findByEmail: async (email: string, purpose: string) => {
    const result = await db.query(
      'SELECT id, email, purpose, "codeHash", "expiresAt", "createdAt", used FROM "OTP" WHERE email = $1 AND purpose = $2 ORDER BY "createdAt" DESC LIMIT 1',
      [email, purpose]
    );    
    return result.rows[0];
  },

  markAsUsed: async (id: string) => {
    const result = await db.query('UPDATE "OTP" SET used = true WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  },

  deleteByEmail: async (email: string, purpose?: string) => {
    if (purpose) {
      await db.query('DELETE FROM "OTP" WHERE email = $1 AND purpose = $2', [email.toLowerCase(), purpose]);
      return;
    }
    await db.query('DELETE FROM "OTP" WHERE email = $1', [email.toLowerCase()]);
  }
};

// ========== IDENTITY QUERIES (NEW) ==========
export const identityQueries = {
  create: async (userId: string) => {
    const id = `identity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    const result = await db.query(
      'INSERT INTO "identities" (id, "userId", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4) RETURNING *',
      [id, userId, now, now]
    );
    return result.rows[0];
  },

  findByUserId: async (userId: string) => {
    const result = await db.query(
      'SELECT * FROM "identities" WHERE "userId" = $1',
      [userId]
    );
    return result.rows[0] || null;
  },

  findById: async (identityId: string) => {
    const result = await db.query(
      'SELECT * FROM "identities" WHERE id = $1',
      [identityId]
    );
    return result.rows[0] || null;
  },

  updateActiveVersion: async (identityId: string, activeVersionId: string) => {
    const result = await db.query(
      'UPDATE "identities" SET "activeVersionId" = $1, "updatedAt" = $2 WHERE id = $3 RETURNING *',
      [activeVersionId, new Date(), identityId]
    );
    return result.rows[0];
  }
};

export const identityVersionQueries = {
  create: async (identityId: string, version: string, identityJson: any, createdFromVersionId?: string) => {
    const id = `identity_v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const result = await db.query(
      'INSERT INTO "identity_versions" (id, "identityId", version, "identityJson", "createdFromVersionId", status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [id, identityId, version, JSON.stringify(identityJson), createdFromVersionId || null, 'draft']
    );
    return result.rows[0];
  },
  
  findById: async (versionId: string) => {
    const result = await db.query(
      'SELECT * FROM "identity_versions" WHERE id = $1',
      [versionId]
      );
      return result.rows[0] || null;
    },

  findByIdentityId: async (identityId: string, status?: string) => {
    let query = 'SELECT * FROM "identity_versions" WHERE "identityId" = $1';
    const params: any[] = [identityId];
    if (status) {
      query += ' AND status = $2';
      params.push(status);
    }
    query += ' ORDER BY "createdAt" DESC';
    const result = await db.query(query, params);
    return result.rows;
  },

  updateStatus: async (versionId: string, status: 'draft' | 'active' | 'archived') => {
    const result = await db.query(
      'UPDATE "identity_versions" SET status = $1 WHERE id = $2 RETURNING *',
      [status, versionId]
    );
    return result.rows[0];
  },

  updateIdentityJson: async (versionId: string, identityJson: any) => {
    const result = await db.query(
      'UPDATE "identity_versions" SET "identityJson" = $1 WHERE id = $2 RETURNING *',
      [JSON.stringify(identityJson), versionId]
    );
    return result.rows[0];
  }
};

export const mirrorRunQueries = {
  create: async (
    identityVersionId: string,
    context: string,
    incomingMessage: string,
    outputReply: string,
    rulesApplied?: any,
    model?: string,
    tokensIn?: number,
    tokensOut?: number,
    costCents?: number,
    meta?: {
      platform?: 'web' | 'gmail' | 'linkedin' | 'api';
      decisionAction?: 'reply' | 'ignore' | 'defer' | 'clarify';
      decisionReason?: string;
      validatorStatus?: 'pass' | 'fail' | 'skipped';
      validatorViolations?: string[];
      latencyMs?: number;
    }
  ) => {
    const id = `mirror_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const result = await db.query(
      `
      INSERT INTO "mirror_runs"
        (id, "identityVersionId", context, "incomingMessage", "outputReply", "rulesApplied",
         model, "tokensIn", "tokensOut", "costCents",
         "platform", "decisionAction", "decisionReason", "validatorStatus", "validatorViolations", "latencyMs")
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *
      `,
      [
        id,
        identityVersionId,
        context,
        incomingMessage,
        outputReply,
        rulesApplied ? JSON.stringify(rulesApplied) : null,
        model || null,
        tokensIn ?? null,
        tokensOut ?? null,
        costCents ?? null,
        meta?.platform || 'web',
        meta?.decisionAction || null,
        meta?.decisionReason || null,
        meta?.validatorStatus || null,
        meta?.validatorViolations ? JSON.stringify(meta.validatorViolations) : null,
        meta?.latencyMs ?? null,
      ]
    );

    return result.rows[0];
  },  

  findById: async (runId: string) => {
    const result = await db.query(
      'SELECT * FROM "mirror_runs" WHERE id = $1',
      [runId]
    );
    return result.rows[0] || null;
  },

  sumTokensForUserSince: async (userId: string, since: Date) => {
    const result = await db.query(
      `
      SELECT COALESCE(SUM(COALESCE(mr."tokensIn", 0) + COALESCE(mr."tokensOut", 0)), 0) AS tokens
      FROM "mirror_runs" mr
      JOIN "identity_versions" iv ON iv.id = mr."identityVersionId"
      JOIN "identities" i ON i.id = iv."identityId"
      WHERE i."userId" = $1
        AND mr."createdAt" >= $2
      `,
      [userId, since]
    );
    return Number(result.rows[0]?.tokens || 0);
  },
};

export const trustEventQueries = {
  create: async (
    mirrorRunId: string,
    identityVersionId: string,
    event: 'confirm_yes' | 'confirm_no' | 'edit_rule' | 'regenerate',
    note?: string
  ) => {
    const id = `trust_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const result = await db.query(
      'INSERT INTO "trust_events" (id, "mirrorRunId", "identityVersionId", event, note) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [id, mirrorRunId, identityVersionId, event, note || null]
    );
    return result.rows[0];
  }
};

export const extensionTokenQueries = {
  create: async (userId: string, tokenHash: string, label?: string, scopes?: string[]) => {
    const id = `exttok_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const result = await db.query(
      `
      INSERT INTO "extension_tokens" (id, "userId", "tokenHash", "label", "scopes")
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [id, userId, tokenHash, label || null, JSON.stringify(scopes || ['mirror:write', 'identity:read'])]
    );
    return result.rows[0];
  },

  listForUser: async (userId: string) => {
    const result = await db.query(
      `
      SELECT id, "label", "scopes", "createdAt", "lastUsedAt", "revokedAt"
      FROM "extension_tokens"
      WHERE "userId" = $1
      ORDER BY "createdAt" DESC
      `,
      [userId]
    );
    return result.rows;
  },

  findActiveByIdForUser: async (userId: string, tokenId: string) => {
    const result = await db.query(
      `
      SELECT *
      FROM "extension_tokens"
      WHERE "userId" = $1 AND id = $2 AND "revokedAt" IS NULL
      `,
      [userId, tokenId]
    );
    return result.rows[0] || null;
  },

  // We can't search by hash because we're using bcrypt (salted).
  // So we verify by checking all active tokens for user and bcrypt.compare.
  listActiveForUser: async (userId: string) => {
    const result = await db.query(
      `
      SELECT id, "userId", "tokenHash", "label", "scopes", "createdAt", "lastUsedAt"
      FROM "extension_tokens"
      WHERE "userId" = $1 AND "revokedAt" IS NULL
      ORDER BY "createdAt" DESC
      `,
      [userId]
    );
    return result.rows;
  },

  updateLastUsedAt: async (tokenId: string) => {
    await db.query(
      `UPDATE "extension_tokens" SET "lastUsedAt" = CURRENT_TIMESTAMP WHERE id = $1`,
      [tokenId]
    );
  },

  revoke: async (userId: string, tokenId: string) => {
    const result = await db.query(
      `
      UPDATE "extension_tokens"
      SET "revokedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = $1 AND id = $2 AND "revokedAt" IS NULL
      RETURNING id, "revokedAt"
      `,
      [userId, tokenId]
    );
    return result.rows[0] || null;
  },
};

// ========== VOICE CLONE QUERIES ==========
export const voiceCloneQueries = {
  create: async (userId: string, label?: string, provider: 'elevenlabs' | 'playht' | 'coqui' = 'elevenlabs') => {
    const id = `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    const result = await db.query(
      `INSERT INTO "voice_clones" (id, "userId", label, provider, status, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, userId, label || null, provider, 'pending', now, now]
    );
    return result.rows[0];
  },

  findByUserId: async (userId: string) => {
    const result = await db.query(
      `SELECT * FROM "voice_clones" WHERE "userId" = $1 ORDER BY "createdAt" DESC`,
      [userId]
    );
    return result.rows;
  },

  findById: async (voiceId: string) => {
    const result = await db.query(
      `SELECT * FROM "voice_clones" WHERE id = $1`,
      [voiceId]
    );
    return result.rows[0] || null;
  },

  updateStatus: async (id: string, status: 'pending' | 'training' | 'ready' | 'failed') => {
    const result = await db.query(
      `UPDATE "voice_clones" SET status = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return result.rows[0];
  },

  updateVoiceId: async (id: string, voiceId: string, sampleAudioUrl?: string) => {
    const result = await db.query(
      `UPDATE "voice_clones"
       SET "voiceId" = $1, "sampleAudioUrl" = COALESCE($2, "sampleAudioUrl"), "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [voiceId, sampleAudioUrl || null, id]
    );
    return result.rows[0];
  },

  delete: async (userId: string, voiceId: string) => {
    const result = await db.query(
      `DELETE FROM "voice_clones" WHERE id = $1 AND "userId" = $2 RETURNING *`,
      [voiceId, userId]
    );
    return result.rows[0] || null;
  }
};

// ========== PLATFORM INTEGRATION QUERIES ==========
export const platformIntegrationQueries = {
  upsert: async (userId: string, platform: string, accessToken: string | null, config: any) => {
    const id = `pi_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const r = await db.query(
      `INSERT INTO "platform_integrations"(id,"userId",platform,"accessToken",status,config,"createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,'active',$5,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       RETURNING *`,
      [id, userId, platform, accessToken, config ? JSON.stringify(config) : null]
    );
    return r.rows[0];
  },

  listByUserId: async (userId: string) => {
    const r = await db.query(`SELECT * FROM "platform_integrations" WHERE "userId"=$1 ORDER BY "createdAt" DESC`, [userId]);
    return r.rows;
  },

  findByPlatformAndConfigField: async (platform: string, field: string, value: string) => {
    // field example: toNumber
    const r = await db.query(
      `SELECT * FROM "platform_integrations"
       WHERE platform=$1 AND (config->>$2) = $3 AND status='active'
       ORDER BY "createdAt" DESC
       LIMIT 1`,
      [platform, field, value]
    );
    return r.rows[0] || null;
  },
};

// ========== WIDGET CHAT LOG QUERIES ==========
export const widgetChatLogQueries = {
  create: async (userId: string, visitorId: string | null, message: string, reply: string) => {
    const id = `wlog_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const r = await db.query(
      `INSERT INTO "widget_chat_logs"(id,"userId","visitorId","message","reply","createdAt")
       VALUES ($1,$2,$3,$4,$5,CURRENT_TIMESTAMP)
       RETURNING *`,
      [id, userId, visitorId, message, reply]
    );
    return r.rows[0];
  },
};

// ========== KNOWLEDGE BASE QUERIES ==========
export const knowledgeSourceQueries = {
  create: async (params: { userId: string; type: string; title?: string; originalUrl?: string; storageUrl?: string; rawText?: string }) => {
    const id = `ks_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const r = await db.query(
      `INSERT INTO "knowledge_sources" (id,"userId","type","title","originalUrl","storageUrl","rawText","status","lastFetchedAt","fetchMetadata")
       VALUES ($1,$2,$3,$4,$5,$6,$7,'processed',NOW(),$8)
       RETURNING *`,
      [id, params.userId, params.type, params.title || null, params.originalUrl || null, params.storageUrl || null, params.rawText || null, JSON.stringify({})]
    );
    return r.rows[0];
  },
  update: async (id: string, updates: { rawText?: string; lastFetchedAt?: Date; fetchMetadata?: any }) => {
    const updatesList: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.rawText !== undefined) {
      updatesList.push(`"rawText" = $${paramIndex++}`);
      values.push(updates.rawText);
    }
    if (updates.lastFetchedAt !== undefined) {
      updatesList.push(`"lastFetchedAt" = $${paramIndex++}`);
      values.push(updates.lastFetchedAt);
    }
    if (updates.fetchMetadata !== undefined) {
      updatesList.push(`"fetchMetadata" = $${paramIndex++}`);
      values.push(JSON.stringify(updates.fetchMetadata));
    }

    if (updatesList.length === 0) return;

    values.push(id);
    await db.query(
      `UPDATE "knowledge_sources" SET ${updatesList.join(', ')} WHERE id = $${paramIndex}`,
      values
    );
  },
  listByUserId: async (userId: string) => {
    const r = await db.query(`SELECT * FROM "knowledge_sources" WHERE "userId"=$1 ORDER BY "createdAt" DESC`, [userId]);
    return r.rows;
  },
  deleteByIdForUser: async (userId: string, id: string) => {
    await db.query(`DELETE FROM "knowledge_sources" WHERE "userId"=$1 AND id=$2`, [userId, id]);
  },
};

export const knowledgeChunkQueries = {
  replaceForSource: async (userId: string, sourceId: string, chunks: string[]) => {
    await db.query(`DELETE FROM "knowledge_chunks" WHERE "userId"=$1 AND "sourceId"=$2`, [userId, sourceId]);
    for (let i = 0; i < chunks.length; i++) {
      const id = `kc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}_${i}`;
      await db.query(
        `INSERT INTO "knowledge_chunks" (id,"userId","sourceId","chunkIndex","content") VALUES ($1,$2,$3,$4,$5)`,
        [id, userId, sourceId, i, chunks[i]]
      );
    }
  },
};

// ========== CHAT HISTORY QUERIES ==========
export const chatSessionQueries = {
  create: async (params: { creatorId: string; visitorId?: string | null; userId?: string | null; platform?: string }) => {
    const id = `cs_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const r = await db.query(
      `INSERT INTO "chat_sessions" (id,"creatorId","visitorId","userId","platform")
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [id, params.creatorId, params.visitorId || null, params.userId || null, params.platform || 'web']
    );
    return r.rows[0];
  },
  findById: async (id: string) => {
    const r = await db.query(`SELECT * FROM "chat_sessions" WHERE id=$1`, [id]);
    return r.rows[0] || null;
  },
};

export const chatMessageQueries = {
  add: async (params: { sessionId: string; role: 'user' | 'assistant'; content: string }) => {
    const id = `cm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const r = await db.query(
      `INSERT INTO "chat_messages" (id,"sessionId","role","content") VALUES ($1,$2,$3,$4) RETURNING *`,
      [id, params.sessionId, params.role, params.content]
    );
    return r.rows[0];
  },
  listForSession: async (sessionId: string) => {
    const r = await db.query(`SELECT * FROM "chat_messages" WHERE "sessionId"=$1 ORDER BY "createdAt" ASC`, [sessionId]);
    return r.rows;
  },
  countBySession: async (sessionId: string) => {
    const r = await db.query(
      `SELECT COUNT(*) as count FROM "chat_messages" WHERE "sessionId"=$1 AND "role"='user'`,
      [sessionId]
    );
    return parseInt(r.rows[0]?.count || '0', 10);
  },
};

// ========== STRIPE PAYMENT QUERIES ==========
export const stripePaymentQueries = {
  create: async (params: { creatorId: string; payerUserId?: string | null; payerVisitorId?: string | null; sessionId?: string | null; amount: number; currency?: string; status?: string; stripePaymentIntentId?: string | null; platformFeeCents?: number | null; creatorEarningsCents?: number | null; type?: string }) => {
    const id = `sp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const r = await db.query(
      `INSERT INTO "stripe_payments" (id,"creatorId","payerUserId","payerVisitorId","sessionId","amount","currency","status","stripePaymentIntentId","platformFeeCents","creatorEarningsCents","type")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [id, params.creatorId, params.payerUserId || null, params.payerVisitorId || null, params.sessionId || null, params.amount, params.currency || 'USD', params.status || 'created', params.stripePaymentIntentId || null, params.platformFeeCents || null, params.creatorEarningsCents || null, params.type || 'subscription']
    );
    return r.rows[0];
  },
  sumForCreatorSince: async (creatorId: string, sinceIso: string) => {
    const r = await db.query(
      `SELECT COALESCE(SUM(amount),0)::int AS total
       FROM "stripe_payments"
       WHERE "creatorId"=$1 AND "status"='succeeded' AND "createdAt">=$2::timestamptz`,
      [creatorId, sinceIso]
    );
    return r.rows[0]?.total || 0;
  },
  sumPayPerChatEarningsSince: async (creatorId: string, sinceIso: string) => {
    const r = await db.query(
      `SELECT COALESCE(SUM("creatorEarningsCents"),0)::int AS total
       FROM "stripe_payments"
       WHERE "creatorId"=$1 AND "status"='succeeded' AND "type"='pay_per_chat' AND "createdAt">=$2::timestamptz`,
      [creatorId, sinceIso]
    );
    return r.rows[0]?.total || 0;
  },
  sumSubscriptionRevenueSince: async (creatorId: string, sinceIso: string) => {
    const r = await db.query(
      `SELECT COALESCE(SUM(amount),0)::int AS total
       FROM "stripe_payments"
       WHERE "creatorId"=$1 AND "status"='succeeded' AND "type"='subscription' AND "createdAt">=$2::timestamptz`,
      [creatorId, sinceIso]
    );
    return r.rows[0]?.total || 0;
  },
};

// Export db for direct use
export { db };
