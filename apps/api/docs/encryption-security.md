# User Data Encryption

## Overview

This document explains how sensitive user data is encrypted and stored in the Savyy application.

## Approach

### Dual Storage Strategy

For user email addresses, we use a dual storage approach:

1. **Plain Email**: Stored in the `user.email` field for Better Auth authentication and uniqueness constraints
2. **Encrypted Email**: Stored in encrypted fields (`encryptedEmail`, `encryptedEmailIv`, `encryptedEmailAuthTag`)

### Why This Approach?

- **Authentication Requirements**: Better Auth requires a plain email field for user authentication and email-based operations
- **Data Protection**: Sensitive user data is still encrypted and can be used for display purposes
- **Backward Compatibility**: Existing authentication flows continue to work
- **Compliance**: Meets data protection requirements while maintaining functionality

## Implementation

### User Registration Flow

1. User submits registration form with email/password
2. Better Auth `create.before` hook triggers:
   - Encrypts the user's email using AES-256-GCM
   - Stores encrypted email data in dedicated fields
   - Processes firstName/lastName from the name field
3. User is created with both plain and encrypted email

### Data Access

#### Backend Services

```typescript
import { userEncryptionService } from "../services/userEncryptionService";

// Get decrypted email for display
const decryptedEmail = userEncryptionService.decryptUserEmail(user);

// Prepare user data for frontend (removes encryption fields)
const frontendUser = userEncryptionService.prepareUserForFrontend(user);
```

#### Frontend Display

- Always use the decrypted email from the backend
- The frontend never sees encryption fields directly

## Environment Variables

Required environment variables for encryption:

````bash
# Strong encryption password - generate securely
ENCRYPTION_MASTER_PASSWORD=<generate-with-openssl-rand-base64-32>

# 32-byte hex salt - generate with: openssl rand -hex 32
ENCRYPTION_KEY_SALT=<generate-with-openssl-rand-hex-32>

## Database Schema

### Encrypted Fields
- `encryptedEmail` / `encryptedEmailIv` / `encryptedEmailAuthTag` - Email encryption
- `encryptedTinkUserId` / `encryptedTinkUserIdIv` / `encryptedTinkUserIdAuthTag` - Tink user ID encryption
- `encryptionKeyId` - Key used for encryption (supports key rotation)

### Security Properties

1. **AES-256-GCM Encryption**: Authenticated encryption with built-in integrity checking
2. **Unique IVs**: Each encryption uses a random IV
3. **Key Rotation Support**: Multiple encryption keys can be maintained
4. **Authenticated Encryption**: Auth tags prevent tampering

## Best Practices

### For Developers

1. **Always use decrypted data for display**:
   ```typescript
   // ❌ Don't use plain email for display
   const email = user.email;

   // ✅ Use decrypted email for display
const email = userEncryptionService.decryptUserEmail(user);

2. **Use the encryption service for new sensitive fields**:

   ```typescript
   const encryptedData = encryptionService.encrypt(sensitiveValue);
   const fields = encryptionResultToFields(encryptedData);
   ```

3. **Never log or expose encrypted data**:

   ```typescript
   // ❌ Don't log encrypted fields
   console.log(user.encryptedEmail);

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

- Email encryption/decryption
- Tink user ID encryption/decryption
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
````
