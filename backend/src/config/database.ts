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
    "referralCode" TEXT,
    "onboardingCompleted" BOOLEAN DEFAULT false,
    "usernameLastChanged" TIMESTAMP,
    "usernameChangeCount" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastHandleChangeAt" TIMESTAMPTZ NULL,
    "profileCompleted" BOOLEAN NOT NULL DEFAULT false,
    "profileImage" TEXT,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable: OTP
CREATE TABLE IF NOT EXISTS "OTP" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'generic',
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mirror_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: trust_events (logs user confirmations)
CREATE TABLE IF NOT EXISTS "trust_events" (
    "id" TEXT NOT NULL,
    "mirrorRunId" TEXT NOT NULL,
    "identityVersionId" TEXT NOT NULL,
    "event" TEXT NOT NULL CHECK ("event" IN ('confirm_yes', 'confirm_no', 'edit_rule', 'regenerate')),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    const now = new Date();
    const result = await db.query(
      'INSERT INTO "User" (id, email, handle, "passwordHash", "referralCode", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [id, email, handle, passwordHash, referralCode, now, now]
    );
    return result.rows[0];
  },

  findByEmail: async (email: string) => {
    const result = await db.query(
      'SELECT id, email, "passwordHash", "googleId", "googleEmail", "googleEmailVerified", handle, name, dob, phone, bio, active, "referralCode", "createdAt", "profileImage", "lastHandleChangeAt", "profileCompleted" FROM "User" WHERE email = $1',
      [email]
    );
    return result.rows[0];
  },

  findById: async (id: string) => {
    const result = await db.query(
      'SELECT id, email, "passwordHash", "googleId", "googleEmail", "googleEmailVerified", handle, name, dob, phone, bio, active, "referralCode", "createdAt", "profileImage" FROM "User" WHERE id = $1',
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
    profileImage?: string | null
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
         "profileCompleted" = true
       WHERE email = $7
       RETURNING *`,
      [name, handle, dobValue, phone, bio, profileImageValue, email]
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
  }
};

// ========== OTP QUERIES ==========
export const otpQueries = {
  create: async (email: string, codeHash: string, expiresAt: Date, purpose: string) => {
    const id = generateBackendId.otp();
    const result = await db.query(
      'INSERT INTO "OTP" (id, email, purpose, "codeHash", "expiresAt") VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [id, email, purpose, codeHash, expiresAt]
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
    tokensOut?: number
  ) => {
    const id = `mirror_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const result = await db.query(
      'INSERT INTO "mirror_runs" (id, "identityVersionId", context, "incomingMessage", "outputReply", "rulesApplied", model, "tokensIn", "tokensOut") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [id, identityVersionId, context, incomingMessage, outputReply, rulesApplied ? JSON.stringify(rulesApplied) : null, model, tokensIn, tokensOut]
    );
    return result.rows[0];
  },

  findById: async (runId: string) => {
    const result = await db.query(
      'SELECT * FROM "mirror_runs" WHERE id = $1',
      [runId]
    );
    return result.rows[0] || null;
  }
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

// Export db for direct use
export { db };
