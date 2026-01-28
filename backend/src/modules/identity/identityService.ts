import { llmClient } from '../../services/llmClient';
import { logger } from '../../config/logger';
import {
  identityQueries,
  identityVersionQueries,
  mirrorRunQueries,
  trustEventQueries,
  chatSessionQueries,
  chatMessageQueries,
} from '../../config/database';
import { TOKEN_QUOTAS, EVENT_TYPES } from '../../config/constants';
import { IdentityJson } from '../../types/identity';
import { EventLogger } from '../../services/eventLogger';
import { calculateCost, costToCents } from '../../services/costCalculator';
import { ragService } from '../../services/ragService';
import { responseCacheService } from '../../services/responseCacheService';

/**
 * Compute decision (reply/ignore/defer/clarify) from identity + message
 */
export function computeDecision(identityJson: IdentityJson, incomingMessage: string): { action: 'reply' | 'ignore' | 'defer' | 'clarify' | 'escalate'; reason: string } {
  const text = (incomingMessage || '').toLowerCase().trim();

  // Check auto-reply setting (if disabled, defer)
  if (identityJson?.settings?.autoReply === false) {
    return { action: 'defer', reason: 'Auto-reply disabled in settings' };
  }

  // Check ignore policy
  if (identityJson?.decisionPolicy?.ignoreIf && Array.isArray(identityJson.decisionPolicy.ignoreIf)) {
    const shouldIgnore = identityJson.decisionPolicy.ignoreIf.some((condition: string) => 
      text.includes(String(condition).toLowerCase())
    );
    if (shouldIgnore) {
      return { action: 'ignore', reason: 'Matches ignore policy.' };
    }
  }

  // Check defer policy
  if (identityJson?.decisionPolicy?.deferIf && Array.isArray(identityJson.decisionPolicy.deferIf)) {
    const shouldDefer = identityJson.decisionPolicy.deferIf.some((condition: string) => 
      text.includes(String(condition).toLowerCase())
    );
    if (shouldDefer) {
      return { action: 'defer', reason: 'Matches defer policy.' };
    }
  }

  // Check escalation keywords (from boundaries.escalateIf)
  if (identityJson?.boundaries?.escalateIf && Array.isArray(identityJson.boundaries.escalateIf)) {
    const shouldEscalate = identityJson.boundaries.escalateIf.some((condition: string) => 
      text.includes(String(condition).toLowerCase())
    );
    if (shouldEscalate) {
      return { action: 'escalate', reason: `Matches escalation rule: ${identityJson.boundaries.escalateIf.find(c => text.includes(c.toLowerCase()))}` };
    }
  }

  // Check if message is too short
  if (text.length < 8) {
    return { action: 'clarify', reason: 'Message is too short; ask for context.' };
  }

  // Default: reply
  return { action: 'reply', reason: 'Default action.' };
}

/**
 * Build system prompt from identity JSON
 * This is the core of the identity engine
 *
 * OPTIMIZED: Reduced token usage by ~40% while maintaining effectiveness
 * Old: ~500 tokens | New: ~300 tokens = 40% cost reduction on system prompt
 */
