/**
 * User-friendly error message translations
 * Converts technical error codes/messages to user-friendly text
 */

export function getUserFriendlyError(error: any): string {
  const errorCode = error?.errorCode || error?.code;
  const errorMessage = error?.message || error?.error || 'Something went wrong';

  // Map technical error codes to user-friendly messages
  const errorMap: Record<string, string> = {
    // Authentication errors
    'UNAUTHORIZED': 'Your session has expired. Please log in again.',
    'AUTH_REQUIRED': 'Please log in to continue.',
    'INVALID_CREDENTIALS': 'Invalid email or password. Please try again.',
    'SESSION_EXPIRED': 'Your session has expired. Please log in again.',
    'ACCOUNT_NOT_VERIFIED': 'Your account is not verified. Please check your email for the verification code and complete signup, or signup again to receive a new code.',
    'ACCOUNT_DELETION_REQUESTED': 'Account deletion requested. Login is disabled.',
    
    // Validation errors
    'VALIDATION_ERROR': 'Please check your input and try again.',
    'INVALID_EMAIL': 'Please enter a valid email address.',
    'PASSWORD_TOO_SHORT': 'Password must be at least 8 characters long.',
    'PASSWORD_MISMATCH': 'Passwords do not match.',
    
    // LLM/AI errors
    'LLM_AUTH_FAILED': 'AI service configuration error. Please contact support.',
    'LLM_NOT_CONFIGURED': 'AI service is not configured. Please contact support.',
    'LLM_UPSTREAM_ERROR': 'AI service is temporarily unavailable. Please try again in a moment.',
    'LLM_RATE_LIMIT': 'Too many requests. Please wait a moment and try again.',
    'LLM_TIMEOUT': 'Request took too long. Please try again.',
    
    // Payment errors
    'PAYMENT_FAILED': 'Payment could not be processed. Please check your payment method.',
    'PAYMENT_DECLINED': 'Your payment was declined. Please try a different payment method.',
    'INSUFFICIENT_FUNDS': 'Insufficient funds. Please use a different payment method.',
    
    // Rate limiting
    'RATE_LIMIT_EXCEEDED': 'Too many requests. Please slow down and try again in a moment.',
    'TOO_MANY_REQUESTS': 'Too many requests. Please wait a moment before trying again.',
    
    // Network errors
    'NETWORK_ERROR': 'Network connection failed. Please check your internet connection.',
    'TIMEOUT': 'Request timed out. Please try again.',
    
    // File upload errors
    'FILE_TOO_LARGE': 'File is too large. Please upload a smaller file.',
    'INVALID_FILE_TYPE': 'File type not supported. Please upload a different file.',
    'UPLOAD_FAILED': 'File upload failed. Please try again.',
    
    // General errors
    'NOT_FOUND': 'The requested resource was not found.',
    'FORBIDDEN': 'You do not have permission to perform this action.',
    'INTERNAL_ERROR': 'An unexpected error occurred. Please try again later.',
    'SERVICE_UNAVAILABLE': 'Service is temporarily unavailable. Please try again later.',
  };

  // Check if we have a user-friendly message for this error code
  if (errorCode && errorMap[errorCode]) {
    return errorMap[errorCode];
  }

  // Check for common error patterns in messages
  if (errorMessage.includes('NetworkError') || errorMessage.includes('Failed to fetch')) {
    return 'Network connection failed. Please check your internet connection and try again.';
  }

  if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
    return 'Request took too long. Please try again.';
  }

  if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
    return 'Your session has expired. Please log in again.';
  }

  if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
    return 'You do not have permission to perform this action.';
  }

  if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
    return 'The requested resource was not found.';
  }

  if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
    return 'An unexpected error occurred. Please try again later.';
  }

  // Return original message if no mapping found (but sanitize it)
  return errorMessage.length > 200 
    ? 'An error occurred. Please try again.' 
    : errorMessage;
}

/**
 * Get retry suggestion for an error
 */
export function getRetrySuggestion(error: any): string | null {
  const errorCode = error?.errorCode || error?.code;
  const errorMessage = error?.message || error?.error || '';

  // Errors that can be retried
  const retryableErrors = [
    'NETWORK_ERROR',
    'TIMEOUT',
    'LLM_UPSTREAM_ERROR',
    'SERVICE_UNAVAILABLE',
    'RATE_LIMIT_EXCEEDED',
  ];

  if (retryableErrors.includes(errorCode)) {
    return 'This error is usually temporary. Please try again in a moment.';
  }

  if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
    return 'The request took too long. Please try again.';
  }

  if (errorMessage.includes('NetworkError') || errorMessage.includes('Failed to fetch')) {
    return 'Check your internet connection and try again.';
  }

  return null;
}

