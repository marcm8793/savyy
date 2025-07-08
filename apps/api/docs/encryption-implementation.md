# Database Encryption Implementation

This document describes the comprehensive database encryption implementation for Savyy's financial application, designed to protect sensitive financial data at rest.

## Overview

The encryption system implements **application-level encryption** with **AES-256-GCM** algorithm, providing both confidentiality and authenticity for sensitive data stored in the database. This approach ensures that even if the database is compromised, sensitive data remains protected.

## Architecture

### Core Components

1. **EncryptionService** (`src/services/encryptionService.ts`)

   - Centralized encryption/decryption service
   - Key management and rotation
   - AES-256-GCM with authenticated encryption

2. **Database Schema Updates** (`db/schema.ts`)

   - Encrypted field columns for sensitive data
   - Maintains both encrypted and plain-text fields during transition
   - Key ID tracking for key rotation support

3. **Service Layer Integration**
   - `AccountsAndBalancesService` - Encrypts IBAN and access tokens
   - `TransactionQueryService` - Decrypts data when reading
   - `TransactionStorageService` - Supports encrypted account numbers

## Encryption Details

### Algorithm: AES-256-GCM

- **Key Derivation**: scrypt (32-byte output)
- **Authentication**: Built-in authenticated encryption prevents tampering
- **Key Derivation**: PBKDF2 with scrypt
- **Authentication**: Built-in authenticated encryption prevents tampering

### Security Properties

- **Confidentiality**: Data is unreadable without the encryption key
- **Authenticity**: Tampered data is detected and rejected
- **Random IVs**: Each encryption uses a unique initialization vector
- **Key Rotation**: Support for rotating encryption keys without data migration

### Key Management

```typescript
// Master password and salt derive encryption keys
const masterPassword = process.env.ENCRYPTION_MASTER_PASSWORD;
const salt = process.env.ENCRYPTION_KEY_SALT;

// Multiple keys supported for rotation
encryptionService.addKey("key_2024_01", newPassword);
encryptionService.setActiveKey("key_2024_01");
```

## Encrypted Fields

### User Table

- `email` → `encrypted_email`, `encrypted_email_iv`, `encrypted_email_auth_tag`
- `tinkUserId` → `encrypted_tink_user_id`, `encrypted_tink_user_id_iv`, `encrypted_tink_user_id_auth_tag`

### Account Table

- `accessToken` → `encrypted_access_token`, `encrypted_access_token_iv`, `encrypted_access_token_auth_tag`
- `refreshToken` → `encrypted_refresh_token`, `encrypted_refresh_token_iv`, `encrypted_refresh_token_auth_tag`
- `idToken` → `encrypted_id_token`, `encrypted_id_token_iv`, `encrypted_id_token_auth_tag`
- `password` → `encrypted_password`, `encrypted_password_iv`, `encrypted_password_auth_tag`

### Bank Account Table

- `iban` → `encrypted_iban`, `encrypted_iban_iv`, `encrypted_iban_auth_tag`
- `accessToken` → `encrypted_access_token`, `encrypted_access_token_iv`, `encrypted_access_token_auth_tag`

### Transaction Table

- `payeeAccountNumber` → `encrypted_payee_account_number`, `encrypted_payee_account_number_iv`, `encrypted_payee_account_number_auth_tag`
- `payerAccountNumber` → `encrypted_payer_account_number`, `encrypted_payer_account_number_iv`, `encrypted_payer_account_number_auth_tag`

### Common Fields

- `encryption_key_id` - Tracks which key was used for encryption (enables key rotation)

## Implementation Flow

### Encryption Process

```typescript
// 1. Service receives sensitive data
const iban = "DE89370400440532013000";

// 2. Encrypt using EncryptionService
const encryptedFields = this.encryptAccountData(iban, accessToken);

// 3. Store encrypted fields in database
const accountData = {
  // ... other fields
  iban: iban, // Keep plain text temporarily for migration
  encryptedIban: encryptedFields.encryptedIban,
  encryptedIbanIv: encryptedFields.encryptedIbanIv,
  encryptedIbanAuthTag: encryptedFields.encryptedIbanAuthTag,
  encryptionKeyId: encryptedFields.encryptionKeyId,
};
```

### Decryption Process

```typescript
// 1. Read from database
const account = await db.select().from(bankAccount).where(...);

// 2. Decrypt sensitive fields
const decryptedAccount = this.decryptAccount(account);

// 3. Return decrypted data to application
return decryptedAccount; // Contains plain-text IBAN for use
```

## Service Integration

### AccountsAndBalancesService

- **Encryption**: Encrypts IBAN and access tokens before storage
- **Decryption**: Decrypts data when reading from database
- **Duplicate Detection**: Updated to decrypt IBANs for comparison

### TransactionQueryService

