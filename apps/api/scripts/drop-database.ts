import "dotenv/config";
import { dropAllTablesAndData } from "../db/db";
import process, { exit } from "node:process";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "drop":
      console.log(
        "⚠️  WARNING: This will permanently delete ALL tables and data!"
      );
      console.log("⚠️  Make sure you have a backup if needed.");
      console.log("⚠️  Press Ctrl+C within 5 seconds to cancel...");

      // Give user 5 seconds to cancel
      await new Promise((resolve) => setTimeout(resolve, 5000));

      await dropAllTablesAndData();
      break;

    default:
      console.log("Usage:");
      console.log(
        "  npm run db:drop     - Drop all tables and data (destructive)"
      );
      console.log("");
      console.log("Or run directly:");
      console.log("  npx tsx scripts/drop-database.ts drop");
      exit(1);
  }
}

main().catch((error) => {
  console.error("Script failed:", error);
  exit(1);
});
