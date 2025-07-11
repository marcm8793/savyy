import {
  CreditCard,
  Television,
  Phone,
  WifiHigh,
  DeviceMobile,
  Gift,
  Cpu,
  Book,
  TShirt,
  Key,
  FilmSlate,
  MusicNote,
  ShoppingBag,
  Barbell,
  ShoppingCart,
  ForkKnife,
  Coffee,
  Lightning,
  Car,
  PaintBucket,
  Wrench,
  GasPump,
  Bicycle,
  Airplane,
  Bank,
  Money,
  Receipt,
  Coins,
  Calculator,
  ChartBar,
  Briefcase,
  User,
  UserCircle,
  Envelope,
  Globe,
  CloudArrowUp,
  Database,
  Share,
  Headphones,
  Microphone,
  VideoCamera,
  Image,
  File,
  Folder,
  Archive,
  Trash,
  Clock,
  Calendar,
  MapPin,
  Heart,
  Star,
  Flag,
  Tag,
  Bookmark,
  PaintBrush,
  Scissors,
  FirstAid,
  Pill,
  Thermometer,
  Stethoscope,
  House,
  Bed,
  Chair,
  Lamp,
  Plant,
  Hammer,
  Palette,
  GameController,
  Ticket,
  Confetti,
  Martini,
  Popcorn,
  Guitar,
  Microphone as MicrophoneIcon,
  PaperPlane,
  CurrencyDollar,
  Wallet,
  HandCoins,
  Student,
  GraduationCap,
  Baby,
  Rocket,
  PuzzlePiece,
  Football,
  Basketball,
} from "@phosphor-icons/react";
import { FolderIcon } from "lucide-react";

// Icon mapping for category icons
export const categoryIconMap = {
  // Bills & Utilities
  CreditCard,
  Television,
  Phone,
  WifiHigh,
  DeviceMobile,

  // Shopping
  Gift,
  Cpu,
  Book,
  TShirt,
  Key,
  FilmSlate,
  MusicNote,
  ShoppingBag,
  Barbell,
  ShoppingCart,

  // Food & Dining
  ForkKnife,
  Coffee,
  Lightning,

  // Auto & Transport
  Car,
  PaintBucket,
  Wrench,
  GasPump,
  Bicycle,
  Airplane,

  // Bank
  Bank,
  Money,
  Receipt,
  Coins,
  Calculator,
  ChartBar,

  // Business Services
  Briefcase,
  User,
  UserCircle,
  Envelope,
  Globe,
  CloudArrowUp,
  Database,
  Share,
  Headphones,
  Microphone,
  VideoCamera,
  Image,
  File,
  Folder,
  Archive,
  Trash,
  Clock,
  Calendar,
  MapPin,

  // Misc. expenses
  Heart,
  Star,
  Flag,
  Tag,
  Bookmark,

  // Personal care
  PaintBrush,
  Scissors,

  // Health
  FirstAid,
  Pill,
  Thermometer,
  Stethoscope,

  // Home
  House,
  Bed,
  Chair,
  Lamp,
  Plant,
  Hammer,
  Palette,

  // Entertainment
  GameController,
  Ticket,
  Confetti,
  Martini,
  Popcorn,
  Guitar,
  MicrophoneIcon,

  // Withdrawals, checks & transfer
  PaperPlane,
  CurrencyDollar,
  Wallet,
  HandCoins,

  // Education & Children
  Student,
  GraduationCap,
  Baby,
  Rocket,
  PuzzlePiece,
  Football,
  Basketball,
};

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
};

// Helper function to get icon component from icon name
export function getCategoryIcon(iconName: string | null, size: number = 24) {
  if (!iconName || !(iconName in categoryIconMap)) {
    // Return default folder icon if icon not found
    return <FolderIcon size={size} />;
  }

  const IconComponent =
    categoryIconMap[iconName as keyof typeof categoryIconMap];
  return <IconComponent size={size} />;
}

// Helper function to get category color
export function getCategoryColor(categoryName: string): string {
  return (
    categoryColors[categoryName as keyof typeof categoryColors] ||
    "text-gray-500 dark:text-gray-400"
  );
}

// Helper function to check if icon exists
export function hasIcon(iconName: string | null): boolean {
  return iconName !== null && iconName in categoryIconMap;
}