- **Decryption**: Automatically decrypts sensitive transaction fields
- **Query Handling**: Maintains existing API while adding encryption layer

### TransactionStorageService

- **Prepared for Encryption**: Infrastructure ready for account number encryption
- **Batch Operations**: Encryption integrated into bulk operations

## Security Considerations

### Environment Variables

Required environment variables for production:

```bash
# Master password for key derivation (rotate regularly)
ENCRYPTION_MASTER_PASSWORD=<strong-random-password>

# Salt for key derivation (generated once, never change)
ENCRYPTION_KEY_SALT=<64-character-hex-string>
```

### Key Rotation

```typescript
// Generate new key with different password
const newKeyId = encryptionService.rotateKey(newMasterPassword);

// New encryptions use new key
// Old data remains readable with previous keys
// Gradual re-encryption can be implemented
```

### Error Handling

- Decryption failures are treated as errors
- Tampered data is detected and rejected
- Missing encryption keys prevent data access
- Graceful fallback for partially migrated data

## Performance Impact

### Encryption Overhead

- **CPU**: Minimal overhead for AES-GCM operations
- **Storage**: ~33–35% increase for encrypted fields (12 B IV + 16 B AuthTag + Base64 encoding)
- **Memory**: Negligible impact with streaming operations

### Optimization Strategies

- Encrypt only truly sensitive fields
- Batch encryption operations
- Cache decrypted data appropriately
- Use database-level caching for performance

## Migration Strategy

### Phase 1: Dual Storage (Current Implementation)

```sql
-- Both fields exist during migration
ALTER TABLE bank_accounts ADD COLUMN encrypted_iban TEXT;
ALTER TABLE bank_accounts ADD COLUMN encrypted_iban_iv TEXT;
ALTER TABLE bank_accounts ADD COLUMN encrypted_iban_auth_tag TEXT;
-- Keep existing 'iban' column for now
```

### Phase 2: Complete Migration (Future)

1. **Data Migration**: Encrypt all existing plain-text data
2. **Code Updates**: Remove plain-text field access
3. **Schema Cleanup**: Drop plain-text columns
4. **Performance Verification**: Ensure no regression

### Phase 3: Enhanced Security (Future)

1. **Column-Level Encryption**: Consider database-level encryption
2. **Hardware Security**: Consider HSM for key storage
3. **Audit Logging**: Track encryption/decryption operations

## Testing

### EncryptionService Tests

- **Basic Operations**: Encrypt/decrypt functionality
- **Key Management**: Multiple keys, rotation, deactivation
- **Security Properties**: IV uniqueness, tamper detection
- **Performance**: Large data handling
- **Error Conditions**: Invalid keys, tampered data

### Integration Tests

- **Service Integration**: Updated service tests with mocked encryption
- **End-to-End**: Verify encryption/decryption in full flow
- **Migration Testing**: Verify dual-field handling

## Monitoring and Compliance

### Security Metrics

- Monitor encryption/decryption operations
- Track key rotation frequency
- Alert on decryption failures
- Monitor storage overhead

### Compliance Considerations

- **PCI DSS**: Protects cardholder data
- **GDPR**: Enhances data protection
- **PCI DSS 3.1**: Strong cryptography requirements
- **SOC 2**: Data security controls

## Troubleshooting

### Common Issues

1. **"No active encryption key available"**

   - Check environment variables
   - Verify service initialization
   - Solution: Set ENCRYPTION_MASTER_PASSWORD

2. **"Decryption failed"**

   - Data may be tampered with
   - Wrong encryption key
   - Solution: Verify key ID and data integrity

3. **Performance issues**
   - Check if decryption is happening in loops
   - Solution: Batch operations, cache results

### Debug Commands

```bash
# Check environment variables
echo $ENCRYPTION_MASTER_PASSWORD
echo $ENCRYPTION_KEY_SALT

# Test encryption service
npm run test -- --grep "EncryptionService"

# Verify schema changes
npm run db:studio
```

## Future Enhancements

### Short Term

1. **Complete Migration**: Remove plain-text fields
2. **Additional Fields**: Encrypt transaction descriptions
3. **Performance Optimization**: Batch operations

### Long Term

1. **Hardware Security Modules (HSM)**: For key storage
2. **Transparent Data Encryption (TDE)**: Database-level encryption
3. **Zero-Knowledge Architecture**: Client-side encryption
4. **Audit Trails**: Comprehensive encryption logging

## Conclusion

This encryption implementation provides robust protection for sensitive financial data while maintaining application performance and developer productivity. The phased approach ensures safe migration with minimal downtime and risk.

The system is designed for:

- **Security**: Strong encryption with authenticated encryption
- **Scalability**: Efficient operations with minimal overhead
- **Maintainability**: Clean service architecture with comprehensive testing
- **Compliance**: Meeting financial industry security requirements

For questions or support, refer to the team documentation or contact the security team.
