import * as PhosphorIcons from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { FolderIcon } from "lucide-react";

// Valid Phosphor icon names that can be used for categories
type PhosphorIconName = keyof typeof PhosphorIcons;

// Category color mapping for subtle colors
export const categoryColors = {
  "Bills & Utilities": "text-red-500 dark:text-red-400",
  Shopping: "text-purple-500 dark:text-purple-400",
  "Food & Dining": "text-orange-500 dark:text-orange-400",
  "Auto & Transport": "text-blue-500 dark:text-blue-400",
  Bank: "text-green-500 dark:text-green-400",
  "Business Services": "text-gray-500 dark:text-gray-400",
  "Misc. expenses": "text-pink-500 dark:text-pink-400",
  "Personal care": "text-rose-500 dark:text-rose-400",
  Taxes: "text-yellow-500 dark:text-yellow-400",
  Home: "text-emerald-500 dark:text-emerald-400",
  Entertainment: "text-violet-500 dark:text-violet-400",
  "Withdrawals, checks & transfer": "text-cyan-500 dark:text-cyan-400",
  Health: "text-teal-500 dark:text-teal-400",
  "Education & Children": "text-indigo-500 dark:text-indigo-400",
  Income: "text-green-600 dark:text-green-400",
};

// Helper function to get icon component from icon name
export function getCategoryIcon(iconName: string | null, size: number = 24) {
  if (!iconName) {
    return <FolderIcon size={size} />;
  }

  // Type-safe icon lookup
  const IconComponent =
    iconName in PhosphorIcons
      ? (PhosphorIcons[iconName as PhosphorIconName] as Icon)
      : null;

  if (!IconComponent) {
    // Only log in development to avoid production noise
    if (process.env.NODE_ENV === "development") {
      console.error(`Icon ${iconName} not found in PhosphorIcons`);
    }
    return <FolderIcon size={size} />;
  }

  return <IconComponent size={size} />;
}

// Helper function to get category color
export function getCategoryColor(categoryName: string): string {
  return (
    categoryColors[categoryName as keyof typeof categoryColors] ||
    "text-gray-500 dark:text-gray-400"
  );
}

// Helper function to convert text color to background color
export function getCategoryBackgroundColor(categoryName: string): string {
  const textColor = getCategoryColor(categoryName);
  // Convert text-{color}-{shade} to bg-{color}-{shade}
  return textColor.replace(/text-/g, 'bg-');
}

// Helper function to check if icon exists
export function hasIcon(iconName: string | null): boolean {
  return iconName !== null && iconName in PhosphorIcons;
}
