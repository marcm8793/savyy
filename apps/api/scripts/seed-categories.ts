import "dotenv/config";
import { createDatabase } from "../db/db";
import { mainCategory, subCategory, mccCategoryMapping } from "../db/schema";

/**
 * Seed script for main categories, subcategories, and MCC mappings
 * Run with: npm run seed:categories
 */

interface MainCategoryDefinition {
  name: string;
  description: string;
  icon: string;
  color: string;
  sortOrder: number;
}

interface SubCategoryDefinition {
  mainCategoryName: string;
  name: string;
  description: string;
  icon?: string; // Optional icon for subcategory
  sortOrder: number;
}

// Main categories with their icons and colors
const mainCategories: MainCategoryDefinition[] = [
  {
    name: "Bills & Utilities",
    description: "Monthly bills and utility payments",
    icon: "CreditCard",
    color: "#EF4444",
    sortOrder: 1,
  },
  {
    name: "Shopping",
    description: "Retail purchases and shopping",
    icon: "ShoppingBag",
    color: "#8B5CF6",
    sortOrder: 2,
  },
  {
    name: "Food & Dining",
    description: "Restaurants, groceries, and food expenses",
    icon: "ForkKnife",
    color: "#F59E0B",
    sortOrder: 3,
  },
  {
    name: "Auto & Transport",
    description: "Transportation and vehicle expenses",
    icon: "Car",
    color: "#3B82F6",
    sortOrder: 4,
  },
  {
    name: "Bank",
    description: "Banking fees, transfers, and financial services",
    icon: "Bank",
    color: "#10B981",
    sortOrder: 5,
  },
  {
    name: "Business Services",
    description: "Professional and business-related services",
    icon: "Briefcase",
    color: "#6B7280",
    sortOrder: 6,
  },
  {
    name: "Misc. expenses",
    description: "Miscellaneous and other expenses",
    icon: "Heart",
    color: "#EC4899",
    sortOrder: 7,
  },
  {
    name: "Personal care",
    description: "Health, beauty, and personal care",
    icon: "PaintBrush",
    color: "#F43F5E",
    sortOrder: 8,
  },
  {
    name: "Taxes",
    description: "Tax payments and related expenses",
    icon: "Receipt",
    color: "#EAB308",
    sortOrder: 9,
  },
  {
    name: "Home",
    description: "Home improvement, furniture, and household items",
    icon: "House",
    color: "#059669",
    sortOrder: 10,
  },
  {
    name: "Entertainment",
    description: "Entertainment, leisure, and recreational activities",
    icon: "Trophy",
    color: "#A855F7",
    sortOrder: 11,
  },
  {
    name: "Withdrawals, checks & transfer",
    description: "ATM withdrawals, checks, and money transfers",
    icon: "ArrowsLeftRight",
    color: "#06B6D4",
    sortOrder: 12,
  },
  {
    name: "Health",
    description: "Medical expenses and healthcare",
    icon: "FirstAid",
    color: "#14B8A6",
    sortOrder: 13,
  },
  {
    name: "Education & Children",
    description: "Education expenses and children-related costs",
    icon: "GraduationCap",
    color: "#6366F1",
    sortOrder: 14,
  },
  {
    name: "Income",
    description: "Income and earnings",
    icon: "TrendUp",
    color: "#22C55E",
    sortOrder: 15,
  },
];

