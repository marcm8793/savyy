# Webhooks for Transactions

Use webhooks to be notified when Tink events occur.

## Prerequisites

- Go to Set up your Tink Console account and follow all steps to create a Console account, create your first app, and retrieve your API credentials.
- The app must have the scope `webhook-endpoints`. Verify this setting in Console by going to [your_app] > App settings > API client. If you're not sure if the scope is enabled, contact Tink Support.

This document contains everything you need to get started with setting up webhooks for Transactions. This document includes the following sections:

- Set up a webhook
- Webhook signature validation
- Receive webhook events using Mutual TLS authentication
- Event: Refresh finished
- Event: Account transactions modified
- Event: Account transactions deleted

## Set up a webhook

Use the Tink Events API to configure a webhook. This must only be done once per app. Define a target endpoint and a list of events, and you're done. When you've set up a webhook, Tink will notify you every time an event occurs for each Tink user of your app.

> **Note:** different webhook events may have additional requirements. Eventual requirements are described at the top of each event.

### 1. Expose an endpoint on your server

Set up your own endpoint to receive notifications. The endpoint should be a publicly-accessible URL that can receive POST requests from Tink. The event payload is sent in the request body.

**Endpoint example:** `https://endpoint.yourdomain.com/webhook`

### 2. Generate a client access token

Follow the instructions in this section to authorize access to your backend client. The process generates a client access token that can be used to modify users that are connected to your `client_id`. Remember that your `client_secret` should be kept a secret: only use it to authenticate with the Tink platform and don't share it outside your organization.

**Request example:**
_Authorize access to your backend client_

```bash
curl -v -X POST https://api.tink.com/api/v1/oauth/token \
-d 'client_id={YOUR_CLIENT_ID}' \
-d 'client_secret={YOUR_CLIENT_SECRET}' \
-d 'grant_type=client_credentials' \
-d 'scope=authorization:grant,user:create'
```

Response: Access Token Response for a client which expires after 30 mins (no refresh token provided, use the same endpoint again to get a new access token). The token must also be kept a secret and not exposed to any public client.

**Response example:**

```json
{
  "access_token": "{YOUR_CLIENT_ACCESS_TOKEN}",
  "token_type": "bearer",
  "expires_in": 1800,
  "scope": "authorization:grant,user:create"
}
```

### 3. Use the Events API

Set up the webhook by using your client access token to call the Tink API. For more information about the fields for this request, see Request Body: CreateWebhookEndpointRequest.

**Request example:**
_Set up the webhook_

```bash
curl -v -X POST https://api.tink.com/events/v2/webhook-endpoints \
-H 'Authorization: Bearer {CLIENT_ACCESS_TOKEN}' \
-d '{ "description": "My webhook", "disabled": false, "enabledEvents": ["refresh:finished"], "url": "https://endpoint.example.com/webhook" }'
```

**Response example:**

```json
{
  "createdAt": "2022-05-26T07:54:41.725408Z",
  "description": "Alice's webhook",
  "disabled": false,
  "enabledEvents": ["refresh:finished"],
  "id": "d8f37f7d19c240abb4ef5d5dbebae4ef",
  "secret": "string",
  "updatedAt": "2022-05-26T07:54:41.725408Z",
  "url": "https://endpoint.example.com/webhook"
}
```

Store the `secret` value safely as it can't be retrieved again. Use the secret to verify the signature of incoming notifications. For more information, see Webhook signature validation and the Events API API reference.

### Message structure

A webhook that's sent to you has this JSON structure:

| Field     | Description                                                                                                                |
| --------- | -------------------------------------------------------------------------------------------------------------------------- |
| `context` | Specifies optional metadata about the context the event refers to, for example user IDs.                                   |
| `content` | Contains detailed information about the particular event. The structure of the content varies depending on the event type. |
| `event`   | Specifies the event type for the information contained in the content field.                                               |

**Example**

```json
{
  "context": {
    "userId": "3db31bdcc75555c4f0b8952984a9bd4f",
    "externalUserId": "f1b3688c649946cc8ee163d1554e853e"
  },
  "content": {
    "credentialsId": "9sd7f9kak102783dkd11j242hmhja8",
    "status": "UPDATED",
    "credentialsStatus": "UPDATED",
    "finished": 1618395156625,
    "source": "OPERATION_SOURCE_BACKGROUND",
    "sessionExpiryDate": 1654623101000
  },
  "event": "refresh:finished"
}
```

