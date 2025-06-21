#!/usr/bin/env tsx

import { TinkWebhookService } from "../src/services/tinkWebhookService.js";
import "dotenv/config";

async function listWebhooks() {
  try {
    console.log("📋 Listing Tink webhooks...");

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

    // List webhooks using Tink API
    const baseUrl = process.env.TINK_API_URL || "https://api.tink.com";
    const response = await fetch(`${baseUrl}/events/v2/webhook-endpoints`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${clientToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `❌ Failed to list webhooks: ${response.status} ${errorText}`
      );
      throw new Error(
        `Failed to list webhooks: ${response.status} ${errorText}`
      );
    }

    const webhooks = (await response.json()) as {
      webhookEndpoints?: Array<{
        id: string;
        url: string;
        description?: string;
        enabledEvents: string[];
        status?: string;
      }>;
    };

    console.log("🔗 Existing webhooks:");
    console.log(JSON.stringify(webhooks, null, 2));

    if (webhooks.webhookEndpoints && webhooks.webhookEndpoints.length > 0) {
      console.log(`\n📊 Found ${webhooks.webhookEndpoints.length} webhook(s):`);

      webhooks.webhookEndpoints.forEach((webhook, index: number) => {
        console.log(`\n--- Webhook ${index + 1} ---`);
        console.log("  ID:", webhook.id);
        console.log("  URL:", webhook.url);
        console.log("  Description:", webhook.description || "No description");
        console.log("  Enabled Events:", webhook.enabledEvents);
        console.log("  Status:", webhook.status || "Unknown");

        console.log(`\n  🗑️  Delete Command:`);
        console.log(`     npm run webhook:delete ${webhook.id}`);
      });

      console.log("\n💡 To recreate webhook with new secret:");
      console.log("1. Delete existing webhook using command above");
      console.log("2. Run: npm run webhook:setup <your-webhook-url>");
    } else {
      console.log("ℹ️  No webhooks found");
    }
  } catch (error) {
    console.error("❌ Failed to list webhooks:", error);
    throw error;
  }
}

void listWebhooks();
