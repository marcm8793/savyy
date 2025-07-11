# Data Encryption Security

## Overview

This document explains how sensitive user data is encrypted and stored in the Savyy application to ensure data security and compliance with financial industry standards.

## Approach

### Selective Encryption Strategy

The application encrypts sensitive financial data while maintaining plain text storage for fields required by authentication systems:

1. **User Authentication Data**: Plain text emails for Better Auth compatibility
2. **Financial Identifiers**: Encrypted Tink user IDs and bank account information
3. **Transaction Data**: Encrypted counterparty account numbers
4. **OAuth Tokens**: Encrypted access tokens and refresh tokens

### Why This Approach?

- **Authentication Requirements**: Better Auth requires plain text email fields for user authentication
- **Data Protection**: Sensitive financial data is encrypted at rest
- **Performance**: Selective encryption minimizes overhead
- **Compliance**: Meets data protection requirements for financial applications

## Implementation

### User Registration Flow

1. User submits registration form with email/password
2. Better Auth processes authentication data normally
3. Encryption service handles sensitive financial data (Tink user IDs, tokens)
4. Database stores both plain text (for auth) and encrypted data (for security)

### Data Access

#### Backend Services

```typescript
import { userEncryptionService } from "../services/userEncryptionService";

// Get decrypted Tink user ID for API calls
const decryptedTinkUserId = userEncryptionService.decryptTinkUserId(user);

// Prepare user data for frontend (removes encryption fields)
const frontendUser = userEncryptionService.prepareUserForFrontend(user);
```

#### Frontend Display

- Frontend receives decrypted data from backend APIs
- No encryption fields are exposed to frontend
- All sensitive data is handled securely in backend services

## Environment Variables

Required environment variables for encryption:

```bash
# Strong encryption password - generate securely
ENCRYPTION_MASTER_PASSWORD=<generate-with-openssl-rand-base64-32>

# 32-byte hex salt - generate with: openssl rand -hex 32
ENCRYPTION_KEY_SALT=<generate-with-openssl-rand-hex-32>
```

## Database Schema

### Encrypted Fields

#### User Table
- `encryptedTinkUserId` / `encryptedTinkUserIdIv` / `encryptedTinkUserIdAuthTag` - Tink user ID encryption
- `encryptionKeyId` - Key used for encryption (supports key rotation)

#### Account Table
- `encryptedAccessToken` / `encryptedAccessTokenIv` / `encryptedAccessTokenAuthTag` - OAuth tokens
- `encryptedRefreshToken` / `encryptedRefreshTokenIv` / `encryptedRefreshTokenAuthTag` - Refresh tokens
- `encryptedPassword` / `encryptedPasswordIv` / `encryptedPasswordAuthTag` - Password encryption

#### Bank Account Table
- `encryptedIban` / `encryptedIbanIv` / `encryptedIbanAuthTag` - IBAN encryption
- `encryptedAccessToken` / `encryptedAccessTokenIv` / `encryptedAccessTokenAuthTag` - Bank API tokens

#### Transaction Table
- `encryptedPayeeAccountNumber` / `encryptedPayeeAccountNumberIv` / `encryptedPayeeAccountNumberAuthTag` - Payee accounts
- `encryptedPayerAccountNumber` / `encryptedPayerAccountNumberIv` / `encryptedPayerAccountNumberAuthTag` - Payer accounts

### Security Properties

1. **AES-256-GCM Encryption**: Authenticated encryption with built-in integrity checking
2. **Unique IVs**: Each encryption uses a random IV
3. **Key Rotation Support**: Multiple encryption keys can be maintained
4. **Authenticated Encryption**: Auth tags prevent tampering

## Best Practices

### For Developers

1. **Always use decrypted data for display**:
   ```typescript
   // ✅ Use decrypted Tink user ID for API calls
   const tinkUserId = await userEncryptionService.decryptTinkUserId(user);
   ```

2. **Use the encryption service for new sensitive fields**:
   ```typescript
   const encryptedData = await encryptionService.encrypt(sensitiveValue);
   const fields = encryptionResultToFields(encryptedData);
   ```

3. **Never log or expose encrypted data**:
   ```typescript
   // ❌ Don't log encrypted fields
   console.log(user.encryptedTinkUserId);

   // ✅ Log only non-sensitive data
   console.log(`User ${user.id} updated`);
   ```

### For Deployment

1. **Secure Environment Variables**: Store encryption keys in secure secret management
2. **Key Rotation**: Regularly rotate encryption keys using the built-in rotation support
3. **Backup Security**: Ensure database backups are also encrypted at rest
4. **Access Control**: Limit access to encryption environment variables

## Testing

The encryption system includes comprehensive tests covering:

- Tink user ID encryption/decryption
- Bank account data encryption/decryption
- Transaction data encryption/decryption
- Frontend data preparation
- Error handling and fallbacks

Run tests with:

```bash
npm run test:run -- __tests__/unit/services/userEncryptionService.test.ts
```

## Future Enhancements

1. **Additional Field Encryption**: Extend to other sensitive fields (transaction descriptions, merchant names)
2. **Database-Level Encryption**: Consider column-level encryption for additional security
3. **Key Management Service**: Integrate with AWS KMS or similar for enterprise deployments
4. **Audit Logging**: Track access to decrypted sensitive data

## Compliance Benefits

This encryption approach helps meet requirements for:

- **PCI DSS**: Protects payment card data
- **GDPR**: Enhances personal data protection
- **PSD2**: Meets financial data security requirements
- **SOC 2**: Implements required security controls

The system provides enterprise-grade security for sensitive financial data while maintaining application performance and compliance with industry standards.