### Available events for Transactions

| Event                                  | Description                                                                                                                                                                                               |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `account-transactions:modified`        | This event is triggered when an account has new, updated or deleted transactions, regardless of their booking status.                                                                                     |
| `account-booked-transactions:modified` | This event is triggered when an account has new, updated or deleted transactions that have status BOOKED.                                                                                                 |
| `account-transactions:deleted`         | This event is triggered when an account has deleted transactions, regardless of their booking status.                                                                                                     |
| `account:created`                      | This event is triggered when an account resource has been created.                                                                                                                                        |
| `account:updated`                      | This event is triggered when an account resource has been updated.                                                                                                                                        |
| `refresh:finished`                     | This event is triggered when a refresh operation has finished for a credential (for Account Aggregation) or consent (for Transactions). This can happen for on-demand refreshes and background refreshes. |

## Webhook signature validation

When you use the Events API, Tink signs notifications that are sent to your webhook endpoint. This section describes how you can verify the signature.

### Prerequisite

You have set up webhooks for your app and stored your secret value. If you're not sure about these things, see Use the Events API.

### Introduction

Tink signs every message that's delivered via the Events V2 webhook with a signature header that's added to the outgoing HTTP request.

When using the Events V2 API, we recommend you to implement signature verification to validate the authenticity of an incoming request.

### How to verify a signature

The incoming request includes a `X-Tink-Signature` header. This header consists of two properties that are separated by a comma. The first property is the timestamp (UNIX timestamp format), with the key `t`, followed by the actual message signature key that's prefixed by `v1`.

**Example of header:**

```
X-Tink-Signature: t=1620198421,v1=8a19c43be75fa428d09e99c13f52bbbe4e924f9ef6cf6aaf4b1414f3bd280233
```

#### 1. Extract the timestamp and signatures from the header

Parse the header contents to extract the timestamp `t` and the signature values `v`. Make sure that your implementation ignores any other values.

**JavaScript example:**

```javascript
let header =
  "t=1620198421,v1=8a19c43be75fa428d09e99c13f52bbbe4e924f9ef6cf6aaf4b1414f3bd280233";
let keyValues = header.split(",");
let validKeys = ["t", "v1"];
let values = keyValues
  .map((kv) => kv.split("="))
  .filter((kv) => validKeys.includes(kv[0]))
  .flatMap((kv) => kv[1]);

// ["1620198421", "8a19c43be75fa428d09e99c13f52bbbe4e924f9ef6cf6aaf4b1414f3bd280233"]
```

#### 2. Calculate the expected signature

To validate the signature, you must recreate it on your end and then compare it. To create a signature, three elements are used:

- The secret (that you stored when setting up the webhook)
- The timestamp of the request (which is the `t` value in the header)
- The body of the request, exactly as you received it

> In this context, request body refers to the content that appears immediately after the request headers. In most frameworks and languages, there are helpers to retrieve the raw incoming request body.

The signature is the result of the concatenation of timestamp as extracted from the header, followed by a dot, and then followed by the entire body of the incoming request. Take this and sign it with a specific encryption function. First, build the message to sign:

```javascript
let timestamp = "1620198421";
let requestBody = '{"context": {...}, "event": "...",  "content": {...}}';

let messageToSign = timestamp + "." + requestBody;
```

Once you have done that, you need to encrypt it using the secret that you know:

```javascript
let crypto = require("crypto");

let secret = "top_secret_top_secret_top_secret";

let signature = crypto
  .createHmac("sha256", secret)
  .update(messageToSign)
  .digest("hex");

// Result: 8a19c43be75fa428d09e99c13f52bbbe4e924f9ef6cf6aaf4b1414f3bd280233
```

#### 3. Compare the signatures

Compare the expected signature with the incoming signature. These should match exactly. If these do not match, it signals that something is wrong; it could be that the implementation is incorrectly made, the secret you stored is not the right one, or someone is pretending to be Tink. If the two signatures don't match, you should discard the information and ignore the request by returning the `412 Precondition Failed` error in the HTTP response status code.

The timestamp can be used to discard messages older than a set threshold. Consider keeping the threshold at no less than 5 minutes to allow for retries of failed message deliveries.

