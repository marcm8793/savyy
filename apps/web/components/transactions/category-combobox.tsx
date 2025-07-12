"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CategorySelectionModal } from "./category-selection-modal";
import { getCategoryIcon, getCategoryColor } from "@/lib/category-icons";

interface CategoryComboboxProps {
  transactionId: string;
  currentMainCategory?: string | null;
  currentSubCategory?: string | null;
  currentMainCategoryIcon?: string | null;
  currentSubCategoryIcon?: string | null;
  transactionAmount?: string;
  transactionAmountScale?: number | null;
  onCategoryChange?: (mainCategory: string, subCategory: string) => void;
}

export function CategoryCombobox({
  transactionId,
  currentMainCategory,
  currentSubCategory,
  currentSubCategoryIcon,
  transactionAmount,
  transactionAmountScale,
  onCategoryChange,
}: CategoryComboboxProps) {
  return (
    <CategorySelectionModal
      transactionId={transactionId}
      transactionAmount={transactionAmount}
      transactionAmountScale={transactionAmountScale}
      onCategoryChange={onCategoryChange}
    >
      <Button
        variant="outline"
        className="w-full min-w-[200px] justify-start h-auto p-3 text-left"
      >
        {currentMainCategory && currentSubCategory ? (
          <div className="flex items-center gap-2 w-full">
            <div className="flex items-center gap-1">
              <Badge variant="default" className="text-xs">
                {currentMainCategory}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">→</span>
            <div className="flex items-center gap-1">
              <div className={getCategoryColor(currentMainCategory)}>
                {getCategoryIcon(currentSubCategoryIcon || null, 14)}
              </div>
              <Badge variant="secondary" className="text-xs">
                {currentSubCategory}
              </Badge>
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground">Select category...</span>
        )}
      </Button>
    </CategorySelectionModal>
  );
}
