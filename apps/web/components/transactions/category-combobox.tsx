"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CategorySelectionModal } from "./category-selection-modal";

interface CategoryComboboxProps {
  transactionId: string;
  currentMainCategory?: string | null;
  currentSubCategory?: string | null;
  onCategoryChange?: (mainCategory: string, subCategory: string) => void;
}

export function CategoryCombobox({
  transactionId,
  currentMainCategory,
  currentSubCategory,
  onCategoryChange,
}: CategoryComboboxProps) {
  return (
    <CategorySelectionModal
      transactionId={transactionId}
      onCategoryChange={onCategoryChange}
    >
      <Button
        variant="outline"
        className="w-full min-w-[200px] justify-start h-auto p-3"
      >
        {currentMainCategory && currentSubCategory ? (
          <div className="flex items-center gap-2">
            <Badge variant="default" className="text-xs">
              {currentMainCategory}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {currentSubCategory}
            </Badge>
          </div>
        ) : (
          <span className="text-muted-foreground">Select category...</span>
        )}
      </Button>
    </CategorySelectionModal>
  );
}
