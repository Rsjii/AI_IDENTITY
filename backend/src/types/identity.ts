export interface IdentityJson {
  displayName: string;
  primaryUse: string;
  
  defaults?: {
    language?: string;
    formality?: string;
    directness?: string;
    emoji?: string;
    length?: string;
    ctaStyle?: string;
  };
  
  hardRules?: {
    always?: string[];
    never?: string[];
  };
  
  boundaries?: {
    noTopics?: string[];
    noCommitments?: string[];
    escalateIf?: string[];
    escalationReplyTemplate?: string;
  };
  
  decisionPolicy?: {
    defaultAction?: 'reply' | 'defer';
    ignoreIf?: string[];
    deferIf?: string[];
    riskTolerance?: 'conservative' | 'moderate' | 'aggressive';
  };
  
  style?: {
    formality?: 'casual' | 'professional' | 'formal';
    directness?: 'soft' | 'direct' | 'blunt';
    length?: 'brief' | 'medium' | 'detailed';
    emoji?: 'none' | 'occasional' | 'frequent';
    maxLines?: number;
  };
  
  styleAnchors?: {
    greeting?: string;
    closing?: string;
    signaturePhrases?: string[];
  };
  
  settings?: {
    autoReply?: boolean;
  };
}








