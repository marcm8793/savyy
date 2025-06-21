# Tink Webhook Implementation

This document describes the implementation of Tink webhooks for real-time transaction updates in the Savyy application.

## Overview

The webhook implementation allows Tink to notify your application when:

- Transaction data is refreshed (`refresh:finished`)
- New transactions are added (`account-transactions:modified`)
- Transactions are updated or deleted (`account-booked-transactions:modified`, `account-transactions:deleted`)
- Account information changes (`account:created`, `account:updated`)

## Architecture

### Components

1. **TinkWebhookService** (`src/services/tinkWebhookService.ts`)

   - Handles webhook endpoint creation with Tink
   - Implements signature verification according to Tink's specification
   - Parses and validates webhook payloads

2. **Webhook Routes** (`src/routes/webhook.ts`)

   - Receives webhook notifications from Tink
   - Processes different event types
   - Triggers appropriate actions (transaction sync, account updates)

3. **Setup Script** (`scripts/setup-webhook.ts`)
   - Command-line tool to register webhook endpoint with Tink
   - One-time setup per application

## Setup Instructions

### 1. Environment Variables

Add these environment variables to your `.env` file:

```bash
# Required for webhook setup
TINK_CLIENT_ID=your_client_id
TINK_CLIENT_SECRET=your_client_secret
TINK_API_URL=https://api.tink.com

# Generated during webhook setup (see step 3)
TINK_WEBHOOK_SECRET=your_webhook_secret
```

### 2. Deploy Your Application

Ensure your application is deployed and accessible via HTTPS. The webhook endpoint will be available at:

```
https://yourdomain.com/api/webhook/tink
```

### 3. Register Webhook with Tink

Run the setup script to register your webhook endpoint:

```bash
cd apps/api
tsx scripts/setup-webhook.ts https://yourdomain.com/api/webhook/tink
```

The script will:

- Create a webhook endpoint with Tink
- Configure it to receive all transaction-related events
- Return a webhook secret that you must add to your environment variables

**Important**: Save the webhook secret securely and add it to your environment:

```bash
TINK_WEBHOOK_SECRET=the_secret_returned_by_script
```

### 4. Restart Your Application

After adding the webhook secret, restart your application to load the new environment variable.

## Webhook Events

### refresh:finished

Triggered when Tink finishes refreshing user credentials (both successful and failed refreshes).

**Example Payload**:

```json
{
  "context": {
    "userId": "3db31bdcc75555c4f0b8952984a9bd4f",
    "externalUserId": "f1b3688c649946cc8ee163d1554e853e"
  },
  "content": {
    "credentialsId": "9sd7f9kak102783dkd11j242hmhja8",
    "credentialsStatus": "UPDATED",
    "finished": 1618395156625,
    "source": "OPERATION_SOURCE_BACKGROUND",
    "sessionExpiryDate": 1654623101000
  },
  "event": "refresh:finished"
}
```

**Actions Taken**:

- If status is "UPDATED", logs successful refresh
- If status indicates error, logs warning with error details
- Future enhancement: Trigger transaction sync for affected accounts

### account-transactions:modified

Triggered when an account has new, updated, or deleted transactions (any booking status).

**Example Payload**:

```json
{
  "context": {
    "userId": "3ab33fa1297043b8b371749e42471ab6",
    "externalUserId": "7bc5e6871e5f44698dc4c5b5affed1a4"
  },
  "content": {
    "userId": "3ab33fa1297043b8b371749e42471ab6",
    "externalUserId": "7bc5e6871e5f44698dc4c5b5affed1a4",
    "account": {
      "id": "c1a99f7a9d06408d8d00a37ce2d367e0"
    },
    "transactions": {
      "earliestModifiedBookedDate": "2023-05-31",
      "latestModifiedBookedDate": "2023-06-01",
      "inserted": 1,
      "updated": 0,
      "deleted": 4
    }
  },
  "event": "account-transactions:modified"
}
```

**Actions Taken**:

- Identifies affected user and account
- Logs transaction changes (inserted, updated, deleted counts)
- Future enhancement: Queue background job to sync specific date range

### account-booked-transactions:modified

Similar to `account-transactions:modified` but only for BOOKED transactions.

### account-transactions:deleted

Triggered when transactions are deleted from an account.

**Example Payload**:

```json
{
  "context": {
    "userId": "3ab33fa1297043b8b371749e42471ab6",
    "externalUserId": "7bc5e6871e5f44698dc4c5b5affed1a4"
  },
  "content": {
    "userId": "3ab33fa1297043b8b371749e42471ab6",
    "externalUserId": "7bc5e6871e5f44698dc4c5b5affed1a4",
    "account": {
      "id": "c1a99f7a9d06408d8d00a37ce2d367e0"
    },
    "transactions": {
      "ids": [
        "6bac45b473f24cdeb62688c4f9ce6a50",
        "37e94e585e5446cc8864f56723f02de9"
      ]
    }
  },
  "event": "account-transactions:deleted"
}
```

**Actions Taken**:

- Logs deleted transaction IDs
- Future enhancement: Remove or soft-delete transactions from local database

### account:created / account:updated

Triggered when account information changes.

