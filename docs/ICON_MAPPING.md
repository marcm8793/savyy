# Icon Mapping System

This document explains how icons are mapped from the database to the frontend in the Savyy application.

## Overview

The icon system uses a simple, direct mapping approach where icon names stored in the database correspond directly to Phosphor Icons component names. This eliminates the need for redundant mapping objects and provides automatic support for any valid Phosphor icon.

## Architecture

### Database Layer
Icons are stored in both main categories and subcategories:

**Main Categories** - Have their own icons and colors:
```typescript
// In /apps/api/scripts/seed-categories.ts
{
  name: "Entertainment",
  description: "Entertainment, leisure, and recreational activities",
  icon: "Trophy",           // 👈 Main category icon
  color: "#8B5CF6",         // 👈 Main category color
  sortOrder: 11,
}
```

**Subcategories** - Can have their own icons (inheriting color from main category):
```typescript
{
  mainCategoryName: "Entertainment",
  name: "Sports",
  description: "Sports events and activities",
  icon: "Trophy",           // 👈 Subcategory-specific icon (optional)
  sortOrder: 1,
}
```

### Frontend Layer
The frontend directly resolves icon names to Phosphor Icons components:

```typescript
// In /apps/web/lib/category-icons.tsx
import * as PhosphorIcons from "@phosphor-icons/react";

export function getCategoryIcon(iconName: string | null, size: number = 24) {
  if (!iconName) {
    return <FolderIcon size={size} />;
  }

  // Direct access to Phosphor Icons namespace
  const IconComponent = PhosphorIcons[iconName as PhosphorIconName] as Icon;
  
  if (!IconComponent) {
    console.error(`Icon ${iconName} not found in PhosphorIcons`);
    return <FolderIcon size={size} />;
  }
  
  return <IconComponent size={size} />;
}
```

## Data Flow

```
Database (Normalized) → API (Joined) → Frontend Component → Phosphor Icon
       ↓                     ↓               ↓                   ↓
Main: "Trophy"         mainCategoryIcon   getCategoryIcon()   <Trophy />
Sub:  "Lightning"  →   subCategoryIcon  → getCategoryIcon() → <Lightning />
Color: "#8B5CF6"       color (inherited)   (with color)       (styled)
```

### Step-by-Step Process

1. **Database Storage**: 
   - Main categories store their own icons and colors
   - Subcategories can have optional icons (inherit colors from main category)
2. **API Join**: tRPC endpoint joins main and subcategory tables
3. **Icon Resolution**: API returns `subCategoryIcon || mainCategoryIcon`
4. **Frontend Resolution**: `getCategoryIcon()` function receives the resolved icon name
5. **Component Rendering**: Returns the appropriate Phosphor Icon with inherited color

## Adding New Icons

### 1. Choose an Icon
Browse [Phosphor Icons](https://phosphoricons.com/) and note the exact icon name (e.g., "Shield", "Trophy", "CreditCard").

### 2. Update Database
Add the icon name to the category definition in `/apps/api/scripts/seed-categories.ts`:

```typescript
{
  main: "Your Category",
  sub: "Your Subcategory",
  description: "Category description",
  icon: "YourIconName",    // 👈 Use exact Phosphor icon name
  color: "#HEX_COLOR",
  sortOrder: 999,
}
```

### 3. Re-seed Database
```bash
npm run seed:categories
```

**That's it!** No frontend code changes needed. The system automatically supports any valid Phosphor icon.

## Icon Naming Convention

Phosphor Icons follow these naming patterns:
- **Standard icons**: `House`, `Car`, `Phone`
- **Compound names**: `CreditCard`, `ShoppingCart`, `ForkKnife`
- **Direction indicators**: `ArrowLeft`, `ArrowRight`, `ArrowsLeftRight`
- **State variations**: `Shield`, `ShieldCheck`, `ShieldWarning`

### Important Notes
- Icon names are **case-sensitive**
- Use **PascalCase** (e.g., `CreditCard`, not `creditCard`)
- Some icons have been updated with "Icon" suffix (e.g., `MicrophoneIcon`)

## Error Handling

The system includes robust error handling:

### Missing Icon Names
```typescript
getCategoryIcon(null, 24)
// Returns: <FolderIcon size={24} />
```

### Invalid Icon Names
```typescript
getCategoryIcon("NonExistentIcon", 24)
// Logs: "Icon NonExistentIcon not found in PhosphorIcons"
// Returns: <FolderIcon size={24} />
```

## Type Safety

The system uses TypeScript for type safety:

```typescript
type PhosphorIconName = keyof typeof PhosphorIcons;

// Ensures only valid Phosphor icon names are accepted
const IconComponent = PhosphorIcons[iconName as PhosphorIconName] as Icon;
```

## Usage in Components

### Category Selection Modal
```typescript
// In category-selection-modal.tsx
import { getCategoryIcon } from "@/lib/category-icons";

// Usage
<div className={getCategoryColor(category.mainCategory)}>
  {getCategoryIcon(category.icon, 28)}
</div>
```

### API Integration
```typescript
// Categories API returns:
{
  mainCategory: "Entertainment",
  icon: "Trophy",           // 👈 String from database
  color: "#06B6D4",
  subCategories: [...]
}
```

## Benefits of This Approach

1. **No Redundant Mapping**: Eliminates 100+ lines of unnecessary icon mappings
2. **Automatic Support**: Any valid Phosphor icon works immediately
3. **Type Safety**: TypeScript ensures icon names are valid
4. **Maintainability**: No frontend updates needed when adding new icons
5. **Consistency**: Direct mapping between database and frontend
6. **Error Resilience**: Graceful fallback to default icon

## Migration Notes

If you need to change an icon for an existing category:

1. Update the icon name in `/apps/api/scripts/seed-categories.ts`
2. Run `npm run seed:categories`
3. The frontend will automatically use the new icon

No frontend code changes or deployments required!

## Available Icons

All [Phosphor Icons](https://phosphoricons.com/) are available. Common categories use:

- **Bills & Utilities**: `CreditCard`, `Television`, `Phone`, `WifiHigh`
- **Shopping**: `ShoppingBag`, `ShoppingCart`, `Gift`, `Book`
- **Food & Dining**: `ForkKnife`, `Coffee`, `Lightning`
- **Entertainment**: `Trophy`, `GameController`, `Ticket`, `Guitar`
- **Transport**: `Car`, `Airplane`, `Bus`, `Train`
- **Finance**: `Bank`, `Money`, `CurrencyDollar`, `PiggyBank`
- **Health**: `FirstAid`, `Pill`, `Stethoscope`
- **Home**: `House`, `Bed`, `Chair`, `Lamp`

For a complete list, visit the [Phosphor Icons website](https://phosphoricons.com/).