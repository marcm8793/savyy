import "dotenv/config";
import { createDatabase } from "../db/db";
import { categoryDefinition, mccCategoryMapping } from "../db/schema";

/**
 * Seed script for category definitions and MCC mappings
 * Run with: npm run seed:categories
 */

const defaultCategories = [
  // Income
  {
    main: "Income",
    sub: "Salary",
    description: "Regular salary payments",
    icon: "wallet",
    color: "#10B981",
    sortOrder: 1,
  },
  {
    main: "Income",
    sub: "Bonus",
    description: "Bonus payments and commissions",
    icon: "gift",
    color: "#10B981",
    sortOrder: 2,
  },
  {
    main: "Income",
    sub: "Freelance",
    description: "Freelance and contract work",
    icon: "briefcase",
    color: "#10B981",
    sortOrder: 3,
  },
  {
    main: "Income",
    sub: "Investment",
    description: "Dividends and investment returns",
    icon: "trending-up",
    color: "#10B981",
    sortOrder: 4,
  },
  {
    main: "Income",
    sub: "Refunds",
    description: "Refunds and reimbursements",
    icon: "refresh-ccw",
    color: "#10B981",
    sortOrder: 5,
  },
  {
    main: "Income",
    sub: "Other Income",
    description: "Other income sources",
    icon: "plus-circle",
    color: "#10B981",
    sortOrder: 6,
  },

  // Food & Dining
  {
    main: "Food & Dining",
    sub: "Groceries",
    description: "Supermarket and grocery shopping",
    icon: "shopping-cart",
    color: "#F59E0B",
    sortOrder: 10,
  },
  {
    main: "Food & Dining",
    sub: "Restaurants",
    description: "Restaurant meals and dining out",
    icon: "utensils",
    color: "#F59E0B",
    sortOrder: 11,
  },
  {
    main: "Food & Dining",
    sub: "Fast Food",
    description: "Fast food and quick meals",
    icon: "zap",
    color: "#F59E0B",
    sortOrder: 12,
  },
  {
    main: "Food & Dining",
    sub: "Coffee",
    description: "Coffee shops and cafes",
    icon: "coffee",
    color: "#F59E0B",
    sortOrder: 13,
  },
  {
    main: "Food & Dining",
    sub: "Delivery",
    description: "Food delivery services",
    icon: "truck",
    color: "#F59E0B",
    sortOrder: 14,
  },
  {
    main: "Food & Dining",
    sub: "Alcohol",
    description: "Bars and alcoholic beverages",
    icon: "wine",
    color: "#F59E0B",
    sortOrder: 15,
  },

  // Transportation
  {
    main: "Transportation",
    sub: "Public Transit",
    description: "Buses, trains, and metro",
    icon: "train",
    color: "#3B82F6",
    sortOrder: 20,
  },
  {
    main: "Transportation",
    sub: "Ride Share",
    description: "Uber, taxi, and ride sharing",
    icon: "car",
    color: "#3B82F6",
    sortOrder: 21,
  },
  {
    main: "Transportation",
    sub: "Fuel",
    description: "Gas and fuel expenses",
    icon: "fuel",
    color: "#3B82F6",
    sortOrder: 22,
  },
  {
    main: "Transportation",
    sub: "Parking",
    description: "Parking fees and tickets",
    icon: "square",
    color: "#3B82F6",
    sortOrder: 23,
  },
  {
    main: "Transportation",
    sub: "Car Maintenance",
    description: "Car repairs and maintenance",
    icon: "wrench",
    color: "#3B82F6",
    sortOrder: 24,
  },
  {
    main: "Transportation",
    sub: "Other Transport",
    description: "Other transportation costs",
    icon: "map-pin",
    color: "#3B82F6",
    sortOrder: 25,
  },

  // Shopping
  {
    main: "Shopping",
    sub: "Clothing",
    description: "Clothes and accessories",
    icon: "shirt",
    color: "#8B5CF6",
    sortOrder: 30,
  },
  {
    main: "Shopping",
    sub: "Electronics",
    description: "Electronics and gadgets",
    icon: "smartphone",
    color: "#8B5CF6",
    sortOrder: 31,
  },
  {
    main: "Shopping",
    sub: "Home & Garden",
    description: "Home improvement and garden",
    icon: "home",
    color: "#8B5CF6",
    sortOrder: 32,
  },
  {
    main: "Shopping",
    sub: "Online",
    description: "Online shopping",
    icon: "globe",
    color: "#8B5CF6",
    sortOrder: 33,
  },
  {
    main: "Shopping",
    sub: "Books & Media",
    description: "Books, movies, and media",
    icon: "book",
    color: "#8B5CF6",
    sortOrder: 34,
  },
  {
    main: "Shopping",
    sub: "Other Shopping",
    description: "Other shopping expenses",
    icon: "shopping-bag",
    color: "#8B5CF6",
    sortOrder: 35,
  },

  // Bills & Utilities
  {
    main: "Bills & Utilities",
    sub: "Rent",
    description: "Monthly rent payments",
    icon: "home",
    color: "#EF4444",
    sortOrder: 40,
  },
  {
    main: "Bills & Utilities",
    sub: "Energy",
    description: "Electricity and gas bills",
    icon: "zap",
    color: "#EF4444",
    sortOrder: 41,
  },
  {
    main: "Bills & Utilities",
    sub: "Phone",
    description: "Mobile and landline bills",
    icon: "phone",
    color: "#EF4444",
    sortOrder: 42,
  },
  {
    main: "Bills & Utilities",
    sub: "Internet",
    description: "Internet and cable bills",
    icon: "wifi",
    color: "#EF4444",
    sortOrder: 43,
  },
  {
    main: "Bills & Utilities",
    sub: "Insurance",
    description: "Insurance premiums",
    icon: "shield",
    color: "#EF4444",
    sortOrder: 44,
  },
  {
    main: "Bills & Utilities",
    sub: "Taxes",
    description: "Tax payments",
    icon: "file-text",
    color: "#EF4444",
    sortOrder: 45,
  },
  {
    main: "Bills & Utilities",
    sub: "Other Bills",
    description: "Other utility bills",
    icon: "file",
    color: "#EF4444",
    sortOrder: 46,
  },

  // Entertainment
  {
    main: "Entertainment",
    sub: "Streaming",
    description: "Netflix, Spotify, etc.",
    icon: "play-circle",
    color: "#06B6D4",
    sortOrder: 50,
  },
  {
    main: "Entertainment",
    sub: "Movies & Theater",
    description: "Cinema and theater tickets",
    icon: "film",
    color: "#06B6D4",
    sortOrder: 51,
  },
  {
    main: "Entertainment",
    sub: "Events",
    description: "Concerts and events",
    icon: "calendar",
    color: "#06B6D4",
    sortOrder: 52,
  },
  {
    main: "Entertainment",
    sub: "Gaming",
    description: "Video games and gaming",
    icon: "gamepad-2",
    color: "#06B6D4",
    sortOrder: 53,
  },
  {
    main: "Entertainment",
    sub: "Hobbies",
    description: "Hobby-related expenses",
    icon: "heart",
    color: "#06B6D4",
    sortOrder: 54,
  },
  {
    main: "Entertainment",
    sub: "Other Entertainment",
    description: "Other entertainment",
    icon: "smile",
    color: "#06B6D4",
    sortOrder: 55,
  },

  // Health & Fitness
  {
    main: "Health & Fitness",
    sub: "Healthcare",
    description: "Doctor visits and medical",
    icon: "heart-pulse",
    color: "#EC4899",
    sortOrder: 60,
  },
  {
    main: "Health & Fitness",
    sub: "Pharmacy",
    description: "Medications and pharmacy",
    icon: "pill",
    color: "#EC4899",
    sortOrder: 61,
  },
  {
    main: "Health & Fitness",
    sub: "Fitness",
    description: "Gym and fitness activities",
    icon: "dumbbell",
    color: "#EC4899",
    sortOrder: 62,
  },
  {
    main: "Health & Fitness",
    sub: "Wellness",
    description: "Spa and wellness services",
    icon: "leaf",
    color: "#EC4899",
    sortOrder: 63,
  },

  // Banking
  {
    main: "Banking",
    sub: "Transfer",
    description: "Money transfers",
    icon: "arrow-right-left",
    color: "#6B7280",
    sortOrder: 70,
  },
  {
    main: "Banking",
    sub: "ATM",
    description: "ATM withdrawals",
    icon: "credit-card",
    color: "#6B7280",
    sortOrder: 71,
  },
  {
    main: "Banking",
    sub: "Fees",
    description: "Bank fees and charges",
    icon: "minus-circle",
    color: "#6B7280",
    sortOrder: 72,
  },
  {
    main: "Banking",
    sub: "Investment",
    description: "Investment transactions",
    icon: "trending-up",
    color: "#6B7280",
    sortOrder: 73,
  },

  // Other
  {
    main: "Other",
    sub: "Uncategorized",
    description: "Uncategorized transactions",
    icon: "help-circle",
    color: "#9CA3AF",
    sortOrder: 80,
  },
  {
    main: "Other",
    sub: "Personal Care",
    description: "Personal care and beauty",
    icon: "user",
    color: "#9CA3AF",
    sortOrder: 81,
  },
  {
    main: "Other",
    sub: "Education",
    description: "Education and learning",
    icon: "graduation-cap",
    color: "#9CA3AF",
    sortOrder: 82,
  },
  {
    main: "Other",
    sub: "Gifts & Donations",
    description: "Gifts and charitable donations",
    icon: "gift",
    color: "#9CA3AF",
    sortOrder: 83,
  },
];

