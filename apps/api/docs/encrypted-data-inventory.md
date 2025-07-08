# Encrypted Data Inventory

This document provides a comprehensive inventory of all encrypted data stored in the Savyy application.

## Encrypted Fields by Database Table

### Users Table (`user`)
- **Email addresses** (`encryptedEmail`)
- **Tink User IDs** (`encryptedTinkUserId`)

### Accounts Table (`account`)
- **Access tokens** (`encryptedAccessToken`)
- **Refresh tokens** (`encryptedRefreshToken`)
- **ID tokens** (`encryptedIdToken`)
- **Passwords** (`encryptedPassword`)

### Bank Accounts Table (`bank_accounts`)
- **IBAN numbers** (`encryptedIban`)
- **Access tokens** (`encryptedAccessToken`)

### Transactions Table (`transactions`)
- **Payee account numbers** (`encryptedPayeeAccountNumber`)
- **Payer account numbers** (`encryptedPayerAccountNumber`)

## Encryption Infrastructure

### Algorithm
- **AES-256-GCM** (Advanced Encryption Standard with Galois/Counter Mode)
- Provides confidentiality, authenticity, and integrity

### Key Management
- **Master password**: Stored in `ENCRYPTION_MASTER_PASSWORD` environment variable
- **Key derivation salt**: Stored in `ENCRYPTION_KEY_SALT` environment variable
- **Key rotation**: Supported through `encryptionKeyId` field in each table

### Core Services
- **EncryptionService**: Handles all encryption/decryption operations
- **UserEncryptionService**: Manages user-specific data encryption/decryption

## Storage Pattern

Each encrypted field uses a 4-column pattern:
1. `encrypted_[field_name]` - The encrypted data
2. `encrypted_[field_name]_iv` - Initialization vector (16 bytes)
3. `encrypted_[field_name]_auth_tag` - Authentication tag
4. `encryption_key_id` - Key identifier for rotation support

## Data Classification

### Highly Sensitive (Financial)
- IBAN numbers
- Account numbers (payee/payer)
- OAuth tokens (access, refresh, ID)

### Personally Identifiable Information (PII)
- Email addresses
- Tink User IDs

### Authentication Data
- Account passwords
- Access tokens

## Security Features

- **Authenticated encryption**: Prevents data tampering
- **Unique IVs**: Each encryption operation uses a random initialization vector
- **Key rotation**: Multiple encryption keys can coexist
- **Secure key derivation**: Uses scrypt for password-based key derivation

## Migration Strategy

The system supports dual storage during migration:
- Both encrypted and plain-text fields exist during transition
- New data is encrypted while old data remains accessible
- Services handle both encrypted and plain-text data for backward compatibility

## Compliance

This encryption implementation is designed to meet:
- **PCI DSS** requirements for payment card data
- **GDPR** requirements for personal data protection
- **Financial industry** compliance standards