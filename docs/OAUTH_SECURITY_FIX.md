# OAuth Code Replay Attack Protection

## Overview

This document explains the OAuth authorization code replay attack vulnerability that was fixed in the Redis-based OAuth code deduplication system.

## The Vulnerability

### Problem Description

The OAuth code replay attack occurs when the same OAuth authorization code can be reused multiple times within a validity window. This happened because:

1. **Short TTL for processed codes**: OAuth codes were only marked as "processed" for 5 minutes in Redis
2. **Longer OAuth code lifetime**: Tink's access tokens expire after 30 minutes, and OAuth codes typically expire in 10-15 minutes
3. **Replay window**: After 5 minutes, the Redis key expired but the OAuth code remained valid with the provider

### Attack Scenario

```
Time 0:00    User completes OAuth flow, code ABC123 is processed
Time 0:01    Redis stores processed_code:ABC123 with 5-minute TTL
Time 5:01    Redis key expires, processed_code:ABC123 is deleted
Time 5:02    Attacker (or accidental retry) uses same code ABC123
Time 5:03    System doesn't recognize code as processed → processes again
Time 15:00   OAuth code finally expires at provider level (typical 10-15 min lifetime)
```

### Impact

- **Duplicate account creation**: Same bank account linked multiple times
- **Data inconsistencies**: Duplicate transactions, balances
- **Race conditions**: Multiple concurrent processing of same code
- **Security risks**: Potential for account takeover or data corruption

## The Solution

### 1. Extended TTL for Processed Codes

**Before (Vulnerable):**

```typescript
// Only 5 minutes (300 seconds)
pipeline.setex(`processed_code:${code}`, 300, Date.now().toString());
```

**After (Secure):**

```typescript
// 2 hours (7200 seconds) - 4x Tink's 30-minute access token lifetime
// Provides safety margin while being resource-efficient
pipeline.setex(`processed_code:${code}`, 7200, Date.now().toString());
```

### 2. Configurable TTL Constants

```typescript
class RedisService {
  private readonly OAUTH_CODE_PROCESSED_TTL = 7200; // 2 hours (4x Tink's 30min)
  private readonly OAUTH_CODE_PROCESSING_TTL = 600; // 10 minutes
}
```

### 3. Enhanced Security Monitoring

Added `getCodeSecurityStatus()` method to detect:

- Potential replay attempts
- Unusual timing patterns
- System compromise indicators

### 4. Logging and Alerting

```typescript
fastify.log.warn("OAuth code replay attempt detected", {
  code: code.substring(0, 8) + "...",
  securityRisk: securityStatus.securityRisk,
  timeSinceProcessed: timeSinceProcessed,
});
```

## Implementation Details

### Redis Key Structure

```
processed_code:ABC123DEF456    # TTL: 2 hours
  Value: 1640995200000         # Timestamp when processed

processing_code:ABC123DEF456   # TTL: 10 minutes
  Value: 1640995200000         # Timestamp when processing started
```

### Security Levels

- **None**: Normal operation, no security concerns
- **Low**: Unusual timing patterns, worth monitoring
- **High**: Potential replay attack or system compromise

### Monitoring Endpoints

- `GET /api/health/oauth-security` - System security status
- Uses `OAuthSecurityMonitor` class for detailed analysis

## Best Practices

### 1. TTL Configuration

- **Processed codes**: Set TTL to 2-4 hours or 4x the OAuth provider's access token lifetime
- **Processing codes**: Keep at 10 minutes to handle temporary failures
- **For Tink**: Use 2+ hours since their access tokens expire after 30 minutes
- **Never set TTL shorter than OAuth provider's code lifetime**

### 2. Monitoring

- Monitor for replay attempts using security status endpoint
- Log all high-risk security events
- Set up alerts for repeated replay attempts

### 3. Fallback Behavior

- If Redis is unavailable, fail open (allow processing) to prevent service disruption
- Log Redis unavailability as high-risk event
- Implement circuit breaker pattern for Redis failures

## Verification

### Testing the Fix

1. **Normal flow**: OAuth code should be processed once successfully
2. **Replay attempt**: Same code should be rejected within 2 hours
3. **Redis failure**: System should continue working (fail open)
4. **Monitoring**: Security status should report correct risk levels

### Security Checklist

- [ ] Processed code TTL ≥ OAuth provider code lifetime
- [ ] Processing code TTL appropriate for failure handling
- [ ] Monitoring and alerting configured
- [ ] Logs don't contain full OAuth codes (only hashes)
- [ ] Fallback behavior tested and documented

## Related Security Considerations

1. **OAuth State Parameter**: Ensure CSRF protection is implemented
2. **Code Validation**: Validate codes with OAuth provider before processing
3. **Rate Limiting**: Implement rate limiting for OAuth endpoints
4. **Audit Logging**: Log all OAuth-related security events
5. **Key Rotation**: Rotate HMAC keys used for state tokens

## Maintenance

### Regular Tasks

- Monitor Redis memory usage (2h TTL is more efficient than 24h)
- Review security logs for replay attempts
- Update TTL if OAuth provider changes token/code lifetime
- Test fallback behavior during Redis maintenance

### Incident Response

If replay attack is detected:

1. Investigate source of duplicate requests
2. Check for compromised OAuth codes
3. Verify user account integrity
4. Consider temporarily blocking affected OAuth flow
5. Review system logs for additional indicators

## References

- [RFC 6749 - OAuth 2.0 Authorization Framework](https://tools.ietf.org/html/rfc6749)
- [OAuth 2.0 Security Best Current Practice](https://tools.ietf.org/html/draft-ietf-oauth-security-topics)
- [Tink OAuth Documentation](https://docs.tink.com/api/oauth)