export function buildIdentityPrompt(identityJson: IdentityJson): string {
  const {
    displayName = 'User',
    primaryUse = 'founder',
    defaults = {},
    hardRules = {},
    boundaries = {},
    styleAnchors = {},
  } = identityJson;

  // Build compact prompt (token-optimized)
  const lines: string[] = [];

  // Core identity (1 line)
  lines.push(`You are ${displayName}, a ${primaryUse}.`);

  // Defaults as compact key-value (1 line)
  const styleSettings: string[] = [];
  if (defaults.language) styleSettings.push(`lang:${defaults.language}`);
  if (defaults.formality) styleSettings.push(`tone:${defaults.formality}`);
  if (defaults.directness) styleSettings.push(`direct:${defaults.directness}`);
  if (defaults.emoji) styleSettings.push(`emoji:${defaults.emoji}`);
  if (defaults.length) styleSettings.push(`len:${defaults.length}`);
  if (styleSettings.length > 0) {
    lines.push(`Style: ${styleSettings.join(', ')}`);
  }

  // Hard rules (compact)
  if (hardRules.always && hardRules.always.length > 0) {
    lines.push(`ALWAYS: ${hardRules.always.map((r: string) => r.substring(0, 80)).join('; ')}`);
  }
  if (hardRules.never && hardRules.never.length > 0) {
    lines.push(`NEVER: ${hardRules.never.map((r: string) => r.substring(0, 80)).join('; ')}`);
  }

  // Boundaries (compact)
  if (boundaries.noTopics && boundaries.noTopics.length > 0) {
    lines.push(`Avoid topics: ${boundaries.noTopics.join(', ')}`);
  }
  if (boundaries.noCommitments && boundaries.noCommitments.length > 0) {
    lines.push(`No commitments: ${boundaries.noCommitments.join(', ')}`);
  }

  // Style anchors (compact)
  if (styleAnchors.signaturePhrases && styleAnchors.signaturePhrases.length > 0) {
    lines.push(`Phrases: ${styleAnchors.signaturePhrases.slice(0, 3).join(', ')}`);
  }
  if (styleAnchors.greeting) lines.push(`Greeting: ${styleAnchors.greeting}`);
  if (styleAnchors.closing) lines.push(`Closing: ${styleAnchors.closing}`);

  // Critical rules (compact - most important for quality)
  lines.push('');
  lines.push('RULES: Stay in character. Use knowledge base for details. Be specific. Output reply only.');

  return lines.join('\n');
}

/**
 * Build verbose system prompt (for debugging/testing)
 * Use buildIdentityPrompt for production (optimized)
 */
export function buildIdentityPromptVerbose(identityJson: IdentityJson): string {
  const {
    displayName = 'User',
    primaryUse = 'founder',
    defaults = {},
    hardRules = {},
    boundaries = {},
    decisionPolicy = {},
    styleAnchors = {},
  } = identityJson;

  const parts: string[] = [];

  // Core identity
  parts.push(`You are acting as ${displayName}, a ${primaryUse}.`);
  parts.push(`Your role: ${primaryUse}`);

  // Defaults
  if (defaults.language) parts.push(`Language: ${defaults.language}`);
  if (defaults.formality) parts.push(`Formality: ${defaults.formality}`);
  if (defaults.directness) parts.push(`Directness: ${defaults.directness}`);
  if (defaults.emoji) parts.push(`Emoji usage: ${defaults.emoji}`);
  if (defaults.length) parts.push(`Reply length: ${defaults.length}`);
  if (defaults.ctaStyle) parts.push(`CTA style: ${defaults.ctaStyle}`);

  // Hard rules (ALWAYS)
  if (hardRules.always && hardRules.always.length > 0) {
    parts.push('\nALWAYS follow these rules:');
    hardRules.always.forEach((rule: string) => {
      parts.push(`- ${rule}`);
    });
  }

  // Hard rules (NEVER)
  if (hardRules.never && hardRules.never.length > 0) {
    parts.push('\nNEVER do these:');
    hardRules.never.forEach((rule: string) => {
      parts.push(`- ${rule}`);
    });
  }

  // Boundaries
  if (boundaries.noTopics && boundaries.noTopics.length > 0) {
    parts.push(`\nAvoid these topics: ${boundaries.noTopics.join(', ')}`);
  }
  if (boundaries.noCommitments && boundaries.noCommitments.length > 0) {
    parts.push(`\nNever commit to: ${boundaries.noCommitments.join(', ')}`);
  }
  if (boundaries.escalateIf && boundaries.escalateIf.length > 0) {
    parts.push('\nEscalate if:');
    boundaries.escalateIf.forEach((condition: string) => {
      parts.push(`- ${condition}`);
    });
    if (boundaries.escalationReplyTemplate) {
      parts.push(`\nEscalation template: "${boundaries.escalationReplyTemplate}"`);
    }
  }

  // Decision policy
  if (decisionPolicy.defaultAction) {
    parts.push(`\nDefault action: ${decisionPolicy.defaultAction}`);
  }
  if (decisionPolicy.ignoreIf && decisionPolicy.ignoreIf.length > 0) {
    parts.push('\nIgnore if:');
    decisionPolicy.ignoreIf.forEach((condition: string) => {
      parts.push(`- ${condition}`);
    });
  }
  if (decisionPolicy.deferIf && decisionPolicy.deferIf.length > 0) {
    parts.push('\nDefer if:');
    decisionPolicy.deferIf.forEach((condition: string) => {
      parts.push(`- ${condition}`);
    });
  }
  if (decisionPolicy.riskTolerance) {
    parts.push(`Risk tolerance: ${decisionPolicy.riskTolerance}`);
  }

  // Style anchors (signature phrases)
  if (styleAnchors.signaturePhrases && styleAnchors.signaturePhrases.length > 0) {
    parts.push(`\nCommon phrases you use: ${styleAnchors.signaturePhrases.join(', ')}`);
  }
  if (styleAnchors.greeting) {
    parts.push(`Greeting style: ${styleAnchors.greeting}`);
  }
  if (styleAnchors.closing) {
    parts.push(`Closing style: ${styleAnchors.closing}`);
  }

  // Critical instruction
  parts.push('\n=== CRITICAL ===');
  parts.push('Do NOT optimize for helpfulness or politeness.');
  parts.push('Optimize ONLY for identity consistency.');
  parts.push('If rules conflict, prefer: never > boundaries > always > defaults');
  parts.push('Output ONLY the reply text. No explanations.');

  return parts.join('\n');
}

