"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";

interface CategoryDisplayProps {
  mainCategory?: string | null;
  subCategory?: string | null;
  categoryName?: string | null;
  needsReview?: boolean | null;
}

export function CategoryDisplay({
  mainCategory,
  subCategory,
  categoryName,
  needsReview,
}: CategoryDisplayProps) {
  if (mainCategory && subCategory) {
    return (
      <div className="flex flex-col gap-1">
        <Badge variant="default" className="text-xs">
          {mainCategory}
        </Badge>
        <Badge variant="secondary" className="text-xs">
          {subCategory}
        </Badge>
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

  return (
    <span className="text-muted-foreground text-sm">Uncategorized</span>
  );
}