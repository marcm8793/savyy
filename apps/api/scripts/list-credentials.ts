import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { user, bankAccount } from "../db/schema.js";
import { eq } from "drizzle-orm";

async function listCredentials() {
  try {
    console.log("📋 Listing user credentials for webhook testing...");

    const userEmail = process.argv[2];

    if (!userEmail) {
      console.error("Usage: tsx list-credentials.ts <user-email>");
      console.error("Example: tsx list-credentials.ts user@example.com");
      throw new Error("User email is required");
    }

    // Database connection
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    const db = drizzle(pool);

    // Find user by email
    const users = await db
      .select()
      .from(user)
      .where(eq(user.email, userEmail))
      .limit(1);

    if (users.length === 0) {
      console.error(`❌ User not found: ${userEmail}`);
      throw new Error(`User not found: ${userEmail}`);
    }

    const foundUser = users[0];
    console.log("👤 User found:");
    console.log("  ID:", foundUser.id);
    console.log("  Email:", foundUser.email);
    console.log("  Name:", foundUser.firstName, foundUser.lastName);

    // Find bank accounts for this user
    const accounts = await db
      .select()
      .from(bankAccount)
      .where(eq(bankAccount.userId, foundUser.id));

    if (accounts.length === 0) {
      console.log("ℹ️  No bank accounts found for this user");
      throw new Error("No bank accounts found for this user");
    }

    console.log(`\n🏦 Found ${accounts.length} bank account(s):`);

    accounts.forEach((account, index) => {
      console.log(`\n--- Account ${index + 1} ---`);
      console.log("  Account ID:", account.id);
      console.log("  Tink Account ID:", account.tinkAccountId);
      console.log("  Credentials ID:", account.credentialsId || "❌ Missing!");
      console.log("  Account Name:", account.accountName);
      console.log("  Account Type:", account.accountType || "Unknown");
      console.log(
        "  Financial Institution ID:",
        account.financialInstitutionId || "Unknown"
      );
      console.log(
        "  Has Access Token:",
        account.accessToken ? "✅ Yes" : "❌ No"
      );

      if (account.tokenExpiresAt) {
        const isExpired = account.tokenExpiresAt < new Date();
        console.log("  Token Expires:", account.tokenExpiresAt.toISOString());
        console.log("  Token Status:", isExpired ? "❌ Expired" : "✅ Valid");
      }

      // Show command to trigger webhook for this account
      if (account.credentialsId && account.accessToken) {
        const tokenExpired =
          account.tokenExpiresAt && account.tokenExpiresAt < new Date();
        if (!tokenExpired) {
          console.log("  🎯 Trigger Command:");
          console.log(
            `     npm run webhook:trigger-refresh ${account.credentialsId} "${account.accessToken}"`
          );
        } else {
          console.log("  ⚠️  Cannot trigger - token expired");
        }
      } else {
        console.log(
          "  ⚠️  Cannot trigger - missing credentials ID or access token"
        );
      }
    });

    console.log("\n💡 Tips:");
    console.log(
      "- Use the 'Trigger Command' above to manually trigger webhook events"
    );
    console.log(
      "- If tokens are expired, user needs to reconnect their bank account"
    );
    console.log("- Check your webhook endpoint logs after triggering");

    await pool.end();
  } catch (error) {
    console.error("❌ Failed to list credentials:", error);
    throw error;
  }
}

void listCredentials();