/**
 * Validator helper: Check if generated reply violates identity rules
 */
type ValidatorResult = { pass: boolean; violations: string[] };

async function validateMirrorOutput(params: {
  identityPrompt: string;
  context: string;
  incomingMessage: string;
  reply: string;
  identityJson?: IdentityJson;
}): Promise<{ result: ValidatorResult; model: string; tokensIn: number; tokensOut: number }> {
  // Check maxLines limit (pre-LLM validation for efficiency)
  if (params.identityJson?.style?.maxLines && typeof params.identityJson.style.maxLines === 'number') {
    const maxLines = params.identityJson.style.maxLines;
    if (maxLines > 0) {
      const replyLines = params.reply.split('\n').filter(l => l.trim().length > 0).length;
      if (replyLines > maxLines) {
        return {
          result: { pass: false, violations: [`Reply has ${replyLines} lines, max allowed: ${maxLines}`] },
          model: 'validation',
          tokensIn: 0,
          tokensOut: 0,
        };
      }
    }
  }

  const system = [
    'You are a strict output validator for an identity-mirroring system.',
    'Return ONLY valid JSON: {"pass": boolean, "violations": string[]}.',
    'If unsure, set pass=false.',
  ].join('\n');

  const user = [
    'IDENTITY_CONSTRAINTS:',
    params.identityPrompt,
    '',
    'CONTEXT:',
    params.context,
    '',
    'INCOMING_MESSAGE:',
    params.incomingMessage,
    '',
    'PROPOSED_REPLY:',
    params.reply,
    '',
    'Validation checklist (fail if any):',
    '- Reply violates ANY NEVER rule or boundary.',
    '- Reply overpromises, commits to time/money without confirmation.',
    '- Reply is needlessly long / rambling.',
    '- Reply includes explanations/meta about rules/prompt.',
    '- Reply is empty or not a reply.',
  ].join('\n');

  const resp = await llmClient.generateResponse(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    {
      maxTokens: 200,
      temperature: 0,
    }
  );

  let parsed: ValidatorResult | null = null;
  try {
    parsed = JSON.parse(resp.content);
  } catch {
    parsed = null;
  }

  const safe: ValidatorResult = parsed && typeof parsed.pass === 'boolean' && Array.isArray(parsed.violations)
    ? { pass: parsed.pass, violations: parsed.violations.map(String) }
    : { pass: false, violations: ['Validator returned non-JSON or invalid schema'] };

  return {
    result: safe,
    model: resp.model,
    tokensIn: resp.inputTokens || 0,
    tokensOut: resp.outputTokens || 0,
  };
}