// Subcategories organized by main category (matching the provided table exactly)
const subCategories: SubCategoryDefinition[] = [
  // Bills & Utilities
  {
    mainCategoryName: "Bills & Utilities",
    name: "Subscription - Others",
    description: "Other subscription services",
    icon: "Receipt",
    sortOrder: 1,
  },
  {
    mainCategoryName: "Bills & Utilities",
    name: "Cable TV",
    description: "Cable television services",
    icon: "Television",
    sortOrder: 2,
  },
  {
    mainCategoryName: "Bills & Utilities",
    name: "Home phone",
    description: "Landline phone services",
    icon: "Phone",
    sortOrder: 3,
  },
  {
    mainCategoryName: "Bills & Utilities",
    name: "Internet",
    description: "Internet services",
    icon: "WifiHigh",
    sortOrder: 4,
  },
  {
    mainCategoryName: "Bills & Utilities",
    name: "Mobile phone",
    description: "Mobile phone services",
    icon: "DeviceMobile",
    sortOrder: 5,
  },

  // Shopping
  {
    mainCategoryName: "Shopping",
    name: "Gifts",
    description: "Gifts and charitable donations",
    icon: "Gift",
    sortOrder: 1,
  },
  {
    mainCategoryName: "Shopping",
    name: "High Tech",
    description: "Electronic devices and software",
    icon: "Cpu",
    sortOrder: 2,
  },
  {
    mainCategoryName: "Shopping",
    name: "Books",
    description: "Books and publications",
    icon: "Book",
    sortOrder: 3,
  },
  {
    mainCategoryName: "Shopping",
    name: "Clothing & Shoes",
    description: "Clothing and apparel",
    icon: "TShirt",
    sortOrder: 4,
  },
  {
    mainCategoryName: "Shopping",
    name: "Licences",
    description: "Software and digital licenses",
    icon: "Key",
    sortOrder: 5,
  },
  {
    mainCategoryName: "Shopping",
    name: "Movies",
    description: "Movies and entertainment media",
    icon: "FilmSlate",
    sortOrder: 6,
  },
  {
    mainCategoryName: "Shopping",
    name: "Music",
    description: "Music and audio purchases",
    icon: "MusicNote",
    sortOrder: 7,
  },
  {
    mainCategoryName: "Shopping",
    name: "Shopping - Others",
    description: "Other shopping expenses",
    icon: "ShoppingBag",
    sortOrder: 8,
  },
  {
    mainCategoryName: "Shopping",
    name: "Sporting goods",
    description: "Sports equipment and gear",
    icon: "Barbell",
    sortOrder: 9,
  },

  // Food & Dining
  {
    mainCategoryName: "Food & Dining",
    name: "Supermarkets / Groceries",
    description: "Grocery shopping",
    icon: "ShoppingCart",
    sortOrder: 1,
  },
  {
    mainCategoryName: "Food & Dining",
    name: "Restaurants",
    description: "Restaurant dining",
    icon: "ForkKnife",
    sortOrder: 2,
  },
  {
    mainCategoryName: "Food & Dining",
    name: "Coffee shop",
    description: "Coffee shops and cafes",
    icon: "Coffee",
    sortOrder: 3,
  },
  {
    mainCategoryName: "Food & Dining",
    name: "Fast foods",
    description: "Fast food restaurants",
    icon: "Lightning",
    sortOrder: 4,
  },
  {
    mainCategoryName: "Food & Dining",
    name: "Food - Others",
    description: "Other food expenses",
    icon: "ForkKnife",
    sortOrder: 5,
  },

  // Auto & Transport
  {
    mainCategoryName: "Auto & Transport",
    name: "Gas & Fuel",
    description: "Gasoline and fuel",
    icon: "GasPump",
    sortOrder: 1,
  },
  {
    mainCategoryName: "Auto & Transport",
    name: "Tolls",
    description: "Highway tolls and road fees",
    icon: "Coins",
    sortOrder: 2,
  },
  {
    mainCategoryName: "Auto & Transport",
    name: "Auto & Transport - Others",
    description: "Other transportation expenses",
    icon: "Car",
    sortOrder: 3,
  },
  {
    mainCategoryName: "Auto & Transport",
    name: "Auto insurance",
    description: "Vehicle insurance",
    icon: "Shield",
    sortOrder: 4,
  },
  {
    mainCategoryName: "Auto & Transport",
    name: "Car maintenance",
    description: "Vehicle maintenance and repairs",
    icon: "Wrench",
    sortOrder: 5,
  },
  {
    mainCategoryName: "Auto & Transport",
    name: "Car rental",
    description: "Vehicle rental services",
    icon: "Car",
    sortOrder: 6,
  },
  {
    mainCategoryName: "Auto & Transport",
    name: "Parking",
    description: "Parking fees",
    icon: "Square",
    sortOrder: 7,
  },
  {
    mainCategoryName: "Auto & Transport",
    name: "Plane ticket",
    description: "Flight tickets",
    icon: "Airplane",
    sortOrder: 8,
  },
  {
    mainCategoryName: "Auto & Transport",
    name: "Public transportation",
    description: "Public transit",
    icon: "Bus",
    sortOrder: 9,
  },
  {
    mainCategoryName: "Auto & Transport",
    name: "Train ticket",
    description: "Train travel tickets",
    icon: "Train",
    sortOrder: 10,
  },

  // Bank
  {
    mainCategoryName: "Bank",
    name: "Mortgage refund",
    description: "Mortgage refunds and credits",
    icon: "House",
    sortOrder: 1,
  },
  {
    mainCategoryName: "Bank",
    name: "Banking fees and charges",
    description: "Bank fees and charges",
    icon: "Receipt",
    sortOrder: 2,
  },
  {
    mainCategoryName: "Bank",
    name: "Bank - Others",
    description: "Other banking transactions",
    icon: "Bank",
    sortOrder: 3,
  },
  {
    mainCategoryName: "Bank",
    name: "Banking services",
    description: "Banking services",
    icon: "Bank",
    sortOrder: 4,
  },
  {
    mainCategoryName: "Bank",
    name: "Monthly Debit",
    description: "Monthly debit transactions",
    icon: "Calendar",
    sortOrder: 5,
  },
  {
    mainCategoryName: "Bank",
    name: "Mortgage",
    description: "Mortgage payments",
    icon: "House",
    sortOrder: 6,
  },
  {
    mainCategoryName: "Bank",
    name: "Payment incidents",
    description: "Payment incidents and fees",
    icon: "WarningOctagon",
    sortOrder: 7,
  },
  {
    mainCategoryName: "Bank",
    name: "Savings",
    description: "Savings transfers",
    icon: "PiggyBank",
    sortOrder: 8,
  },

  // Business Services
  {
    mainCategoryName: "Business Services",
    name: "Online services",
    description: "Online business services",
    icon: "Globe",
    sortOrder: 1,
  },
  {
    mainCategoryName: "Business Services",
    name: "Accounting",
    description: "Accounting services",
    icon: "Calculator",
    sortOrder: 2,
  },
  {
    mainCategoryName: "Business Services",
    name: "Advertising",
    description: "Advertising expenses",
    icon: "Megaphone",
    sortOrder: 3,
  },
  {
    mainCategoryName: "Business Services",
    name: "Business expenses",
    description: "General business expenses",
    icon: "Briefcase",
    sortOrder: 4,
  },
  {
    mainCategoryName: "Business Services",
    name: "Business services - Others",
    description: "Other business services",
    icon: "Briefcase",
    sortOrder: 5,
  },
  {
    mainCategoryName: "Business Services",
    name: "Consulting",
    description: "Consulting services",
    icon: "Users",
    sortOrder: 6,
  },
  {
    mainCategoryName: "Business Services",
    name: "Disability Insurance",
    description: "Disability insurance premiums",
    icon: "Shield",
    sortOrder: 7,
  },
  {
    mainCategoryName: "Business Services",
    name: "Employer contributions",
    description: "Employer benefit contributions",
    icon: "HandCoins",
    sortOrder: 8,
  },
  {
    mainCategoryName: "Business Services",
    name: "Hiring fees",
    description: "Recruitment and hiring fees",
    icon: "UserPlus",
    sortOrder: 9,
  },
  {
    mainCategoryName: "Business Services",
    name: "Legal Fees",
    description: "Legal services and fees",
    icon: "Scales",
    sortOrder: 10,
  },
  {
    mainCategoryName: "Business Services",
    name: "Marketing",
    description: "Marketing expenses",
    icon: "TrendUp",
    sortOrder: 11,
  },
  {
    mainCategoryName: "Business Services",
    name: "Office services",
    description: "Office services",
    icon: "Building",
    sortOrder: 12,
  },
  {
    mainCategoryName: "Business Services",
    name: "Office supplies",
    description: "Office supplies and equipment",
    icon: "Paperclip",
    sortOrder: 13,
  },
  {
    mainCategoryName: "Business Services",
    name: "Outsourcing",
    description: "Outsourcing services",
    icon: "Share",
    sortOrder: 14,
  },
  {
    mainCategoryName: "Business Services",
    name: "Printing",
    description: "Printing services",
    icon: "File",
    sortOrder: 15,
  },
  {
    mainCategoryName: "Business Services",
    name: "Salaries",
    description: "Employee salaries",
    icon: "Money",
    sortOrder: 16,
  },
  {
    mainCategoryName: "Business Services",
    name: "Salary of executives",
    description: "Executive compensation",
    icon: "Briefcase",
    sortOrder: 17,
  },
  {
    mainCategoryName: "Business Services",
    name: "Shipping",
    description: "Shipping and logistics",
    icon: "PaperPlane",
    sortOrder: 18,
  },
  {
    mainCategoryName: "Business Services",
    name: "Training taxes",
    description: "Training and education taxes",
    icon: "GraduationCap",
    sortOrder: 19,
  },

  // Misc. expenses
  {
    mainCategoryName: "Misc. expenses",
    name: "Insurance",
    description: "General insurance expenses",
    icon: "Shield",
    sortOrder: 1,
  },
  {
    mainCategoryName: "Misc. expenses",
    name: "Charity",
    description: "Charitable donations",
    icon: "Heart",
    sortOrder: 2,
  },
  {
    mainCategoryName: "Misc. expenses",
    name: "Laundry / Dry cleaning",
    description: "Laundry and dry cleaning services",
    icon: "TShirt",
    sortOrder: 3,
  },
  {
    mainCategoryName: "Misc. expenses",
    name: "Others spending",
    description: "Other miscellaneous expenses",
    icon: "DotsThreeOutline",
    sortOrder: 4,
  },
  {
    mainCategoryName: "Misc. expenses",
    name: "Tobacco",
    description: "Tobacco products",
    icon: "Circle",
    sortOrder: 5,
  },
  {
    mainCategoryName: "Misc. expenses",
    name: "Uncategorized",
    description: "Uncategorized expenses",
    icon: "DotsThreeOutline",
    sortOrder: 6,
  },

  // Personal care
  {
    mainCategoryName: "Personal care",
    name: "Hairdresser",
    description: "Hair care services",
    icon: "Scissors",
    sortOrder: 1,
  },
  {
    mainCategoryName: "Personal care",
    name: "Beauty care",
    description: "Beauty care services",
    icon: "PaintBrush",
    sortOrder: 2,
  },
  {
    mainCategoryName: "Personal care",
    name: "Cosmetics",
    description: "Cosmetics and beauty products",
    icon: "PaintBrush",
    sortOrder: 3,
  },
  {
    mainCategoryName: "Personal care",
    name: "Personal care - Others",
    description: "Other personal care expenses",
    icon: "PaintBrush",
    sortOrder: 4,
  },
  {
    mainCategoryName: "Personal care",
    name: "Spa & Massage",
    description: "Spa and massage services",
    icon: "Heart",
    sortOrder: 5,
  },

  // Taxes
  {
    mainCategoryName: "Taxes",
    name: "Fine",
    description: "Fines and penalties",
    icon: "WarningOctagon",
    sortOrder: 1,
  },
  {
    mainCategoryName: "Taxes",
    name: "Incomes taxes",
    description: "Income tax payments",
    icon: "Receipt",
    sortOrder: 2,
  },
  {
    mainCategoryName: "Taxes",
    name: "Property taxes",
    description: "Property tax payments",
    icon: "House",
    sortOrder: 3,
  },
  {
    mainCategoryName: "Taxes",
    name: "Taxes",
    description: "General tax payments",
    icon: "Receipt",
    sortOrder: 4,
  },
  {
    mainCategoryName: "Taxes",
    name: "Taxes - Others",
    description: "Other tax payments",
    icon: "Receipt",
    sortOrder: 5,
  },
  {
    mainCategoryName: "Taxes",
    name: "VAT",
    description: "Value-added tax",
    icon: "Receipt",
    sortOrder: 6,
  },

  // Home
  {
    mainCategoryName: "Home",
    name: "Electricity",
    description: "Electricity bills",
    icon: "Lightning",
    sortOrder: 1,
  },
  {
    mainCategoryName: "Home",
    name: "Gas",
    description: "Gas utility bills",
    icon: "GasPump",
    sortOrder: 2,
  },
  {
    mainCategoryName: "Home",
    name: "Home - Others",
    description: "Other home expenses",
    icon: "House",
    sortOrder: 3,
  },
  {
    mainCategoryName: "Home",
    name: "Home improvement",
    description: "Home improvement projects",
    icon: "Hammer",
    sortOrder: 4,
  },
  {
    mainCategoryName: "Home",
    name: "Home insurance",
    description: "Home insurance premiums",
    icon: "ShieldCheck",
    sortOrder: 5,
  },
  {
    mainCategoryName: "Home",
    name: "Lawn & Garden",
    description: "Lawn and garden maintenance",
    icon: "Plant",
    sortOrder: 6,
  },
  {
    mainCategoryName: "Home",
    name: "Maintenance",
    description: "Home maintenance and repairs",
    icon: "Wrench",
    sortOrder: 7,
  },
  {
    mainCategoryName: "Home",
    name: "Misc. utilities",
    description: "Miscellaneous utilities",
    icon: "Lightning",
    sortOrder: 8,
  },
  {
    mainCategoryName: "Home",
    name: "Rent",
    description: "Rent payments",
    icon: "House",
    sortOrder: 9,
  },
  {
    mainCategoryName: "Home",
    name: "Water",
    description: "Water utility bills",
    icon: "Drop",
    sortOrder: 10,
  },

  // Entertainment
  {
    mainCategoryName: "Entertainment",
    name: "Sports",
    description: "Sports events and activities",
    icon: "Trophy",
    sortOrder: 1,
  },
  {
    mainCategoryName: "Entertainment",
    name: "Entertainment - Others",
    description: "Other entertainment",
    icon: "Smiley",
    sortOrder: 2,
  },
  {
    mainCategoryName: "Entertainment",
    name: "Amusements",
    description: "Amusement activities",
    icon: "GameController",
    sortOrder: 3,
  },
  {
    mainCategoryName: "Entertainment",
    name: "Arts & Amusement",
    description: "Arts and cultural events",
    icon: "Palette",
    sortOrder: 4,
  },
  {
    mainCategoryName: "Entertainment",
    name: "Bars & Clubs",
    description: "Bars and nightclubs",
    icon: "Wine",
    sortOrder: 5,
  },
  {
    mainCategoryName: "Entertainment",
    name: "Eating out",
    description: "Dining out entertainment",
    icon: "ForkKnife",
    sortOrder: 6,
  },
  {
    mainCategoryName: "Entertainment",
    name: "Hobbies",
    description: "Hobby expenses",
    icon: "Heart",
    sortOrder: 7,
  },
  {
    mainCategoryName: "Entertainment",
    name: "Hotels",
    description: "Hotel accommodations",
    icon: "Bed",
    sortOrder: 8,
  },
  {
    mainCategoryName: "Entertainment",
    name: "Pets",
    description: "Pet-related expenses",
    icon: "Heart",
    sortOrder: 9,
  },
  {
    mainCategoryName: "Entertainment",
    name: "Travels / Vacation",
    description: "Travel and vacation expenses",
    icon: "MapPin",
    sortOrder: 10,
  },
  {
    mainCategoryName: "Entertainment",
    name: "Winter sports",
    description: "Winter sports activities",
    icon: "Snowflake",
    sortOrder: 11,
  },

  // Withdrawals, checks & transfer
  {
    mainCategoryName: "Withdrawals, checks & transfer",
    name: "Transfer",
    description: "Money transfers",
    icon: "ArrowsLeftRight",
    sortOrder: 1,
  },
  {
    mainCategoryName: "Withdrawals, checks & transfer",
    name: "Checks",
    description: "Check payments",
    icon: "Receipt",
    sortOrder: 2,
  },
  {
    mainCategoryName: "Withdrawals, checks & transfer",
    name: "Internal transfer",
    description: "Internal account transfers",
    icon: "ArrowsLeftRight",
    sortOrder: 3,
  },
  {
    mainCategoryName: "Withdrawals, checks & transfer",
    name: "Withdrawals",
    description: "Cash withdrawals",
    icon: "Money",
    sortOrder: 4,
  },

  // Health
  {
    mainCategoryName: "Health",
    name: "Dentist",
    description: "Dental care",
    icon: "FirstAid",
    sortOrder: 1,
  },
  {
    mainCategoryName: "Health",
    name: "Doctor",
    description: "Medical appointments",
    icon: "Stethoscope",
    sortOrder: 2,
  },
  {
    mainCategoryName: "Health",
    name: "Health - Others",
    description: "Other healthcare expenses",
    icon: "FirstAid",
    sortOrder: 3,
  },
  {
    mainCategoryName: "Health",
    name: "Health insurance",
    description: "Health insurance premiums",
    icon: "ShieldCheck",
    sortOrder: 4,
  },
  {
    mainCategoryName: "Health",
    name: "Optician / Eyecare",
    description: "Eye care and optician services",
    icon: "Eye",
    sortOrder: 5,
  },
  {
    mainCategoryName: "Health",
    name: "Pharmacy",
    description: "Prescription medications",
    icon: "Pill",
    sortOrder: 6,
  },

  // Education & Children
  {
    mainCategoryName: "Education & Children",
    name: "Baby-sitter & Daycare",
    description: "Childcare services",
    icon: "Baby",
    sortOrder: 1,
  },
  {
    mainCategoryName: "Education & Children",
    name: "Education & Children - Others",
    description: "Other education and children expenses",
    icon: "GraduationCap",
    sortOrder: 2,
  },
  {
    mainCategoryName: "Education & Children",
    name: "Pension",
    description: "Pension contributions",
    icon: "PiggyBank",
    sortOrder: 3,
  },
  {
    mainCategoryName: "Education & Children",
    name: "School supplies",
    description: "School supplies and materials",
    icon: "Book",
    sortOrder: 4,
  },
  {
    mainCategoryName: "Education & Children",
    name: "Student housing",
    description: "Student housing expenses",
    icon: "House",
    sortOrder: 5,
  },
  {
    mainCategoryName: "Education & Children",
    name: "Student loan",
    description: "Student loan payments",
    icon: "Money",
    sortOrder: 6,
  },
  {
    mainCategoryName: "Education & Children",
    name: "Toys",
    description: "Toys and games",
    icon: "PuzzlePiece",
    sortOrder: 7,
  },
  {
    mainCategoryName: "Education & Children",
    name: "Tuition",
    description: "Tuition payments",
    icon: "GraduationCap",
    sortOrder: 8,
  },

  // Income
  {
    mainCategoryName: "Income",
    name: "Deposit",
    description: "Bank deposits and incoming transfers",
    icon: "ArrowDown",
    sortOrder: 1,
  },
  {
    mainCategoryName: "Income",
    name: "Extra incomes",
    description: "Additional income sources",
    icon: "Plus",
    sortOrder: 2,
  },
  {
    mainCategoryName: "Income",
    name: "Grants",
    description: "Government and institutional grants",
    icon: "HandCoins",
    sortOrder: 3,
  },
  {
    mainCategoryName: "Income",
    name: "Interest incomes",
    description: "Interest from investments and savings",
    icon: "TrendUp",
    sortOrder: 4,
  },
  {
    mainCategoryName: "Income",
    name: "Internal transfer",
    description: "Transfers between own accounts",
    icon: "ArrowsLeftRight",
    sortOrder: 5,
  },
  {
    mainCategoryName: "Income",
    name: "Loans",
    description: "Loan proceeds and disbursements",
    icon: "HandCoins",
    sortOrder: 6,
  },
  {
    mainCategoryName: "Income",
    name: "Other incomes",
    description: "Other miscellaneous income",
    icon: "DotsThreeOutline",
    sortOrder: 7,
  },
  {
    mainCategoryName: "Income",
    name: "Pension",
    description: "Pension and retirement income",
    icon: "PiggyBank",
    sortOrder: 8,
  },
  {
    mainCategoryName: "Income",
    name: "Refunds",
    description: "Refunds and reimbursements",
    icon: "ArrowCounterClockwise",
    sortOrder: 9,
  },
  {
    mainCategoryName: "Income",
    name: "Rent",
    description: "Rental income from properties",
    icon: "House",
    sortOrder: 10,
  },
  {
    mainCategoryName: "Income",
    name: "Retirement",
    description: "Retirement benefits and distributions",
    icon: "Clock",
    sortOrder: 11,
  },
  {
    mainCategoryName: "Income",
    name: "Salaries",
    description: "Salary and wage income",
    icon: "Money",
    sortOrder: 12,
  },
  {
    mainCategoryName: "Income",
    name: "Sales",
    description: "Income from sales of goods or services",
    icon: "ShoppingBag",
    sortOrder: 13,
  },
  {
    mainCategoryName: "Income",
    name: "Savings",
    description: "Transfers from savings accounts",
    icon: "PiggyBank",
    sortOrder: 14,
  },
  {
    mainCategoryName: "Income",
    name: "Services",
    description: "Income from service provision",
    icon: "Briefcase",
    sortOrder: 15,
  },
];

