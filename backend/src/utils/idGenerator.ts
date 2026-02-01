/**
 * Centralized ID generation utilities
 */
export const generateId = {
  event: () => `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  chat: () => `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  message: () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  anchor: () => `anchor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  correction: () => `correction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  goal: () => `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  run: () => `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  request: () => `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  fact: () => `fact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  visitor: () => `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  block: () => `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  twin: () => `twin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  report: () => `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  twinPerf: () => `twin_perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  memSess: () => `mem_sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  memLt: () => `mem_lt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  user: () => `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  otp: () => `otp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  like: () => `like_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  follow: () => `follow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  invite: () => `invite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  subscription: () => `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  marketplaceListing: () => `mkt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  marketplaceReview: () => `mkt_rev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  marketplaceSubscription: () => `mkt_sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  videoAvatar: () => `vid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
};

/**
 * Generate a random unique handle for users
 * Format: user_[random alphanumeric string]
 * Example: user_k9x2m5p7q
 */
export function generateRandomHandle(): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substr(2, 9);
  return `user_${timestamp}${randomStr}`;
}