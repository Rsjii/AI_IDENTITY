import { llmClient } from '../../services/llmClient';
import { logger } from '../../config/logger';

/**
 * Build system prompt from identity JSON
 * This is the core of the identity engine
 */
export function buildIdentityPrompt(identityJson: any): string {
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
 * Generate mirror reply using identity
 */
export async function generateMirrorReply(
  identityJson: any,
  incomingMessage: string,
  context: string
): Promise<{ reply: string; rulesApplied: string[] }> {
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
        maxTokens: 500,
        temperature: 0.7,
      }
    );

    return {
      reply: response.content.trim(),
      rulesApplied,
    };
  } catch (error) {
    logger.error('Error generating mirror reply:', error);
    throw error;
  }
}

