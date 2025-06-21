#!/usr/bin/env tsx

import "dotenv/config";
import crypto from "crypto";

async function testWebhookWithSignature() {
  const webhookUrl =
    process.argv[2] ||
    "https://pheasant-cunning-rodent.ngrok-free.app/api/webhook/tink";
  const webhookSecret = process.env.TINK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("❌ TINK_WEBHOOK_SECRET environment variable is required");
    console.log("Set it with: export TINK_WEBHOOK_SECRET=your_webhook_secret");
    throw new Error("TINK_WEBHOOK_SECRET environment variable is required");
  }

  console.log(
    "🧪 Testing webhook endpoint with proper signatures:",
    webhookUrl
  );

  // Test payload - refresh:finished event
  const testPayload = {
    context: {
      userId: "test-user-123",
      externalUserId: "external-user-456",
    },
    content: {
      credentialsId: "test-credentials-id",
      credentialsStatus: "UPDATED",
      finished: Math.floor(Date.now() / 1000),
      source: "OPERATION_SOURCE_API",
    },
    event: "refresh:finished",
  };

  // Test payload - account-transactions:modified event
  const transactionPayload = {
    context: {
      userId: "test-user-123",
      externalUserId: "external-user-456",
    },
    content: {
      account: {
        id: "test-account-123",
      },
      transactions: {
        earliestModifiedBookedDate: "2024-01-01",
        latestModifiedBookedDate: "2024-01-02",
        inserted: 5,
        updated: 2,
        deleted: 0,
      },
    },
    event: "account-transactions:modified",
  };

  const payloads = [
    { name: "Refresh Finished", payload: testPayload },
    { name: "Transactions Modified", payload: transactionPayload },
  ];

  for (const { name, payload } of payloads) {
    try {
      console.log(`\n📤 Testing: ${name}`);

      const requestBody = JSON.stringify(payload);
      const timestamp = Math.floor(Date.now() / 1000);

      // Generate proper HMAC signature like Tink does
      const messageToSign = `${timestamp}.${requestBody}`;
      const signature = crypto
        .createHmac("sha256", webhookSecret)
        .update(messageToSign)
        .digest("hex");

      const tinkSignature = `t=${timestamp},v1=${signature}`;

      console.log("🔐 Generated signature:", tinkSignature);

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Tink-Signature": tinkSignature,
          "User-Agent": "Tink-Webhook-Test/1.0",
        },
        body: requestBody,
      });

      console.log(
        `📊 Response Status: ${response.status} ${response.statusText}`
      );

      if (response.ok) {
        console.log("✅ Webhook test successful!");
        const responseText = await response.text();
        if (responseText) {
          console.log("📝 Response:", responseText);
        }
      } else {
        console.log("❌ Webhook test failed");
        const errorText = await response.text();
        console.log("📝 Error:", errorText);
      }
    } catch (error) {
      console.error(`❌ Failed to test ${name}:`, error);
    }
  }
}

void testWebhookWithSignature();
