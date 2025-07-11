# Encrypted Data Inventory

This document provides a comprehensive inventory of all encrypted data stored in the Savyy application database.

## Overview

The application uses AES-256-GCM encryption to protect sensitive user data. Each encrypted field uses a 4-column storage pattern:
- `encrypted_*` - Base64-encoded encrypted data
- `encrypted_*_iv` - Base64-encoded initialization vector
- `encrypted_*_auth_tag` - Base64-encoded authentication tag
- `encryption_key_id` - Key identifier for rotation support

## Encrypted Data Types

### 1. User Data (users table)

#### Tink User ID
- **Fields**: `encrypted_tink_user_id`, `encrypted_tink_user_id_iv`, `encrypted_tink_user_id_auth_tag`
- **Purpose**: Secure storage of Tink API user identifiers
- **Fallback**: Plain text `tink_user_id` field available during migration

### 2. Account Data (accounts table)

#### OAuth Tokens
- **Access Token**: `encrypted_access_token`, `encrypted_access_token_iv`, `encrypted_access_token_auth_tag`
- **Refresh Token**: `encrypted_refresh_token`, `encrypted_refresh_token_iv`, `encrypted_refresh_token_auth_tag`
- **ID Token**: `encrypted_id_token`, `encrypted_id_token_iv`, `encrypted_id_token_auth_tag`
- **Purpose**: Secure storage of OAuth authentication tokens

#### Password Storage
- **Fields**: `encrypted_password`, `encrypted_password_iv`, `encrypted_password_auth_tag`
- **Purpose**: Secure storage of user passwords (when applicable)

### 3. Bank Account Data (bank_accounts table)

#### IBAN
- **Fields**: `encrypted_iban`, `encrypted_iban_iv`, `encrypted_iban_auth_tag`
- **Purpose**: Secure storage of International Bank Account Numbers
- **Fallback**: Plain text `iban` field available during migration

#### Access Tokens
- **Fields**: `encrypted_access_token`, `encrypted_access_token_iv`, `encrypted_access_token_auth_tag`
- **Purpose**: Secure storage of bank-specific API access tokens

### 4. Transaction Data (transactions table)

#### Counterparty Account Numbers
- **Payee Account**: `encrypted_payee_account_number`, `encrypted_payee_account_number_iv`, `encrypted_payee_account_number_auth_tag`
- **Payer Account**: `encrypted_payer_account_number`, `encrypted_payer_account_number_iv`, `encrypted_payer_account_number_auth_tag`
- **Purpose**: Secure storage of account numbers in transaction records

## Key Management

- **Master Key**: Derived from `ENCRYPTION_MASTER_PASSWORD` environment variable
- **Salt**: Stored in `ENCRYPTION_KEY_SALT` environment variable
- **Key Rotation**: Supported via `encryption_key_id` field
- **Algorithm**: AES-256-GCM with 96-bit IV and 128-bit authentication tag

## Security Considerations

1. **At Rest**: All sensitive data encrypted before database storage
2. **In Transit**: Data decrypted only when needed for API responses
3. **Key Management**: Master key stored in environment variables
4. **Rotation**: Key rotation supported without data migration
5. **Fallback**: Plain text fields available during transition periods

## Compliance

This encryption approach helps meet requirements for:
- PCI DSS (payment card data)
- GDPR (personal data protection)
- PSD2 (financial data security)
- SOC 2 (security controls)