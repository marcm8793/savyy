"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";

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
  // Fetch categories
  const { data: categoriesData, isLoading } =
    trpc.transaction.getCategories.useQuery();

  // Update category mutation
  const updateCategoryMutation = trpc.transaction.updateCategory.useMutation({
    onSuccess: (_, variables) => {
      if (onCategoryChange) {
        onCategoryChange(variables.mainCategory, variables.subCategory);
      }
    },
  });

  const handleSelect = (value: string) => {
    // Value format: "mainCategory:subCategory"
    const [mainCategory, subCategory] = value.split(":");

    if (mainCategory && subCategory && value.split(":").length === 2) {
      updateCategoryMutation.mutate({
        transactionId,
        mainCategory,
        subCategory,
      });
    } else {
      console.error("Invalid category value format:", value);
    }
  };

  const currentValue =
    currentMainCategory && currentSubCategory
      ? `${currentMainCategory}:${currentSubCategory}`
      : undefined;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </div>
    );
  }

  return (
    <Select
      value={currentValue}
      onValueChange={handleSelect}
      disabled={updateCategoryMutation.isPending}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select category...">
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
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[300px]">
        {categoriesData?.grouped.map((group) => (
          <SelectGroup key={group.mainCategory}>
            <SelectLabel className="flex items-center gap-2">
              {group.icon && <span>{group.icon}</span>}
              <span>{group.mainCategory}</span>
            </SelectLabel>
            {group.subCategories.map((sub) => (
              <SelectItem
                key={sub.id}
                value={`${group.mainCategory}:${sub.subCategory}`}
              >
                <div className="flex items-center gap-2">
                  <span>{sub.subCategory}</span>
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
