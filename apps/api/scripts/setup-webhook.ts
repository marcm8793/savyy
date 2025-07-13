import { TinkWebhookService } from "../src/services/tinkWebhookService.js";
import "dotenv/config";

/**
 * Setup Tink webhook endpoint
 * 
 * Webhook URL can be provided via:
 * 1. TINK_WEBHOOK_URL environment variable (recommended)
 * 2. Command line argument: tsx setup-webhook.ts <webhook-url>
 * 
 * Example: TINK_WEBHOOK_URL=https://yourdomain.com/api/webhook/tink
 */
async function setupWebhook() {
  try {
    console.log("Setting up Tink webhook...");

    // Read webhook URL from environment variable first, then command line argument
    const webhookUrl = process.env.TINK_WEBHOOK_URL || process.argv[2];
    console.log("Webhook URL:", webhookUrl);

    if (!webhookUrl) {
      console.error("Webhook URL is required. Provide it via:");
      console.error("1. Environment variable: TINK_WEBHOOK_URL=https://yourdomain.com/api/webhook/tink");
      console.error("2. Command line argument: tsx setup-webhook.ts <webhook-url>");
      console.error(
        "Example: tsx setup-webhook.ts https://yourdomain.com/api/webhook/tink"
      );
      throw new Error("Webhook URL is required");
    }

    if (!process.env.TINK_CLIENT_ID || !process.env.TINK_CLIENT_SECRET) {
      console.error(
        "Missing required environment variables: TINK_CLIENT_ID, TINK_CLIENT_SECRET"
      );
      throw new Error(
        "Missing required environment variables: TINK_CLIENT_ID, TINK_CLIENT_SECRET"
      );
    }

    console.log("Setting up Tink webhook...");
    console.log("Webhook URL:", webhookUrl);

    const webhookService = new TinkWebhookService();

    const webhookResponse = await webhookService.createWebhookEndpoint(
      webhookUrl,
      "Savyy Webhook",
      [
        "refresh:finished",
        "account-transactions:modified",
        "account-booked-transactions:modified",
        "account-transactions:deleted",
        "account:created",
        "account:updated",
      ]
    );

    console.log("\n✅ Webhook setup successful!");
    console.log("Webhook ID:", webhookResponse.id);
    console.log("Enabled Events:", webhookResponse.enabledEvents);
    console.log("\n🔐 IMPORTANT: Store this webhook secret securely:");
    console.log("TINK_WEBHOOK_SECRET=" + webhookResponse.secret);
    console.log(
      "\nAdd this to your environment variables and restart your application."
    );
  } catch (error) {
    console.error("❌ Failed to setup webhook:", error);
    throw new Error("Failed to setup webhook");
  }
}

void setupWebhook();