async function seedCategories() {
  const { db, pool } = createDatabase();

  try {
    console.log("🌱 Starting category seeding...");

    // Clear existing data
    console.log("🧹 Clearing existing data...");
    await db.delete(mccCategoryMapping);
    await db.delete(subCategory);
    await db.delete(mainCategory);

    // Insert main categories
    console.log("📂 Inserting main categories...");
    const insertedMainCategories = await db
      .insert(mainCategory)
      .values(
        mainCategories.map((cat) => ({
          name: cat.name,
          description: cat.description,
          icon: cat.icon,
          color: cat.color,
          sortOrder: cat.sortOrder,
        }))
      )
      .returning();

    console.log(`✅ Inserted ${insertedMainCategories.length} main categories`);

    // Create a map of main category names to IDs
    const mainCategoryMap = new Map<string, string>();
    insertedMainCategories.forEach((cat: { name: string; id: string }) => {
      mainCategoryMap.set(cat.name, cat.id);
    });

    // Insert subcategories
    console.log("📄 Inserting subcategories...");
    const subCategoryInserts = subCategories
      .map((subCat) => {
        const mainCategoryId = mainCategoryMap.get(subCat.mainCategoryName);
        if (!mainCategoryId) {
          console.warn(
            `⚠️  Main category not found: ${subCat.mainCategoryName}`
          );
          return null;
        }
        return {
          mainCategoryId,
          name: subCat.name,
          description: subCat.description,
          icon: subCat.icon,
          sortOrder: subCat.sortOrder,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (subCategoryInserts.length > 0) {
      await db.insert(subCategory).values(subCategoryInserts);
      console.log(`✅ Inserted ${subCategoryInserts.length} subcategories`);
    }
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
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Seeding failed:", error);
      process.exit(1);
    });
}

export { seedCategories };
