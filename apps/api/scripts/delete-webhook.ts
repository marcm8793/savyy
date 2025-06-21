#!/usr/bin/env tsx

import { TinkWebhookService } from "../src/services/tinkWebhookService.js";
import "dotenv/config";

async function deleteWebhook() {
  try {
    console.log("🗑️  Deleting Tink webhook...");

    const webhookId = process.argv[2];

    if (!webhookId) {
      console.error("Usage: tsx delete-webhook.ts <webhook-id>");
      console.error("Example: tsx delete-webhook.ts abc123def456");
      throw new Error("Webhook ID is required");
    }

    if (!process.env.TINK_CLIENT_ID || !process.env.TINK_CLIENT_SECRET) {
      console.error(
        "Missing required environment variables: TINK_CLIENT_ID, TINK_CLIENT_SECRET"
      );
      throw new Error(
        "Missing required environment variables: TINK_CLIENT_ID, TINK_CLIENT_SECRET"
      );
    }

    const webhookService = new TinkWebhookService();

    // Get client access token
    const clientToken = await webhookService.getWebhookClientAccessToken();

    // Delete webhook using Tink API
    const baseUrl = process.env.TINK_API_URL || "https://api.tink.com";
    const response = await fetch(
      `${baseUrl}/events/v2/webhook-endpoints/${webhookId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${clientToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `❌ Failed to delete webhook: ${response.status} ${errorText}`
      );
      throw new Error(
        `Failed to delete webhook: ${response.status} ${errorText}`
      );
    }

    console.log(`✅ Webhook ${webhookId} deleted successfully!`);
    console.log("\n💡 Next steps:");
    console.log("1. Run: npm run webhook:setup <your-webhook-url>");
    console.log("2. Copy the TINK_WEBHOOK_SECRET from the output");
    console.log("3. Add it to your .env file");
    console.log("4. Restart your application");
  } catch (error) {
    console.error("❌ Failed to delete webhook:", error);
    throw error;
  }
}

void deleteWebhook();
