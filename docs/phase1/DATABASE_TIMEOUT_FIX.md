# Database Connection Timeout Fix

## Problem

The application was experiencing database connection timeout errors:
- `Connection terminated due to connection timeout`
- `timeout exceeded when trying to connect`
- Errors affecting session store operations (`connect-pg-simple`)
- Errors affecting regular database queries

## Root Cause

1. **Connection timeout too short**: 10 seconds was insufficient for slow network connections or database load
2. **Session store blocking main pool**: Session operations were using the same connection pool as regular queries, causing contention
3. **No separate error handling**: Session store errors could cascade and affect the main application

## Solution

### 1. Increased Connection Timeouts

**File:** `backend/src/config/constants.ts`

- Increased `connectionTimeoutMillis` from 10s to 30s
- Increased `acquireTimeoutMillis` from 10s to 30s
- Increased `createTimeoutMillis` from 10s to 30s

This gives the database more time to establish connections, especially during:
- Network latency
- Database load spikes
- Connection pool exhaustion

### 2. Separate Session Pool

**Files:** 
- `backend/src/config/constants.ts` - Added `SESSION_POOL_CONFIG`
- `backend/src/config/db.ts` - Created `sessionPool` with separate configuration
- `backend/src/app.ts` - Updated to use `sessionPool` instead of main `pool`

**Benefits:**
- Session operations don't block regular database queries
- More lenient timeout settings for session operations (60s idle timeout)
- Smaller pool size (3 connections) dedicated to sessions
- Isolated error handling

### 3. Enhanced Error Handling

**File:** `backend/src/config/db.ts`

- Added dedicated error handler for `sessionPool`
- Non-critical errors logged as warnings
- Network errors handled gracefully
- Prevents cascading failures

## Configuration Details

### Main Database Pool
```typescript
{
  max: 5 (dev) / 20 (prod),
  connectionTimeoutMillis: 30000,  // 30 seconds
  idleTimeoutMillis: 30000,
  statement_timeout: 30000,
  query_timeout: 30000,
}
```

### Session Pool
```typescript
{
  max: 3,
  connectionTimeoutMillis: 30000,  // 30 seconds
  idleTimeoutMillis: 60000,         // 60 seconds (more lenient)
  statement_timeout: 30000,
  query_timeout: 30000,
}
```

## Testing

After these changes, the application should:
1. ✅ Handle slow database connections gracefully
2. ✅ Prevent session store errors from blocking main queries
3. ✅ Retry failed connections automatically
4. ✅ Log errors appropriately without crashing

## Monitoring

Watch for these log messages:
- `[SESSION_POOL_ERROR]` - Session pool connection issues (non-critical)
- `[DB_POOL_ERROR]` - Main pool connection issues
- `[DB] ❌ Database query error` - Query failures with retry attempts

## Related Files

- `backend/src/config/constants.ts` - Pool configuration
- `backend/src/config/db.ts` - Pool creation and error handling
- `backend/src/app.ts` - Session store configuration


