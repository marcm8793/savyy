"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { getCategoryIcon, getCategoryColor } from "@/lib/category-icons";

interface CategoryDisplayProps {
  mainCategory?: string | null;
  subCategory?: string | null;
  mainCategoryIcon?: string | null;
  subCategoryIcon?: string | null;
  categoryName?: string | null;
  needsReview?: boolean | null;
}

export function CategoryDisplay({
  mainCategory,
  subCategory,
  mainCategoryIcon,
  subCategoryIcon,
  categoryName,
  needsReview,
}: CategoryDisplayProps) {
  if (mainCategory && subCategory) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <div className={getCategoryColor(mainCategory)}>
            {getCategoryIcon(mainCategoryIcon || null, 14)}
          </div>
          <Badge variant="default" className="text-xs">
            {mainCategory}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <div
            className={`inline-flex items-center justify-center ${getCategoryColor(
              mainCategory
            )}`}
          >
            {getCategoryIcon(subCategoryIcon || null, 12)}
          </div>
          <Badge variant="secondary" className="text-xs">
            {subCategory}
          </Badge>
        </div>
        {needsReview && (
          <Badge variant="outline" className="text-xs text-orange-600">
            Review
          </Badge>
        )}
      </div>
    );
  }

  if (categoryName) {
    return (
      <div className="flex flex-col gap-1">
        <Badge variant="secondary">{categoryName}</Badge>
        <span className="text-xs text-muted-foreground">Tink Category</span>
      </div>
    );
  }

  return <span className="text-muted-foreground text-sm">Uncategorized</span>;
}