// Common MCC codes and their mappings
const mccMappings = [
  // Food & Dining
  {
    code: "5411",
    description: "Grocery Stores, Supermarkets",
    main: "Food & Dining",
    sub: "Groceries",
    confidence: 0.95,
  },
  {
    code: "5812",
    description: "Eating Places, Restaurants",
    main: "Food & Dining",
    sub: "Restaurants",
    confidence: 0.9,
  },
  {
    code: "5814",
    description: "Fast Food Restaurants",
    main: "Food & Dining",
    sub: "Fast Food",
    confidence: 0.95,
  },
  {
    code: "5499",
    description: "Miscellaneous Food Stores",
    main: "Food & Dining",
    sub: "Groceries",
    confidence: 0.8,
  },
  {
    code: "5813",
    description: "Drinking Places (Alcoholic Beverages)",
    main: "Food & Dining",
    sub: "Alcohol",
    confidence: 0.95,
  },

  // Transportation
  {
    code: "5541",
    description: "Service Stations (with or without Ancillary Services)",
    main: "Transportation",
    sub: "Fuel",
    confidence: 0.95,
  },
  {
    code: "5542",
    description: "Automated Fuel Dispensers",
    main: "Transportation",
    sub: "Fuel",
    confidence: 0.95,
  },
  {
    code: "4121",
    description: "Taxicabs and Limousines",
    main: "Transportation",
    sub: "Ride Share",
    confidence: 0.9,
  },
  {
    code: "4111",
    description: "Transportation - Suburban and Local Commuter Passenger",
    main: "Transportation",
    sub: "Public Transit",
    confidence: 0.9,
  },
  {
    code: "7523",
    description: "Parking Lots, Parking Meters",
    main: "Transportation",
    sub: "Parking",
    confidence: 0.95,
  },
  {
    code: "5531",
    description: "Auto and Home Supply Stores",
    main: "Transportation",
    sub: "Car Maintenance",
    confidence: 0.8,
  },

  // Shopping
  {
    code: "5691",
    description: "Mens and Womens Clothing Stores",
    main: "Shopping",
    sub: "Clothing",
    confidence: 0.95,
  },
  {
    code: "5651",
    description: "Family Clothing Stores",
    main: "Shopping",
    sub: "Clothing",
    confidence: 0.95,
  },
  {
    code: "5732",
    description: "Electronics Stores",
    main: "Shopping",
    sub: "Electronics",
    confidence: 0.95,
  },
  {
    code: "5734",
    description: "Computer Software Stores",
    main: "Shopping",
    sub: "Electronics",
    confidence: 0.9,
  },
  {
    code: "5200",
    description: "Home Supply Warehouse Stores",
    main: "Shopping",
    sub: "Home & Garden",
    confidence: 0.9,
  },
  {
    code: "5942",
    description: "Book Stores",
    main: "Shopping",
    sub: "Books & Media",
    confidence: 0.95,
  },

  // Entertainment
  {
    code: "7832",
    description: "Motion Picture Theaters",
    main: "Entertainment",
    sub: "Movies & Theater",
    confidence: 0.95,
  },
  {
    code: "7922",
    description: "Theatrical Producers and Miscellaneous Entertainment",
    main: "Entertainment",
    sub: "Events",
    confidence: 0.85,
  },
  {
    code: "7994",
    description: "Video Game Arcades/Establishments",
    main: "Entertainment",
    sub: "Gaming",
    confidence: 0.95,
  },
  {
    code: "7997",
    description: "Membership Clubs (Sports, Recreation, Athletic)",
    main: "Health & Fitness",
    sub: "Fitness",
    confidence: 0.85,
  },

  // Health & Fitness
  {
    code: "8011",
    description: "Doctors",
    main: "Health & Fitness",
    sub: "Healthcare",
    confidence: 0.95,
  },
  {
    code: "8021",
    description: "Dentists, Orthodontists",
    main: "Health & Fitness",
    sub: "Healthcare",
    confidence: 0.95,
  },
  {
    code: "5912",
    description: "Drug Stores and Pharmacies",
    main: "Health & Fitness",
    sub: "Pharmacy",
    confidence: 0.95,
  },
  {
    code: "7298",
    description: "Health and Beauty Spas",
    main: "Health & Fitness",
    sub: "Wellness",
    confidence: 0.9,
  },

  // Utilities
  {
    code: "4900",
    description: "Utilities - Electric, Gas, Water, Sanitary",
    main: "Bills & Utilities",
    sub: "Energy",
    confidence: 0.95,
  },
  {
    code: "4814",
    description: "Telecommunication Services",
    main: "Bills & Utilities",
    sub: "Phone",
    confidence: 0.9,
  },
  {
    code: "4816",
    description: "Computer Network/Information Services",
    main: "Bills & Utilities",
    sub: "Internet",
    confidence: 0.9,
  },

  // Banking & Finance
  {
    code: "6011",
    description: "Automated Cash Dispensers",
    main: "Banking",
    sub: "ATM",
    confidence: 0.95,
  },
  {
    code: "6012",
    description: "Financial Institutions",
    main: "Banking",
    sub: "Transfer",
    confidence: 0.8,
  },
  {
    code: "6051",
    description: "Non-Financial Institutions",
    main: "Banking",
    sub: "Fees",
    confidence: 0.7,
  },

  // Insurance
  {
    code: "6300",
    description: "Insurance Sales, Underwriting, and Premiums",
    main: "Bills & Utilities",
    sub: "Insurance",
    confidence: 0.95,
  },

  // Government
  {
    code: "9311",
    description: "Tax Payments",
    main: "Bills & Utilities",
    sub: "Taxes",
    confidence: 0.95,
  },
  {
    code: "9399",
    description: "Government Services",
    main: "Bills & Utilities",
    sub: "Other Bills",
    confidence: 0.8,
  },
];

