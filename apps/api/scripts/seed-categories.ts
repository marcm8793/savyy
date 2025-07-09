import "dotenv/config";
import { createDatabase } from "../db/db";
import { categoryDefinition, mccCategoryMapping } from "../db/schema";

/**
 * Seed script for category definitions and MCC mappings
 * Run with: npm run seed:categories
 */

interface CategoryDefinition {
  main: string;
  sub: string;
  description: string;
  icon: string;
  color: string;
  sortOrder: number;
}

interface MCCMapping {
  code: string;
  description: string;
  main: string;
  sub: string;
  confidence: number;
}

const defaultCategories: CategoryDefinition[] = [
  // Bills & Utilities
  {
    main: "Bills & Utilities",
    sub: "Subscription - Others",
    description: "Other subscription services",
    icon: "CreditCard",
    color: "#EF4444",
    sortOrder: 1,
  },
  {
    main: "Bills & Utilities",
    sub: "Cable TV",
    description: "Cable television services",
    icon: "Television",
    color: "#EF4444",
    sortOrder: 2,
  },
  {
    main: "Bills & Utilities",
    sub: "Home phone",
    description: "Landline phone services",
    icon: "Phone",
    color: "#EF4444",
    sortOrder: 3,
  },
  {
    main: "Bills & Utilities",
    sub: "Internet",
    description: "Internet services",
    icon: "WifiHigh",
    color: "#EF4444",
    sortOrder: 4,
  },
  {
    main: "Bills & Utilities",
    sub: "Mobile phone",
    description: "Mobile phone services",
    icon: "DeviceMobile",
    color: "#EF4444",
    sortOrder: 5,
  },

  // Shopping
  {
    main: "Shopping",
    sub: "Gifts",
    description: "Gifts and presents",
    icon: "Gift",
    color: "#8B5CF6",
    sortOrder: 10,
  },
  {
    main: "Shopping",
    sub: "High Tech",
    description: "Technology and electronics",
    icon: "Cpu",
    color: "#8B5CF6",
    sortOrder: 11,
  },
  {
    main: "Shopping",
    sub: "Books",
    description: "Books and publications",
    icon: "Book",
    color: "#8B5CF6",
    sortOrder: 12,
  },
  {
    main: "Shopping",
    sub: "Clothing & Shoes",
    description: "Clothing and footwear",
    icon: "TShirt",
    color: "#8B5CF6",
    sortOrder: 13,
  },
  {
    main: "Shopping",
    sub: "Licences",
    description: "Software licenses and permits",
    icon: "Key",
    color: "#8B5CF6",
    sortOrder: 14,
  },
  {
    main: "Shopping",
    sub: "Movies",
    description: "Movies and video content",
    icon: "FilmSlate",
    color: "#8B5CF6",
    sortOrder: 15,
  },
  {
    main: "Shopping",
    sub: "Music",
    description: "Music and audio content",
    icon: "MusicNote",
    color: "#8B5CF6",
    sortOrder: 16,
  },
  {
    main: "Shopping",
    sub: "Shopping - Others",
    description: "Other shopping expenses",
    icon: "ShoppingBag",
    color: "#8B5CF6",
    sortOrder: 17,
  },
  {
    main: "Shopping",
    sub: "Sporting goods",
    description: "Sports equipment and gear",
    icon: "Barbell",
    color: "#8B5CF6",
    sortOrder: 18,
  },

  // Food & Dining
  {
    main: "Food & Dining",
    sub: "Supermarkets / Groceries",
    description: "Grocery shopping",
    icon: "ShoppingCart",
    color: "#F59E0B",
    sortOrder: 20,
  },
  {
    main: "Food & Dining",
    sub: "Restaurants",
    description: "Restaurant dining",
    icon: "ForkKnife",
    color: "#F59E0B",
    sortOrder: 21,
  },
  {
    main: "Food & Dining",
    sub: "Coffee shop",
    description: "Coffee shops and cafes",
    icon: "Coffee",
    color: "#F59E0B",
    sortOrder: 22,
  },
  {
    main: "Food & Dining",
    sub: "Fast foods",
    description: "Fast food restaurants",
    icon: "Lightning",
    color: "#F59E0B",
    sortOrder: 23,
  },
  {
    main: "Food & Dining",
    sub: "Food - Others",
    description: "Other food expenses",
    icon: "ForkKnife",
    color: "#F59E0B",
    sortOrder: 24,
  },

  // Auto & Transport
  {
    main: "Auto & Transport",
    sub: "Gas & Fuel",
    description: "Vehicle fuel expenses",
    icon: "GasPump",
    color: "#3B82F6",
    sortOrder: 30,
  },
  {
    main: "Auto & Transport",
    sub: "Tolls",
    description: "Road tolls and fees",
    icon: "Path",
    color: "#3B82F6",
    sortOrder: 31,
  },
  {
    main: "Auto & Transport",
    sub: "Auto & Transport - Others",
    description: "Other transportation expenses",
    icon: "Car",
    color: "#3B82F6",
    sortOrder: 32,
  },
  {
    main: "Auto & Transport",
    sub: "Auto insurance",
    description: "Vehicle insurance",
    icon: "Shield",
    color: "#3B82F6",
    sortOrder: 33,
  },
  {
    main: "Auto & Transport",
    sub: "Car maintenance",
    description: "Vehicle maintenance and repairs",
    icon: "Wrench",
    color: "#3B82F6",
    sortOrder: 34,
  },
  {
    main: "Auto & Transport",
    sub: "Car rental",
    description: "Vehicle rental services",
    icon: "Car",
    color: "#3B82F6",
    sortOrder: 35,
  },
  {
    main: "Auto & Transport",
    sub: "Parking",
    description: "Parking fees",
    icon: "Square",
    color: "#3B82F6",
    sortOrder: 36,
  },
  {
    main: "Auto & Transport",
    sub: "Plane ticket",
    description: "Air travel expenses",
    icon: "Airplane",
    color: "#3B82F6",
    sortOrder: 37,
  },
  {
    main: "Auto & Transport",
    sub: "Public transportation",
    description: "Public transit fares",
    icon: "Bus",
    color: "#3B82F6",
    sortOrder: 38,
  },
  {
    main: "Auto & Transport",
    sub: "Train ticket",
    description: "Train travel expenses",
    icon: "Train",
    color: "#3B82F6",
    sortOrder: 39,
  },

  // Bank
  {
    main: "Bank",
    sub: "Mortgage refund",
    description: "Mortgage refunds and credits",
    icon: "House",
    color: "#6B7280",
    sortOrder: 40,
  },
  {
    main: "Bank",
    sub: "Banking fees and charges",
    description: "Bank service fees",
    icon: "Money",
    color: "#6B7280",
    sortOrder: 41,
  },
  {
    main: "Bank",
    sub: "Bank - Others",
    description: "Other banking transactions",
    icon: "Buildings",
    color: "#6B7280",
    sortOrder: 42,
  },
  {
    main: "Bank",
    sub: "Banking services",
    description: "Banking service charges",
    icon: "CreditCard",
    color: "#6B7280",
    sortOrder: 43,
  },
  {
    main: "Bank",
    sub: "Monthly Debit",
    description: "Recurring monthly debits",
    icon: "Calendar",
    color: "#6B7280",
    sortOrder: 44,
  },
  {
    main: "Bank",
    sub: "Mortgage",
    description: "Mortgage payments",
    icon: "House",
    color: "#6B7280",
    sortOrder: 45,
  },
  {
    main: "Bank",
    sub: "Payment incidents",
    description: "Payment issues and penalties",
    icon: "WarningCircle",
    color: "#6B7280",
    sortOrder: 46,
  },
  {
    main: "Bank",
    sub: "Savings",
    description: "Savings account transfers",
    icon: "PiggyBank",
    color: "#6B7280",
    sortOrder: 47,
  },

  // Business Services
  {
    main: "Business Services",
    sub: "Online services",
    description: "Online business services",
    icon: "Globe",
    color: "#7C3AED",
    sortOrder: 50,
  },
  {
    main: "Business Services",
    sub: "Accounting",
    description: "Accounting services",
    icon: "Calculator",
    color: "#7C3AED",
    sortOrder: 51,
  },
  {
    main: "Business Services",
    sub: "Advertising",
    description: "Advertising and promotion",
    icon: "Megaphone",
    color: "#7C3AED",
    sortOrder: 52,
  },
  {
    main: "Business Services",
    sub: "Business expenses",
    description: "General business expenses",
    icon: "Briefcase",
    color: "#7C3AED",
    sortOrder: 53,
  },
  {
    main: "Business Services",
    sub: "Business services - Others",
    description: "Other business services",
    icon: "Building",
    color: "#7C3AED",
    sortOrder: 54,
  },
  {
    main: "Business Services",
    sub: "Consulting",
    description: "Consulting services",
    icon: "Users",
    color: "#7C3AED",
    sortOrder: 55,
  },
  {
    main: "Business Services",
    sub: "Disability Insurance",
    description: "Disability insurance premiums",
    icon: "ShieldCheck",
    color: "#7C3AED",
    sortOrder: 56,
  },
  {
    main: "Business Services",
    sub: "Employer contributions",
    description: "Employer benefit contributions",
    icon: "HandCoins",
    color: "#7C3AED",
    sortOrder: 57,
  },
  {
    main: "Business Services",
    sub: "Hiring fees",
    description: "Recruitment and hiring costs",
    icon: "UserPlus",
    color: "#7C3AED",
    sortOrder: 58,
  },
  {
    main: "Business Services",
    sub: "Legal Fees",
    description: "Legal services",
    icon: "Scales",
    color: "#7C3AED",
    sortOrder: 59,
  },
  {
    main: "Business Services",
    sub: "Marketing",
    description: "Marketing expenses",
    icon: "TrendUp",
    color: "#7C3AED",
    sortOrder: 60,
  },
  {
    main: "Business Services",
    sub: "Office services",
    description: "Office-related services",
    icon: "Buildings",
    color: "#7C3AED",
    sortOrder: 61,
  },
  {
    main: "Business Services",
    sub: "Office supplies",
    description: "Office supplies and equipment",
    icon: "Paperclip",
    color: "#7C3AED",
    sortOrder: 62,
  },
  {
    main: "Business Services",
    sub: "Outsourcing",
    description: "Outsourced services",
    icon: "ShareNetwork",
    color: "#7C3AED",
    sortOrder: 63,
  },
  {
    main: "Business Services",
    sub: "Printing",
    description: "Printing services",
    icon: "Printer",
    color: "#7C3AED",
    sortOrder: 64,
  },
  {
    main: "Business Services",
    sub: "Salaries",
    description: "Employee salaries",
    icon: "Users",
    color: "#7C3AED",
    sortOrder: 65,
  },
  {
    main: "Business Services",
    sub: "Salary of executives",
    description: "Executive compensation",
    icon: "UserCheck",
    color: "#7C3AED",
    sortOrder: 66,
  },
  {
    main: "Business Services",
    sub: "Shipping",
    description: "Shipping and freight costs",
    icon: "Package",
    color: "#7C3AED",
    sortOrder: 67,
  },
  {
    main: "Business Services",
    sub: "Training taxes",
    description: "Training-related taxes",
    icon: "GraduationCap",
    color: "#7C3AED",
    sortOrder: 68,
  },

  // Misc. expenses
  {
    main: "Misc. expenses",
    sub: "Insurance",
    description: "Insurance premiums",
    icon: "Shield",
    color: "#9CA3AF",
    sortOrder: 70,
  },
  {
    main: "Misc. expenses",
    sub: "Charity",
    description: "Charitable donations",
    icon: "Heart",
    color: "#9CA3AF",
    sortOrder: 71,
  },
  {
    main: "Misc. expenses",
    sub: "Laundry / Dry cleaning",
    description: "Laundry and dry cleaning services",
    icon: "TShirt",
    color: "#9CA3AF",
    sortOrder: 72,
  },
  {
    main: "Misc. expenses",
    sub: "Others spending",
    description: "Other miscellaneous expenses",
    icon: "DotsThreeOutline",
    color: "#9CA3AF",
    sortOrder: 73,
  },
  {
    main: "Misc. expenses",
    sub: "Tobacco",
    description: "Tobacco products",
    icon: "Circle",
    color: "#9CA3AF",
    sortOrder: 74,
  },
  {
    main: "Misc. expenses",
    sub: "Uncategorized",
    description: "Uncategorized transactions",
    icon: "Question",
    color: "#9CA3AF",
    sortOrder: 75,
  },

  // Personal care
  {
    main: "Personal care",
    sub: "Hairdresser",
    description: "Hair salon services",
    icon: "Scissors",
    color: "#EC4899",
    sortOrder: 80,
  },
  {
    main: "Personal care",
    sub: "Beauty care",
    description: "Beauty treatments",
    icon: "Sparkle",
    color: "#EC4899",
    sortOrder: 81,
  },
  {
    main: "Personal care",
    sub: "Cosmetics",
    description: "Cosmetics and makeup",
    icon: "Palette",
    color: "#EC4899",
    sortOrder: 82,
  },
  {
    main: "Personal care",
    sub: "Personal care - Others",
    description: "Other personal care",
    icon: "User",
    color: "#EC4899",
    sortOrder: 83,
  },
  {
    main: "Personal care",
    sub: "Spa & Massage",
    description: "Spa and massage services",
    icon: "Heart",
    color: "#EC4899",
    sortOrder: 84,
  },

  // Taxes
  {
    main: "Taxes",
    sub: "Fine",
    description: "Fines and penalties",
    icon: "WarningOctagon",
    color: "#DC2626",
    sortOrder: 90,
  },
  {
    main: "Taxes",
    sub: "Incomes taxes",
    description: "Income tax payments",
    icon: "FileText",
    color: "#DC2626",
    sortOrder: 91,
  },
  {
    main: "Taxes",
    sub: "Property taxes",
    description: "Property tax payments",
    icon: "House",
    color: "#DC2626",
    sortOrder: 92,
  },
  {
    main: "Taxes",
    sub: "Taxes",
    description: "General tax payments",
    icon: "Receipt",
    color: "#DC2626",
    sortOrder: 93,
  },
  {
    main: "Taxes",
    sub: "Taxes - Others",
    description: "Other tax payments",
    icon: "File",
    color: "#DC2626",
    sortOrder: 94,
  },
  {
    main: "Taxes",
    sub: "VAT",
    description: "Value-added tax",
    icon: "Percent",
    color: "#DC2626",
    sortOrder: 95,
  },

  // Home
  {
    main: "Home",
    sub: "Electricity",
    description: "Electricity bills",
    icon: "Lightning",
    color: "#059669",
    sortOrder: 100,
  },
  {
    main: "Home",
    sub: "Gas",
    description: "Gas bills",
    icon: "Flame",
    color: "#059669",
    sortOrder: 101,
  },
  {
    main: "Home",
    sub: "Home - Others",
    description: "Other home expenses",
    icon: "House",
    color: "#059669",
    sortOrder: 102,
  },
  {
    main: "Home",
    sub: "Home improvement",
    description: "Home improvement projects",
    icon: "Hammer",
    color: "#059669",
    sortOrder: 103,
  },
  {
    main: "Home",
    sub: "Home insurance",
    description: "Home insurance premiums",
    icon: "ShieldCheck",
    color: "#059669",
    sortOrder: 104,
  },
  {
    main: "Home",
    sub: "Lawn & Garden",
    description: "Lawn and garden care",
    icon: "Tree",
    color: "#059669",
    sortOrder: 105,
  },
  {
    main: "Home",
    sub: "Maintenance",
    description: "Home maintenance",
    icon: "Wrench",
    color: "#059669",
    sortOrder: 106,
  },
  {
    main: "Home",
    sub: "Misc. utilities",
    description: "Other utility services",
    icon: "Gear",
    color: "#059669",
    sortOrder: 107,
  },
  {
    main: "Home",
    sub: "Rent",
    description: "Monthly rent payments",
    icon: "Key",
    color: "#059669",
    sortOrder: 108,
  },
  {
    main: "Home",
    sub: "Water",
    description: "Water bills",
    icon: "Drop",
    color: "#059669",
    sortOrder: 109,
  },

  // Entertainment
  {
    main: "Entertainment",
    sub: "Sports",
    description: "Sports events and activities",
    icon: "Trophy",
    color: "#06B6D4",
    sortOrder: 110,
  },
  {
    main: "Entertainment",
    sub: "Entertainment - Others",
    description: "Other entertainment",
    icon: "Smiley",
    color: "#06B6D4",
    sortOrder: 111,
  },
  {
    main: "Entertainment",
    sub: "Amusements",
    description: "Amusement activities",
    icon: "Smiley",
    color: "#06B6D4",
    sortOrder: 112,
  },
  {
    main: "Entertainment",
    sub: "Arts & Amusement",
    description: "Arts and cultural events",
    icon: "Palette",
    color: "#06B6D4",
    sortOrder: 113,
  },
  {
    main: "Entertainment",
    sub: "Bars & Clubs",
    description: "Bars and nightclubs",
    icon: "Wine",
    color: "#06B6D4",
    sortOrder: 114,
  },
  {
    main: "Entertainment",
    sub: "Eating out",
    description: "Dining out entertainment",
    icon: "ForkKnife",
    color: "#06B6D4",
    sortOrder: 115,
  },
  {
    main: "Entertainment",
    sub: "Hobbies",
    description: "Hobby expenses",
    icon: "Heart",
    color: "#06B6D4",
    sortOrder: 116,
  },
  {
    main: "Entertainment",
    sub: "Hotels",
    description: "Hotel accommodations",
    icon: "Bed",
    color: "#06B6D4",
    sortOrder: 117,
  },
  {
    main: "Entertainment",
    sub: "Pets",
    description: "Pet-related expenses",
    icon: "Heart",
    color: "#06B6D4",
    sortOrder: 118,
  },
  {
    main: "Entertainment",
    sub: "Travels / Vacation",
    description: "Travel and vacation expenses",
    icon: "MapPin",
    color: "#06B6D4",
    sortOrder: 119,
  },
  {
    main: "Entertainment",
    sub: "Winter sports",
    description: "Winter sports activities",
    icon: "Snowflake",
    color: "#06B6D4",
    sortOrder: 120,
  },

  // Withdrawals, checks & transfer
  {
    main: "Withdrawals, checks & transfer",
    sub: "Transfer",
    description: "Money transfers",
    icon: "ArrowsLeftRight",
    color: "#6366F1",
    sortOrder: 130,
  },
  {
    main: "Withdrawals, checks & transfer",
    sub: "Checks",
    description: "Check deposits and payments",
    icon: "FileCheck",
    color: "#6366F1",
    sortOrder: 131,
  },
  {
    main: "Withdrawals, checks & transfer",
    sub: "Internal transfer",
    description: "Internal account transfers",
    icon: "Repeat",
    color: "#6366F1",
    sortOrder: 132,
  },
  {
    main: "Withdrawals, checks & transfer",
    sub: "Withdrawals",
    description: "Cash withdrawals",
    icon: "Money",
    color: "#6366F1",
    sortOrder: 133,
  },

  // Health
  {
    main: "Health",
    sub: "Dentist",
    description: "Dental care",
    icon: "Smiley",
    color: "#10B981",
    sortOrder: 140,
  },
  {
    main: "Health",
    sub: "Doctor",
    description: "Medical consultations",
    icon: "Activity",
    color: "#10B981",
    sortOrder: 141,
  },
  {
    main: "Health",
    sub: "Health - Others",
    description: "Other health expenses",
    icon: "Heartbeat",
    color: "#10B981",
    sortOrder: 142,
  },
  {
    main: "Health",
    sub: "Health insurance",
    description: "Health insurance premiums",
    icon: "Shield",
    color: "#10B981",
    sortOrder: 143,
  },
  {
    main: "Health",
    sub: "Optician / Eyecare",
    description: "Eye care and glasses",
    icon: "Eye",
    color: "#10B981",
    sortOrder: 144,
  },
  {
    main: "Health",
    sub: "Pharmacy",
    description: "Medications and pharmacy",
    icon: "Pill",
    color: "#10B981",
    sortOrder: 145,
  },

  // Education & Children
  {
    main: "Education & Children",
    sub: "Baby-sitter & Daycare",
    description: "Childcare services",
    icon: "Baby",
    color: "#F59E0B",
    sortOrder: 150,
  },
  {
    main: "Education & Children",
    sub: "Education & Children - Others",
    description: "Other education expenses",
    icon: "BookOpen",
    color: "#F59E0B",
    sortOrder: 151,
  },
  {
    main: "Education & Children",
    sub: "Pension",
    description: "Education pension contributions",
    icon: "Wallet",
    color: "#F59E0B",
    sortOrder: 152,
  },
  {
    main: "Education & Children",
    sub: "School supplies",
    description: "School materials and supplies",
    icon: "Book",
    color: "#F59E0B",
    sortOrder: 153,
  },
  {
    main: "Education & Children",
    sub: "Student housing",
    description: "Student accommodation",
    icon: "Buildings",
    color: "#F59E0B",
    sortOrder: 154,
  },
  {
    main: "Education & Children",
    sub: "Student loan",
    description: "Student loan payments",
    icon: "GraduationCap",
    color: "#F59E0B",
    sortOrder: 155,
  },
  {
    main: "Education & Children",
    sub: "Toys",
    description: "Toys and games",
    icon: "GameController",
    color: "#F59E0B",
    sortOrder: 156,
  },
  {
    main: "Education & Children",
    sub: "Tuition",
    description: "Education tuition fees",
    icon: "Student",
    color: "#F59E0B",
    sortOrder: 157,
  },
];