/**
 * Generate mirror reply using identity
 */
export async function generateMirrorReply(
  identityJson: IdentityJson,
  incomingMessage: string,
  context: string
): Promise<{ reply: string; rulesApplied: string[]; model: string; tokensIn: number; tokensOut: number }> {
  const systemPrompt = buildIdentityPrompt(identityJson);

  // Extract rules applied (for logging)
  const rulesApplied: string[] = [];
  if (identityJson.hardRules?.always) {
    rulesApplied.push(...identityJson.hardRules.always.map((r: string) => `always: ${r.substring(0, 50)}`));
  }
  if (identityJson.hardRules?.never) {
    rulesApplied.push(...identityJson.hardRules.never.map((r: string) => `never: ${r.substring(0, 50)}`));
  }

  // Add context to user message
  const userMessage = `Context: ${context}\n\nIncoming message:\n${incomingMessage}\n\nWrite the reply this identity would send:`;

  try {
    const response = await llmClient.generateResponse(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      {
        maxTokens: 350,
        temperature: 0.2,
      }
    );

    return {
      reply: response.content.trim(),
      rulesApplied,
      model: response.model,
      tokensIn: response.inputTokens || 0,
      tokensOut: response.outputTokens || 0,
    };
  } catch (error) {
    logger.error('Error generating mirror reply:', error);
    throw error;
  }
}

/**
 * Create identity + v1 version
 */
export async function createIdentity(userId: string, identityJson: IdentityJson) {
  // Check if identity already exists
  const existing = await identityQueries.findByUserId(userId);
  if (existing) {
    throw new Error('Identity already exists. Use update to modify.');
  }

  // Create identity
  const identity = await identityQueries.create(userId);

  // Create v1
  const version = await identityVersionQueries.create(identity.id, 'v1', identityJson);

  // Activate v1
  await identityVersionQueries.updateStatus(version.id, 'active');
  await identityQueries.updateActiveVersion(identity.id, version.id);

  logger.info(`Identity created for user ${userId}`);

  return {
    identity,
    version,
  };
}

/**
 * Get identity by user ID with active version
 */
export async function getIdentityByUserId(userId: string) {
  const identity = await identityQueries.findByUserId(userId);
  if (!identity) {
    return null;
  }

  // Get active version
  let activeVersion = null;
  if (identity.activeVersionId) {
    activeVersion = await identityVersionQueries.findById(identity.activeVersionId);
    if (activeVersion && typeof activeVersion.identityJson === 'string') {
      activeVersion.identityJson = JSON.parse(activeVersion.identityJson);
    }
  }

  return {
    identity,
    activeVersion,
  };
}

/**
 * Helper: Parse version label (v1, v2, etc) to number
 */
function parseV(label: string): number {
  const m = String(label || '').match(/^v(\d+)$/i);
  return m ? Number(m[1]) : 0;
}

/**
 * Helper: Generate next version label (v1, v2, v3, ...)
 */
function nextVersionLabel(existing: Array<{ version?: string }>): string {
  let max = 0;
  for (const v of existing || []) {
    max = Math.max(max, parseV(v.version || ''));
  }
  return `v${max + 1}`;
}

/**
 * Create new identity version (immutable) + activate it
 */
export async function createNewIdentityVersion(userId: string, identityJson: IdentityJson) {
  const identity = await identityQueries.findByUserId(userId);
  if (!identity) {
    throw new Error('Identity not found');
  }

  const versions = await identityVersionQueries.findByIdentityId(identity.id);
  const newLabel = nextVersionLabel(versions);

  const createdFrom = identity.activeVersionId || undefined;
  const newVersion = await identityVersionQueries.create(identity.id, newLabel, identityJson, createdFrom);

  // Archive old active (status change allowed)
  if (identity.activeVersionId) {
    await identityVersionQueries.updateStatus(identity.activeVersionId, 'archived');
  }

  await identityVersionQueries.updateStatus(newVersion.id, 'active');
  await identityQueries.updateActiveVersion(identity.id, newVersion.id);

  logger.info(`New identity version created: ${newVersion.id} (${newLabel}) for user ${userId}`);

  return { version: newVersion };
}