async function seedCategories() {
  const { db, pool } = createDatabase();

  try {
    console.log("🌱 Starting category seeding...");

    // Insert category definitions
    console.log("📁 Inserting category definitions...");
    for (const category of defaultCategories) {
      await db
        .insert(categoryDefinition)
        .values({
          mainCategory: category.main,
          subCategory: category.sub,
          description: category.description,
          icon: category.icon,
          color: category.color,
          sortOrder: category.sortOrder,
        })
        .onConflictDoNothing();
    }
    console.log(`✅ Inserted ${defaultCategories.length} category definitions`);

    // Insert MCC mappings
    console.log("🏷️  Inserting MCC mappings...");
    for (const mcc of mccMappings) {
      await db
        .insert(mccCategoryMapping)
        .values({
          mccCode: mcc.code,
          mccDescription: mcc.description,
          mainCategory: mcc.main,
          subCategory: mcc.sub,
          confidence: mcc.confidence.toString(),
        })
        .onConflictDoNothing();
    }
    console.log(`✅ Inserted ${mccMappings.length} MCC mappings`);

    console.log("🎉 Category seeding completed successfully!");
  } catch (error) {
    console.error("❌ Error seeding categories:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the seeding if this file is executed directly
if (require.main === module) {
  seedCategories()
    .then(() => {
      console.log("✅ Seeding completed");
    })
    .catch((error) => {
      console.error("❌ Seeding failed:", error);
      throw new Error("Seeding failed, exiting process.");
    });
}

export { seedCategories };
