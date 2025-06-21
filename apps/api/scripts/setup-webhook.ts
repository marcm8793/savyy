import { TinkWebhookService } from "../src/services/tinkWebhookService.js";
import "dotenv/config";

async function setupWebhook() {
  try {
    console.log("Setting up Tink webhook...");

    const webhookUrl = process.argv[2];
    console.log("Webhook URL:", webhookUrl);

    if (!webhookUrl) {
      console.error("Usage: tsx setup-webhook.ts <webhook-url>");
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