// Common MCC codes and their mappings
const mccMappings: MCCMapping[] = [
  // Food & Dining
  {
    code: "5411",
    description: "Grocery Stores, Supermarkets",
    main: "Food & Dining",
    sub: "Supermarkets / Groceries",
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
    sub: "Fast foods",
    confidence: 0.95,
  },
  {
    code: "5499",
    description: "Miscellaneous Food Stores",
    main: "Food & Dining",
    sub: "Supermarkets / Groceries",
    confidence: 0.8,
  },
  {
    code: "5813",
    description: "Drinking Places (Alcoholic Beverages)",
    main: "Entertainment",
    sub: "Bars & Clubs",
    confidence: 0.95,
  },

  // Auto & Transport
  {
    code: "5541",
    description: "Service Stations (with or without Ancillary Services)",
    main: "Auto & Transport",
    sub: "Gas & Fuel",
    confidence: 0.95,
  },
  {
    code: "5542",
    description: "Automated Fuel Dispensers",
    main: "Auto & Transport",
    sub: "Gas & Fuel",
    confidence: 0.95,
  },
  {
    code: "4121",
    description: "Taxicabs and Limousines",
    main: "Auto & Transport",
    sub: "Auto & Transport - Others",
    confidence: 0.9,
  },
  {
    code: "4111",
    description: "Transportation - Suburban and Local Commuter Passenger",
    main: "Auto & Transport",
    sub: "Public transportation",
    confidence: 0.9,
  },
  {
    code: "7523",
    description: "Parking Lots, Parking Meters",
    main: "Auto & Transport",
    sub: "Parking",
    confidence: 0.95,
  },
  {
    code: "5531",
    description: "Auto and Home Supply Stores",
    main: "Auto & Transport",
    sub: "Car maintenance",
    confidence: 0.8,
  },

  // Shopping
  {
    code: "5691",
    description: "Mens and Womens Clothing Stores",
    main: "Shopping",
    sub: "Clothing & Shoes",
    confidence: 0.95,
  },
  {
    code: "5651",
    description: "Family Clothing Stores",
    main: "Shopping",
    sub: "Clothing & Shoes",
    confidence: 0.95,
  },
  {
    code: "5732",
    description: "Electronics Stores",
    main: "Shopping",
    sub: "High Tech",
    confidence: 0.95,
  },
  {
    code: "5734",
    description: "Computer Software Stores",
    main: "Shopping",
    sub: "High Tech",
    confidence: 0.9,
  },
  {
    code: "5200",
    description: "Home Supply Warehouse Stores",
    main: "Home",
    sub: "Home improvement",
    confidence: 0.9,
  },
  {
    code: "5942",
    description: "Book Stores",
    main: "Shopping",
    sub: "Books",
    confidence: 0.95,
  },

  // Entertainment
  {
    code: "7832",
    description: "Motion Picture Theaters",
    main: "Shopping",
    sub: "Movies",
    confidence: 0.95,
  },
  {
    code: "7922",
    description: "Theatrical Producers and Miscellaneous Entertainment",
    main: "Entertainment",
    sub: "Arts & Amusement",
    confidence: 0.85,
  },
  {
    code: "7994",
    description: "Video Game Arcades/Establishments",
    main: "Entertainment",
    sub: "Amusements",
    confidence: 0.95,
  },
  {
    code: "7997",
    description: "Membership Clubs (Sports, Recreation, Athletic)",
    main: "Entertainment",
    sub: "Sports",
    confidence: 0.85,
  },

  // Health
  {
    code: "8011",
    description: "Doctors",
    main: "Health",
    sub: "Doctor",
    confidence: 0.95,
  },
  {
    code: "8021",
    description: "Dentists, Orthodontists",
    main: "Health",
    sub: "Dentist",
    confidence: 0.95,
  },
  {
    code: "5912",
    description: "Drug Stores and Pharmacies",
    main: "Health",
    sub: "Pharmacy",
    confidence: 0.95,
  },
  {
    code: "7298",
    description: "Health and Beauty Spas",
    main: "Personal care",
    sub: "Spa & Massage",
    confidence: 0.9,
  },

  // Utilities & Home
  {
    code: "4900",
    description: "Utilities - Electric, Gas, Water, Sanitary",
    main: "Home",
    sub: "Misc. utilities",
    confidence: 0.95,
  },
  {
    code: "4814",
    description: "Telecommunication Services",
    main: "Bills & Utilities",
    sub: "Mobile phone",
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
    main: "Withdrawals, checks & transfer",
    sub: "Withdrawals",
    confidence: 0.95,
  },
  {
    code: "6012",
    description: "Financial Institutions",
    main: "Withdrawals, checks & transfer",
    sub: "Transfer",
    confidence: 0.8,
  },
  {
    code: "6051",
    description: "Non-Financial Institutions",
    main: "Bank",
    sub: "Banking fees and charges",
    confidence: 0.7,
  },

  // Insurance
  {
    code: "6300",
    description: "Insurance Sales, Underwriting, and Premiums",
    main: "Misc. expenses",
    sub: "Insurance",
    confidence: 0.95,
  },

  // Government
  {
    code: "9311",
    description: "Tax Payments",
    main: "Taxes",
    sub: "Taxes",
    confidence: 0.95,
  },
  {
    code: "9399",
    description: "Government Services",
    main: "Taxes",
    sub: "Taxes - Others",
    confidence: 0.8,
  },

  // Additional mappings for new categories
  {
    code: "4899",
    description: "Cable and Other Pay Television Services",
    main: "Bills & Utilities",
    sub: "Cable TV",
    confidence: 0.95,
  },
  {
    code: "5661",
    description: "Shoe Stores",
    main: "Shopping",
    sub: "Clothing & Shoes",
    confidence: 0.95,
  },
  {
    code: "7230",
    description: "Beauty and Barber Shops",
    main: "Personal care",
    sub: "Hairdresser",
    confidence: 0.95,
  },
  {
    code: "5977",
    description: "Cosmetic Stores",
    main: "Personal care",
    sub: "Cosmetics",
    confidence: 0.95,
  },
  {
    code: "7991",
    description: "Tourist Attractions and Exhibits",
    main: "Entertainment",
    sub: "Amusements",
    confidence: 0.85,
  },
  {
    code: "7011",
    description: "Hotels and Motels",
    main: "Entertainment",
    sub: "Hotels",
    confidence: 0.95,
  },
  {
    code: "5995",
    description: "Pet Shops, Pet Food, and Supplies",
    main: "Entertainment",
    sub: "Pets",
    confidence: 0.95,
  },
  {
    code: "7310",
    description: "Advertising Services",
    main: "Business Services",
    sub: "Advertising",
    confidence: 0.95,
  },
  {
    code: "8299",
    description: "Schools and Educational Services",
    main: "Education & Children",
    sub: "Tuition",
    confidence: 0.9,
  },
  {
    code: "8398",
    description: "Charitable and Social Service Organizations",
    main: "Misc. expenses",
    sub: "Charity",
    confidence: 0.95,
  },
  {
    code: "4511",
    description: "Airlines",
    main: "Auto & Transport",
    sub: "Plane ticket",
    confidence: 0.95,
  },
  {
    code: "4112",
    description: "Passenger Railways",
    main: "Auto & Transport",
    sub: "Train ticket",
    confidence: 0.95,
  },
  {
    code: "7512",
    description: "Car Rental Agencies",
    main: "Auto & Transport",
    sub: "Car rental",
    confidence: 0.95,
  },
  {
    code: "7211",
    description: "Laundry Services",
    main: "Misc. expenses",
    sub: "Laundry / Dry cleaning",
    confidence: 0.95,
  },
  {
    code: "8351",
    description: "Child Care Services",
    main: "Education & Children",
    sub: "Baby-sitter & Daycare",
    confidence: 0.95,
  },
  {
    code: "5941",
    description: "Sporting Goods Stores",
    main: "Shopping",
    sub: "Sporting goods",
    confidence: 0.95,
  },
  {
    code: "8111",
    description: "Legal Services and Attorneys",
    main: "Business Services",
    sub: "Legal Fees",
    confidence: 0.95,
  },
  {
    code: "8042",
    description: "Optometrists and Ophthalmologists",
    main: "Health",
    sub: "Optician / Eyecare",
    confidence: 0.95,
  },
  {
    code: "5945",
    description: "Hobby, Toy, and Game Shops",
    main: "Education & Children",
    sub: "Toys",
    confidence: 0.95,
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