## Receive webhook events using Mutual TLS authentication

### Prerequisite

This feature is only available for Enterprise customers.

### Set up mutual TLS authentication

Mutual TLS authentication (mTLS), is a part of the TLS handshake protocol for performing certificate-based authentication of a client. Regular TLS only authenticates the server, but mTLS authenticates both the server and client. This is done by having each party prove possession of their mutually approved key material.

Tink's webhook service automatically authenticates itself using its key material when prompted by a receiving server. To configure your servers to do this, find out how to enable mTLS in server software that receives webhook events. Ensure that your application trusts all of DigiCert's root authorities:

- [DigiCert's root certificates](https://www.digicert.com/kb/digicert-root-certificates.htm)

Tink's webhook service provides both its own client certificate and DigiCert's intermediate CA certificates, which allows you to verify the full certificate chain by only using DigiCert's root certificate.

To narrow down the DigiCert-issued certificate that is issued specifically for Tink, your server must validate that the incoming client certificate contains at least one of these X.509 certificate attributes:

- Subject: `C=SE, L=Stockholm, O=Tink AB, CN=api.tink.com`
- Subject Alternative Name: `DNS:api.tink.com`

## Event: Refresh finished

### Prerequisite

In Console, go to [your_app] > App settings > API client. For the All available client scopes section, make sure that the following scopes are included: `credentials:refresh` and `webhook-endpoints`.

### Introduction

Use webhooks to subscribe to a `refresh:finished` event. A trigger of this event notifies you when the refresh operation has finished for a user's credentials. For more details on this type of event, see Available events.

For more details on how to subscribe to webhooks, see Set up a webhook and Webhook API reference.

### Event logic

The `refresh:finished` event is triggered when a refresh operation has finished for a credentials object. This occurs for both on-demand and background refreshes.

The event is triggered if the refresh attempt was successful or unsuccessful. In the case of an unsuccessful refresh, the type of error is specified in the event.

This event is only triggered by an attempted refresh. For example, it will not be triggered for refreshes that have been rate limited. For more information, see rate limits.

### Event content

| Field                 | Type              | Description                                                                                                                                                                     | Required |
| --------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `externalUserId`      | string            | The external identifier of the user (as specified when creating the user)                                                                                                       | No       |
| `credentialsId`       | string            | Unique identifier of the credential                                                                                                                                             | Yes      |
| `status` (DEPRECATED) | string            | Status of the credential. Possible values are: `UPDATED`, `TEMPORARY_ERROR`, `AUTHENTICATION_ERROR`, `SESSION_EXPIRED`                                                          | Yes      |
| `credentialsStatus`   | string            | Status of the credential. Possible values are: `UPDATED`, `TEMPORARY_ERROR`, `AUTHENTICATION_ERROR`, `SESSION_EXPIRED`                                                          | Yes      |
| `finished`            | string            | Timestamp of when the refresh operation finished                                                                                                                                | Yes      |
| `source`              | string            | Source of the refresh. Possible values are: `OPERATION_SOURCE_API`, `OPERATION_SOURCE_BACKGROUND`, `OPERATION_SOURCE_STREAMING`                                                 | No       |
| `sessionExpiryDate`   | string            | Indicates when the session for the currently stored credentials will expire. After this date automatic refreshes will not be possible without new authentication from the user. | No       |
| `detailedError`       | ConnectivityError | Detailed information about an error. This is currently in beta and exact error messages may change.                                                                             | No       |

### Example

Below is an example of a `refresh:finished` event when the refresh operation finished with an error.

```json
{
  "context": {
    "userId": "3db31bdcc75555c4f0b8952984a9bd4f",
    "externalUserId": "f1b3688c649946cc8ee163d1554e853e"
  },
  "content": {
    "credentialsId": "9sd7f9kak102783dkd11j242hmhja8",
    "status": "AUTHENTICATION_ERROR",
    "credentialsStatus": "AUTHENTICATION_ERROR",
    "finished": 1618395156625,
    "source": "OPERATION_SOURCE_API",
    "sessionExpiryDate": 1654623101000,
    "detailedError": {
      "type": "USER_LOGIN_ERROR",
      "displayMessage": "",
      "details": {
        "reason": "STATIC_CREDENTIALS_INCORRECT",
        "retryable": false
      }
    }
  },
  "event": "refresh:finished"
}
```

## Event: Account transactions modified

Use our webhooks to subscribe to the following events: `account-transactions:modified` and `account-booked-transactions:modified`. For more information about the webhooks, see our Events API reference.

### Event logic

| Event name                             | Description                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `account-transactions:modified`        | Triggered when an account has new, updated or deleted transactions, regardless of their booking status |
| `account-booked-transactions:modified` | Triggered when an account has new, updated or deleted transactions that have status BOOKED             |

These events are triggered if an account has new or modified transactions (e.g: one or more transactions are added to an account, or an existing transaction is modified, for example because it has changed status). Each event is triggered once per account (so one refresh can trigger multiple notifications, if several accounts are updated).

### Event content

| Field                                      | Type   | Description                                                                                            | Required |
| ------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------ | -------- |
| `userId`                                   | string | The Tink User ID                                                                                       | Yes      |
| `externalUserId`                           | string | The Tink External User ID, if set when creating the user.                                              | No       |
| `account[id]`                              | string | The Tink Account ID                                                                                    | Yes      |
| `transactions[earliestModifiedBookedDate]` | string | The bookedDate (or expected bookedDate for PENDING transactions) of the earliest modified transaction. | No       |
| `transactions[latestModifiedBookedDate]`   | string | The bookedDate (or expected bookedDate for PENDING transactions) of the latest modified transaction.   | No       |
| `transactions[inserted]`                   | string | Number of new transactions for the account after refresh.                                              | No       |
| `transactions[updated]`                    | string | Number of updated transactions for the account after refresh.                                          | No       |
| `transactions[deleted]`                    | string | Number of deleted transactions for the account after refresh.                                          | No       |

To find the earliest and latest modified transaction bookedDate, use the `transaction[earliestModifiedBookedDate]` and `transaction[latestModifiedBookedDate]` content fields. Then, combine these dates with the `account[id]` using Transactions Query Parameters like `bookedDateGte`, `bookedDateLte`, and `accountIdIn` to fetch the list including all modified account transactions.

If you store Transactions data and want to sync only deleted transactions (e.g. when no inserted or updated transactions occurred after a refresh), see Events: Account transactions deleted.

### Example

Here's an example of an `account-transactions:modified` and `account-booked-transactions:modified` events:

**All account transactions example:**

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

**Booked account transactions example:**

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
      "id": "dfbe1bf22a6a4572835fbfc5f4e3f62d"
    },
    "transactions": {
      "earliestModifiedBookedDate": "2023-05-31",
      "latestModifiedBookedDate": "2023-06-01",
      "inserted": 1,
      "updated": 0,
      "deleted": 4
    }
  },
  "event": "account-booked-transactions:modified"
}
```

## Event: Account transactions deleted

Use our webhook to subscribe to the following event: `account-transactions:deleted`. For more information about the webhooks, see our Events API reference.

### Event logic

| Event name                     | Description                                                                            |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| `account-transactions:deleted` | Triggered when an account has deleted transactions, regardless of their booking status |

This event is triggered if an account has deleted transactions (e.g. one or more transactions were removed by a financial institution before booking). Each event is triggered once per account (so one refresh can trigger multiple notifications, if several accounts are updated for user).

### Event content

| Field               | Type   | Description                                               | Required |
| ------------------- | ------ | --------------------------------------------------------- | -------- |
| `userId`            | string | The Tink User ID                                          | Yes      |
| `externalUserId`    | string | The Tink External User ID, if set when creating the user. | No       |
| `account[id]`       | string | The Tink Account ID                                       | Yes      |
| `transactions[ids]` | list   | List of deleted transactions identifiers (id).            | No       |

If you store Transactions data locally and you want to synchronize only deleted transactions (when no inserted or updated transactions occurred after a refresh) you can use a `transactions[ids]` list to get all deleted transaction identifiers (`id` from List Transactions endpoint). These identifiers can be used to synchronize the deleted transactions without having to fetch the entire list of transactions.

### Example

Here's an example of an `account-transactions:deleted` event:

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
        "37e94e585e5446cc8864f56723f02de9",
        "f5e220dd49134821afffcd7fa6922ad8"
      ]
    }
  },
  "event": "account-transactions:deleted"
}
```
