# Managing consents

## Prerequisites

Completed all steps of Continuous access to a bank account.

## List provider consents

The Provider Consent model gives details about the state of the consents that a user has given for a financial institution. A user can give multiple consents, for one or multiple financial institutions. For more details on Provider Consent, see our API Reference.

To list provider consents, you must generate a user access token with the scope `provider-consents:read`. For instructions on how to generate an access token, see Get a user access token.

**Get the list of consents**

```bash
curl -v https://api.tink.com/api/v1/provider-consents \
     -H 'Authorization: Bearer {YOUR_USER_ACCESS_TOKEN}'
```

**Response example**

```json
{
  "providerConsents": [
    {
      "accountIds": [
        "6696428766444944ab19f7756376d363",
        "9bdd7d50c1f14946b6d22b198d1696b4"
      ],
      "credentialsId": "6e68cc6287704273984567b3300c5822",
      "detailedError": {
        "details": {
          "reason": "STATIC_CREDENTIALS_INCORRECT",
          "retryable": true
        },
        "displayMessage": "The bank rejected the login credentials that you entered.",
        "type": "USER_LOGIN_ERROR"
      },
      "providerName": "uk-demobank-open-banking-redirect",
      "sessionExpiryDate": 1493379467000,
      "status": "UPDATED",
      "statusUpdated": 1493379467000
    }
  ]
}
```

## Update a consent

An existing consent may stop working. This can be due to an expired session or to a bank that requires end-user reauthentication.

Update a consent to recover access to accounts. This is done by updating the consent to extend the validity of the session.

To update a consent, you must redirect your user to a Tink URL and include the `credentialsId` field of the consent and a single-use authorization code.

To generate the `authorization_code`, follow the steps in Generate the code.

**Generate your authorization_code**

```
https://link.tink.com/1.0/transactions/update-consent?client_id={YOUR_CLIENT_ID}&redirect_uri={YOUR_REDIRECT_URL}&credentials_id={THE_CREDENTIALS_ID}&authorization_code={TINK_LINK_AUTHORIZATION_CODE}&market={YOUR_MARKET_CODE}
```

For more information on which parameters can be provided to the update-consent method for the Tink URL, see Update consent.

## Delete a consent

To delete a consent, you must delete the corresponding credentials object. The examples in this section describe the process:

1. Use the `authorization:grant` scope to authorize your app and get a client access token.
2. Use the `credentials:write` scope to generate a user access token.
   > **Note:** use `user_id` or `external_user_id`, not both.
3. Use the user access token to delete the credential for this specific user.

The following example shows how to use your `client_id` and `client_secret` to fetch your client access token, which is required to grant authorization. Use the `authorization:grant` scope to authorize your app and get a client access token. Use this value in your authorized app to grant authorization.

**Get your client access token**

```bash
curl -v -X POST https://api.tink.com/api/v1/oauth/token \
-d 'client_id={YOUR_CLIENT_ID}' \
-d 'client_secret={YOUR_CLIENT_SECRET}' \
-d 'grant_type=client_credentials' \
-d 'scope=authorization:grant'
```

**Response example**

```json
{
  "access_token": "{YOUR_CLIENT_ACCESS_TOKEN}",
  "token_type": "bearer",
  "expires_in": 1800,
  "scope": "authorization:grant"
}
```

Generate a user access token with the `credentials:write` scope.

> **Note:** use `user_id` or `external_user_id`, not both.

**Generate a user access token**

```bash
curl -X POST https://api.tink.com/api/v1/oauth/authorization-grant \
-H 'Authorization: Bearer {YOUR_CLIENT_ACCESS_TOKEN}' \
-d 'user_id={THE_TINK_USER_ID}' \
-d 'external_user_id={YOUR_OWN_ID}' \
-d 'scope=credentials:write'
```

**Response example**

```json
{
  "code": "{USER_AUTHORIZATION_CODE}"
}
```

Use the user access token to delete the credential for this specific user.

**Request example**
_Delete the credential for a specific user_

```bash
curl -v -X DELETE https://api.tink.com/api/v1/credentials/{credentialsId} \
     -H 'Authorization: Bearer {YOUR_USER_ACCESS_TOKEN}'
```

Tink returns an HTTP 204 status code if the deletion request was successful.

> **Important note:** Multiple consents that give access to the same account can exist in parallel. When you delete all consents that are related to an account, the account information and its corresponding transactions are permanently deleted.

## Delete a user

When a user is deleted, all consents, related account information, and transactions are also permanently deleted.

To delete a user, you must generate a user access token with the scope `user:delete`. For instructions on how to generate an access token, see the Fetch user data section.

**Request example**
_Delete a user_

```bash
curl -v -X POST https://api.tink.com/api/v1/user/delete \
-H 'Authorization: Bearer {YOUR_USER_ACCESS_TOKEN}'
```