/**
 * Activate an existing identity version
 */
export async function activateIdentityVersionForUser(userId: string, versionId: string) {
  const version = await identityVersionQueries.findById(versionId);
  if (!version) {
    throw new Error('Identity version not found');
  }

  const identity = await identityQueries.findById(version.identityId);
  if (!identity || identity.userId !== userId) {
    throw new Error('Access denied');
  }

  if (identity.activeVersionId && identity.activeVersionId !== versionId) {
    await identityVersionQueries.updateStatus(identity.activeVersionId, 'archived');
  }

  await identityVersionQueries.updateStatus(versionId, 'active');
  await identityQueries.updateActiveVersion(identity.id, versionId);

  logger.info(`Identity version ${versionId} activated for user ${userId}`);

  return { success: true };
}

/**
 * List all identity versions for user
 */
export async function listIdentityVersionsForUser(userId: string) {
  const identity = await identityQueries.findByUserId(userId);
  if (!identity) {
    throw new Error('Identity not found');
  }

  const versions = await identityVersionQueries.findByIdentityId(identity.id);
  const normalized = versions.map((v: any) => ({
    ...v,
    identityJson: typeof v.identityJson === 'string' ? JSON.parse(v.identityJson) : v.identityJson,
  }));

  return { identityId: identity.id, versions: normalized };
}

/**
 * Update identity version JSON (BACKWARD COMPATIBLE - now creates new version instead of mutating)
 */
export async function updateIdentityVersion(
  versionId: string,
  userId: string,
  identityJson: IdentityJson
) {
  // ✅ Backward compatible endpoint: instead of mutating, create NEW version + activate it.

  const version = await identityVersionQueries.findById(versionId);
  if (!version) {
    throw new Error('Identity version not found');
  }

  const identity = await identityQueries.findById(version.identityId);
  if (!identity || identity.userId !== userId) {
    throw new Error('Access denied');
  }

  const versions = await identityVersionQueries.findByIdentityId(identity.id);
  const newLabel = nextVersionLabel(versions);

  const newVersion = await identityVersionQueries.create(identity.id, newLabel, identityJson, versionId);

  if (identity.activeVersionId) {
    await identityVersionQueries.updateStatus(identity.activeVersionId, 'archived');
  }

  await identityVersionQueries.updateStatus(newVersion.id, 'active');
  await identityQueries.updateActiveVersion(identity.id, newVersion.id);

  logger.info(`Identity version updated (new version created): ${newVersion.id} (${newLabel}) for user ${userId}`);

  return { success: true, activeVersionId: newVersion.id, version: newVersion.version };
}

/**
 * Generate mirror reply (with full flow) - V2 PIPELINE
 * Decision FIRST → Generate → Validate → Retry if needed
 */
