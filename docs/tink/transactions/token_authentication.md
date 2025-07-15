# Tink Token Authentication

This document explains the difference between client access tokens and user access tokens in the Tink API, their usage patterns, and authentication flows.

## Overview

Tink uses two distinct token types for authentication:

- **Client Access Tokens**: Authenticate your application for administrative operations
- **User Access Tokens**: Authenticate access to specific user's financial data

## Client Access Tokens

### Purpose and Usage

- Authenticate your application (not individual users) with the Tink API
- Required for administrative operations like creating users, managing webhooks, and granting authorizations
- Use your `client_id` and `client_secret` for authentication

### Scopes

Client access tokens can be requested with various scopes:

- `user:create` - Create new users
- `authorization:grant` - Grant user access and generate authorization codes
- `webhook-endpoints` - Set up and manage webhooks
- `user:delete` - Delete users
- `credentials:write` - Delete credentials/consents
- `credentials:refresh` - Refresh data
- `provider-consents:read` - Read provider consents

### Authentication Flow

```bash
curl -v -X POST https://api.tink.com/api/v1/oauth/token \
-d 'client_id={YOUR_CLIENT_ID}' \
-d 'client_secret={YOUR_CLIENT_SECRET}' \
-d 'grant_type=client_credentials' \
-d 'scope=user:create'
```

### Key Characteristics

- Valid for 30 minutes (1800 seconds)
- No refresh token provided - must re-authenticate when expired
- Must be kept secret and not exposed to public clients
- Used for server-to-server operations

## User Access Tokens

### Purpose and Usage

- Authenticate access to specific user's financial data
- Required for fetching user-specific data like accounts, balances, transactions
- Tied to a specific user and their bank consents

### Scopes

User access tokens are requested with data access scopes:

- `accounts:read` - Read account information
- `balances:read` - Read account balances
- `transactions:read` - Read transaction data
- `provider-consents:read` - Read provider consents
- `credentials:refresh` - Refresh user data
- `credentials:write` - Modify user credentials

### Authentication Flow

User access tokens require a two-step process:

1. **Generate authorization code:**

```bash
curl -X POST https://api.tink.com/api/v1/oauth/authorization-grant \
-H 'Authorization: Bearer {YOUR_CLIENT_ACCESS_TOKEN}' \
-d 'user_id={THE_TINK_USER_ID}' \
-d 'scope=accounts:read,balances:read,transactions:read, provider-consents:read'
```

2. **Exchange code for user access token:**

```bash
curl -v -X POST https://api.tink.com/api/v1/oauth/token \
-d 'code={YOUR_USER_AUTHORIZATION_CODE}' \
-d 'client_id={YOUR_CLIENT_ID}' \
-d 'client_secret={YOUR_CLIENT_SECRET}' \
-d 'grant_type=authorization_code'
```

### Key Characteristics

- Valid for 30 minutes (1800 seconds)
- Does not include a refresh token (must re-authenticate when expired)
- Tied to specific user and their bank consents
- Used for accessing user's financial data

## Key Differences

| Aspect             | Client Access Token                         | User Access Token                                |
| ------------------ | ------------------------------------------- | ------------------------------------------------ |
| **Authentication** | App-level (client_id + client_secret)       | User-level (via authorization code)              |
| **Scope**          | Administrative operations                   | User data access                                 |
| **Refresh Token**  | No                                          | No                                               |
| **Usage**          | Create users, manage webhooks, grant access | Fetch accounts, transactions, balances           |
| **Security**       | Server-side only                            | Server-side only                                 |
| **Expiry**         | 30 minutes                                  | 30 minutes (renewable with refresh access token) |

## Data Access Flow

The typical flow combines both token types:

1. **Client Access Token** → Create user and generate authorization code
2. **User Authentication** → User authenticates with bank via Tink URL
3. **User Access Token** → Exchange authorization code for user access token
4. **Data Access** → Use user access token to fetch financial data

## Security Considerations

- Client access tokens must be kept secret and never exposed to public clients
- User access tokens must be kept secret and never exposed to public clients
- Both token types expire after 30 minutes for security
- Use the credentials:refresh scope and OAuth flow to renew user access tokens
- Always use HTTPS when transmitting tokens

## Implementation in Savyy

In the Savyy application, token management is handled by:

- `TinkService` class for client access token management
- `TokenService` class for user access token and refresh token handling
- Automatic token refresh logic in service methods

The dual-token system provides security by separating app-level operations from user-level data access, ensuring that sensitive user financial data can only be accessed with proper user consent and authentication.
