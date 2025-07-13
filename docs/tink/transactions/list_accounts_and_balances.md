# List accounts and balances

To fetch a list of accounts for a specific user, you must have a `user access token` with the `balances:read` and `accounts:read` scopes. Use the `user access token` to make a request to the Accounts endpoint:

## Fetch a list of accounts

**Request example**

```bash
curl "https://api.tink.com/data/v2/accounts" \
  -H 'Authorization: Bearer {YOUR_USER_ACCESS_TOKEN}'
```

**Response example**

```json
{
  "accounts": [
    {
      "balances": {
        "booked": {
          "amount": {
            "currencyCode": "EUR",
            "value": {
              "scale": "-3",
              "unscaledValue": "19"
            }
          }
        }
      },
      "customerSegment": "UNDEFINED_CUSTOMER_SEGMENT",
      "dates": {
        "lastRefreshed": "2020-12-15T12:16:58Z"
      },
      "financialInstitutionId": "6e68cc6287704273984567b3300c5822",
      "id": "ee7ddbd178494220bb184791783f4f63",
      "identifiers": {
        "iban": {
          "bban": "0000011273547693",
          "iban": "SE6930000000011273547693"
        },
        "pan": {
          "masked": "4000 12** **** 9010"
        }
      },
      "name": "PERSONKONTO",
      "type": "CHECKING"
    }
  ],
  "nextPageToken": "string"
}
```