export async function generateMirrorReplyWithLogging(
  userId: string,
  context: string,
  incomingMessage: string,
  opts?: { platform?: 'web' | 'gmail' | 'linkedin' | 'api'; sessionId?: string; visitorId?: string; maxTokens?: number; teaserOnly?: boolean }
) {
  const platform = opts?.platform || 'web';

  const identity = await identityQueries.findByUserId(userId);
  if (!identity || !identity.activeVersionId) {
    throw new Error('Identity not found. Please create your identity first.');
  }

  const version = await identityVersionQueries.findById(identity.activeVersionId);
  if (!version) throw new Error('Active identity version not found');

  const identityJson =
    typeof version.identityJson === 'string' ? JSON.parse(version.identityJson) : version.identityJson;

  // ✅ DECISION FIRST (before generation)
  const decision = computeDecision(identityJson, incomingMessage);

  // ✅ Quota check (counts historical tokens; we'll add validator tokens into this run's tokens too)
  const usedTokens = await mirrorRunQueries.sumTokensForUserSince(
    userId,
    new Date(Date.now() - 24 * 60 * 60 * 1000)
  );
  if (usedTokens >= TOKEN_QUOTAS.USER_DAILY_TOKENS) {
    throw new Error('Daily token quota exceeded. Try again tomorrow.');
  }

  // Templates for non-reply actions (MVP)
  const templates: Record<typeof decision.action, string> = {
    ignore: '',
    defer: 'Got it — let me check and get back to you.',
    clarify: 'Can you share a bit more context (what\'s the goal / deadline / what you need from me)?',
    escalate: 'This requires attention. Let me review and respond appropriately.',
    reply: '',
  };

  const identityPrompt = buildIdentityPrompt(identityJson);

  const startTime = Date.now();

  // Helper: ensure session
  const ensureSession = async (): Promise<string | null> => {
    if (opts?.sessionId) return opts.sessionId;
    // create a session only if visitorId present or platform is public/api
    if (!opts?.visitorId && platform === 'web') return null;
    const s = await chatSessionQueries.create({ creatorId: userId, visitorId: opts?.visitorId || null, platform });
    return s.id;
  };

  const sessionId = await ensureSession();

  // Always save user message when session exists
  if (sessionId) {
    await chatMessageQueries.add({ sessionId, role: 'user', content: incomingMessage });
  }

  // ✅ If not reply: log + return early
  if (decision.action !== 'reply') {
    const reply = templates[decision.action];
    const costCents = 0; // No cost for non-reply actions
    const mirrorRun = await mirrorRunQueries.create(
      version.id,
      context,
      incomingMessage,
      reply,
      [],          // rulesApplied
      'n/a',       // model
      0,
      0,
      costCents,
      {
        platform,
        decisionAction: decision.action,
        decisionReason: decision.reason,
        validatorStatus: 'skipped',
        validatorViolations: [],
        latencyMs: Date.now() - startTime,
      }
    );

    // Log AI_RUN_CREATED event for non-reply actions
    EventLogger.logUserEvent(userId, EVENT_TYPES.AI_RUN_CREATED, {
      mirrorRunId: mirrorRun.id,
      model: 'n/a',
      tokensIn: 0,
      tokensOut: 0,
      costCents: 0,
      platform,
      decisionAction: decision.action,
    }).catch((err) => {
      logger.warn('Failed to log AI_RUN_CREATED event:', err);
    });

    if (sessionId && reply) {
      await chatMessageQueries.add({ sessionId, role: 'assistant', content: reply });
    }

    return {
      decision,
      reply,
      rulesApplied: [],
      mirrorRunId: mirrorRun.id,
      decisionReason: decision.reason,
      validatorStatus: 'skipped' as const,
      validatorViolations: [] as string[],
      sessionId,
    };
  }

  // ✅ Reply path: generate → validate → retry up to 2 times
  let finalReply = '';
  let rulesApplied: string[] = [];
  let genModel = '';
  let tokensInTotal = 0;
  let tokensOutTotal = 0;

  let validatorStatus: 'pass' | 'fail' = 'fail';
  let validatorViolations: string[] = [];

  // For teaser, use limited tokens and skip validation
  const maxTokens = opts?.maxTokens || opts?.teaserOnly ? 100 : 350;
  const isTeaser = opts?.teaserOnly === true;

  // ✅ RAG: Retrieve relevant knowledge chunks (COST OPTIMIZATION!)
  // This is THE KEY optimization - we only send relevant context to LLM
  let ragContext = '';
  let ragChunksUsed = 0;
  let ragTokensEstimate = 0;

  if (!isTeaser) {
    try {
      const retrieved = await ragService.retrieveRelevantContext(userId, incomingMessage, {
        maxChunks: 5,
        maxTokens: 800,
        minSimilarity: 0.3,
      });

      if (retrieved.chunks.length > 0) {
        ragContext = ragService.buildContextString(retrieved);
        ragChunksUsed = retrieved.chunks.length;
        ragTokensEstimate = retrieved.totalTokensEstimate;
        logger.info(`[RAG] Using ${ragChunksUsed} relevant chunks (~${ragTokensEstimate} tokens) for context`);
      }
    } catch (ragError: any) {
      logger.warn('[RAG] Failed to retrieve context, proceeding without:', ragError.message);
    }
  }

  // ✅ CACHE: Check if we have a cached response for this query
  if (!isTeaser) {
    try {
      const cached = await responseCacheService.get(userId, version.id, incomingMessage);
      if (cached) {
        logger.info(`[Cache] HIT - returning cached response`);
        finalReply = cached.response;
        genModel = cached.model;
        tokensInTotal = 0;
        tokensOutTotal = 0;
        validatorStatus = 'pass';

        // Save to chat session
        if (sessionId && finalReply) {
          await chatMessageQueries.add({ sessionId, role: 'assistant', content: finalReply });
        }

        // Log cache hit (no cost)
        const mirrorRun = await mirrorRunQueries.create(
          version.id,
          context,
          incomingMessage,
          finalReply,
          [],
          'cache',
          0,
          0,
          0, // Zero cost for cached response!
          {
            platform,
            decisionAction: decision.action,
            decisionReason: decision.reason,
            validatorStatus: 'pass',
            validatorViolations: [],
            latencyMs: Date.now() - startTime,
          }
        );

        return {
          decision,
          decisionReason: decision.reason,
          reply: finalReply,
          rulesApplied: [],
          mirrorRunId: mirrorRun.id,
          validatorStatus: 'pass',
          validatorViolations: [],
          sessionId,
          fromCache: true,
        };
      }
    } catch (cacheError: any) {
      logger.debug('[Cache] Error checking cache:', cacheError.message);
    }
  }

  // Build optimized context (RAG + user context)
  const enrichedContext = ragContext
    ? `${ragContext}\n\nADDITIONAL CONTEXT: ${context}`
    : context;

  for (let attempt = 0; attempt < (isTeaser ? 1 : 3); attempt++) {
    const gen = await llmClient.generateResponse(
      [
        { role: 'system', content: identityPrompt },
        {
          role: 'user',
          content:
            attempt === 0
              ? isTeaser
                ? `Context: ${context}\n\nIncoming message:\n${incomingMessage}\n\nWrite a brief teaser/preview (max ${maxTokens} tokens) of how you would reply. Keep it short and engaging:`
                : `Context: ${enrichedContext}\n\nIncoming message:\n${incomingMessage}\n\nWrite the reply this identity would send:`
              : `Context: ${enrichedContext}\n\nIncoming message:\n${incomingMessage}\n\nYour last draft violated rules:\n- ${validatorViolations.join(
                  '\n- '
                )}\n\nRewrite the reply to fix all violations. Output ONLY the reply text.`,
        },
      ],
      { maxTokens, temperature: 0.2 }
    );

    finalReply = (gen.content || '').trim();
    genModel = gen.model;
    tokensInTotal += gen.inputTokens || 0;
    tokensOutTotal += gen.outputTokens || 0;

    // rulesApplied (same logic as before)
    rulesApplied = [];
    if (identityJson.hardRules?.always) {
      rulesApplied.push(...identityJson.hardRules.always.map((r: string) => `always: ${String(r).substring(0, 50)}`));
    }
    if (identityJson.hardRules?.never) {
      rulesApplied.push(...identityJson.hardRules.never.map((r: string) => `never: ${String(r).substring(0, 50)}`));
    }

    // Skip validation for teaser
    if (isTeaser) {
      validatorStatus = 'pass';
      validatorViolations = [];
      break;
    }

    const val = await validateMirrorOutput({
      identityPrompt,
      context,
      incomingMessage,
      reply: finalReply,
      identityJson,
    });

    tokensInTotal += val.tokensIn;
    tokensOutTotal += val.tokensOut;

    if (val.result.pass) {
      validatorStatus = 'pass';
      validatorViolations = [];
      break;
    }

    validatorStatus = 'fail';
    validatorViolations = val.result.violations || ['Unknown validation failure'];
  }

  const latencyMs = Date.now() - startTime;

  // ✅ Calculate cost
  const costUsd = calculateCost(tokensInTotal, tokensOutTotal, genModel);
  const costCents = costToCents(costUsd);

  const mirrorRun = await mirrorRunQueries.create(
    version.id,
    context,
    incomingMessage,
    finalReply,
    rulesApplied,
    genModel,
    tokensInTotal,
    tokensOutTotal,
    costCents,
    {
      platform,
      decisionAction: decision.action,
      decisionReason: decision.reason,
      validatorStatus,
      validatorViolations,
      latencyMs,
    }
  );

  logger.info(`Mirror run created: ${mirrorRun.id} (decision: ${decision.action}, validator: ${validatorStatus}, cost: $${(costCents / 100).toFixed(4)}, RAG chunks: ${ragChunksUsed})`);

  // ✅ CACHE: Save response to cache for future queries (if validation passed)
  if (!isTeaser && validatorStatus === 'pass' && finalReply) {
    try {
      await responseCacheService.set(
        userId,
        version.id,
        incomingMessage,
        finalReply,
        tokensInTotal + tokensOutTotal,
        genModel,
        { addToSemanticCache: true }
      );
      logger.debug(`[Cache] Saved response to cache`);
    } catch (cacheError: any) {
      logger.debug('[Cache] Error saving to cache:', cacheError.message);
    }
  }

  // ✅ Log AI_RUN_CREATED event
  EventLogger.logUserEvent(userId, EVENT_TYPES.AI_RUN_CREATED, {
    mirrorRunId: mirrorRun.id,
    model: genModel,
    tokensIn: tokensInTotal,
    tokensOut: tokensOutTotal,
    totalTokens: tokensInTotal + tokensOutTotal,
    costCents: costCents,
    platform,
    decisionAction: decision.action,
    validatorStatus,
  }).catch((err) => {
    logger.warn('Failed to log AI_RUN_CREATED event:', err);
  });

  // ✅ Log LLM_USAGE event
  EventLogger.logUserEvent(userId, EVENT_TYPES.LLM_USAGE, {
    mirrorRunId: mirrorRun.id,
    model: genModel,
    tokensIn: tokensInTotal,
    tokensOut: tokensOutTotal,
    totalTokens: tokensInTotal + tokensOutTotal,
    costCents: costCents,
    platform,
  }).catch((err) => {
    logger.warn('Failed to log LLM_USAGE event:', err);
  });

  // after final mirrorRun created:
  if (sessionId && finalReply) {
    await chatMessageQueries.add({ sessionId, role: 'assistant', content: finalReply });
  }

  return {
    decision,
    decisionReason: decision.reason,
    reply: finalReply,
    rulesApplied,
    mirrorRunId: mirrorRun.id,
    validatorStatus,
    validatorViolations,
    sessionId,
  };
}

/**
 * Log trust confirmation
 */
export async function logTrustEvent(
  userId: string,
  mirrorRunId: string,
  event: 'confirm_yes' | 'confirm_no' | 'edit_rule' | 'regenerate',
  note?: string
) {
  // Verify mirror run exists
  const mirrorRun = await mirrorRunQueries.findById(mirrorRunId);
  if (!mirrorRun) {
    throw new Error('Mirror run not found');
  }

  // Verify version belongs to user
  const version = await identityVersionQueries.findById(mirrorRun.identityVersionId);
  if (!version) {
    throw new Error('Identity version not found');
  }

  const identity = await identityQueries.findById(version.identityId);
  if (!identity || identity.userId !== userId) {
    throw new Error('Access denied');
  }

  // Create trust event
  await trustEventQueries.create(mirrorRunId, version.id, event, note);

  logger.info(`Trust event logged: ${event} for mirror run ${mirrorRunId}`);

  return { success: true };
}