**Actions Taken**:

- Logs account changes
- Future enhancement: Refresh account information and balances

## Security

### Signature Verification

All webhook requests are verified using HMAC-SHA256 signature verification according to Tink's specification:

1. **Header Format**: `X-Tink-Signature: t=1620198421,v1=8a19c43be75fa428d09e99c13f52bbbe4e924f9ef6cf6aaf4b1414f3bd280233`
2. **Message**: `{timestamp}.{request_body}`
3. **Algorithm**: HMAC-SHA256 with webhook secret
4. **Verification**: Constant-time comparison to prevent timing attacks

### Timestamp Validation

- Webhooks older than 5 minutes are rejected to prevent replay attacks
- Timestamps are extracted from the signature header

### Error Handling

- Invalid signatures return 401 Unauthorized
- Missing headers return 400 Bad Request
- Processing errors return 500 Internal Server Error
- All errors are logged for debugging

## Development

### Testing Webhooks Locally

1. **Use ngrok or similar tunnel**:

   ```bash
   ngrok http 3001
   ```

2. **Register webhook with tunnel URL**:

   ```bash
   tsx scripts/setup-webhook.ts https://your-ngrok-url.ngrok.io/api/webhook/tink
   ```

3. **Monitor webhook events**:
   - Check application logs for incoming webhooks
   - Use Tink Console to trigger test events

### Debugging

Enable detailed logging by checking the application logs when webhooks are received. The webhook handler logs:

- Received events with context
- Processing steps for each event type
- Any errors during processing

## Future Enhancements

### Immediate (Next Sprint)

1. **Background Job Queue**

   - Implement Redis-based job queue for webhook processing
   - Queue transaction sync jobs instead of processing synchronously

2. **Transaction Sync Integration**

   - Automatically sync transactions when `account-transactions:modified` is received
   - Use date range from webhook to optimize sync

3. **User Access Token Management**
   - Store and refresh user access tokens securely
   - Enable automatic transaction sync in webhook handlers

### Medium Term

1. **Real-time Notifications**

   - WebSocket connections to notify frontend of transaction updates
   - Push notifications for important events

2. **Error Recovery**

   - Retry failed webhook processing
   - Dead letter queue for permanently failed events

3. **Webhook Management UI**
   - Admin interface to view webhook status
   - Ability to re-register or update webhook endpoints

### Long Term

1. **Multi-tenancy Support**

   - Support multiple webhook endpoints per tenant
   - Tenant-specific event filtering

2. **Advanced Analytics**
   - Webhook delivery metrics and monitoring
   - Performance optimization based on event patterns

## Troubleshooting

### Common Issues

1. **Webhook Secret Not Set**

   ```
   Error: TINK_WEBHOOK_SECRET not configured
   ```

   **Solution**: Run the setup script and add the returned secret to your environment variables.

2. **Invalid Signature**

   ```
   Error: Invalid webhook signature
   ```

   **Solution**:

   - Verify the webhook secret is correct
   - Check that the request body is being parsed correctly
   - Ensure the application is receiving the raw request body

3. **Webhook Not Receiving Events**

   - Verify the webhook URL is publicly accessible
   - Check Tink Console for webhook delivery status
   - Ensure the webhook endpoint is registered correctly

4. **Timestamp Too Old**
   ```
   Error: Webhook timestamp too old or too far in future
   ```
   **Solution**: Check system clock synchronization on your server.

### Debug Steps

1. **Verify Webhook Registration**:

   ```bash
   # Check if webhook is registered in Tink Console
   # Or re-run setup script to verify
   tsx scripts/setup-webhook.ts https://yourdomain.com/api/webhook/tink
   ```

2. **Test Webhook Endpoint**:

   ```bash
   curl -X POST https://yourdomain.com/api/webhook/tink \
     -H "Content-Type: application/json" \
     -H "X-Tink-Signature: t=1620198421,v1=test" \
     -d '{"test": true}'
   ```

3. **Check Application Logs**:
   - Monitor logs for webhook requests
   - Look for signature verification errors
   - Check event processing logs

## API Reference

### Webhook Endpoint

**POST** `/api/webhook/tink`

**Headers**:

- `Content-Type: application/json`
- `X-Tink-Signature: t={timestamp},v1={signature}`

**Response**:

- `200 OK`: Webhook processed successfully
- `400 Bad Request`: Missing headers or invalid payload
- `401 Unauthorized`: Invalid signature
- `500 Internal Server Error`: Processing error

### Setup Endpoint (Development)

**POST** `/api/webhook/tink/setup`

**Body**:

```json
{
  "webhookUrl": "https://yourdomain.com/api/webhook/tink"
}
```

**Response**:

```json
{
  "success": true,
  "webhookId": "d8f37f7d19c240abb4ef5d5dbebae4ef",
  "secret": "webhook_secret_here",
  "enabledEvents": ["refresh:finished", "account-transactions:modified", ...]
}
```

## Conclusion

This webhook implementation provides a robust foundation for real-time transaction updates from Tink. The modular design allows for easy extension and customization based on your application's specific needs.

For questions or issues, refer to the troubleshooting section or check the application logs for detailed error information.
