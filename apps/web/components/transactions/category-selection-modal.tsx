"use client";

import * as React from "react";
import { ArrowLeft } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { getCategoryIcon, getCategoryColor } from "@/lib/category-icons";

interface CategorySelectionModalProps {
  transactionId: string;
  onCategoryChange?: (mainCategory: string, subCategory: string) => void;
  children: React.ReactNode;
}

type ViewMode = "main" | "subcategories";

export function CategorySelectionModal({
  transactionId,
  onCategoryChange,
  children,
}: CategorySelectionModalProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<ViewMode>("main");
  const [selectedMainCategory, setSelectedMainCategory] = React.useState<string | null>(null);

  // Fetch categories
  const { data: categoriesData, isLoading } = trpc.transaction.getCategories.useQuery();

  // Update category mutation
  const updateCategoryMutation = trpc.transaction.updateCategory.useMutation({
    onSuccess: (_, variables) => {
      toast.success(`Category updated to ${variables.mainCategory} → ${variables.subCategory}`);
      setIsOpen(false);
      setViewMode("main");
      setSelectedMainCategory(null);
      if (onCategoryChange) {
        onCategoryChange(variables.mainCategory, variables.subCategory);
      }
    },
    onError: (error) => {
      toast.error("Failed to update category");
      console.error("Error updating category:", error);
    },
  });

  const handleMainCategorySelect = (mainCategory: string) => {
    setSelectedMainCategory(mainCategory);
    setViewMode("subcategories");
  };

  const handleSubcategorySelect = (mainCategory: string, subCategory: string) => {
    updateCategoryMutation.mutate({
      transactionId,
      mainCategory,
      subCategory,
    });
  };

  const handleBackToMain = () => {
    setViewMode("main");
    setSelectedMainCategory(null);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Reset state when closing
      setViewMode("main");
      setSelectedMainCategory(null);
    }
  };

  const selectedGroup = categoriesData?.grouped.find(
    (group) => group.mainCategory === selectedMainCategory
  );

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between">
            {viewMode === "subcategories" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToMain}
                className="p-2 h-8 w-8"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <SheetTitle className="flex-1 text-center">
              {viewMode === "main" ? "Select Category" : selectedMainCategory}
            </SheetTitle>
            <div className="w-8" /> {/* Spacer for centering */}
          </div>
          <SheetDescription>
            {viewMode === "main" 
              ? "Choose a main category for your transaction" 
              : "Select a subcategory to complete the categorization"
            }
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto pb-4 px-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2 text-sm text-muted-foreground">Loading categories...</span>
            </div>
          ) : viewMode === "main" ? (
            <CategoryGrid
              categories={categoriesData?.grouped || []}
              onCategorySelect={handleMainCategorySelect}
            />
          ) : (
            <SubcategoryList
              mainCategory={selectedMainCategory!}
              subcategories={selectedGroup?.subCategories || []}
              onSubcategorySelect={handleSubcategorySelect}
              isLoading={updateCategoryMutation.isPending}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface CategoryGridProps {
  categories: Array<{
    mainCategory: string;
    icon: string | null;
    color: string | null;
    subCategories: Array<{ id: string; subCategory: string }>;
  }>;
  onCategorySelect: (mainCategory: string) => void;
}

function CategoryGrid({ categories, onCategorySelect }: CategoryGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 auto-rows-fr">
      {categories.map((category) => (
        <Button
          key={category.mainCategory}
          variant="outline"
          className="h-auto flex-col p-3 space-y-2 hover:bg-muted/50 transition-colors min-h-[160px] justify-between w-full whitespace-normal"
          onClick={() => onCategorySelect(category.mainCategory)}
        >
          <div className={getCategoryColor(category.mainCategory)} style={{ flexShrink: 0 }}>
            {getCategoryIcon(category.icon, 28)}
          </div>
          <div className="text-sm font-medium text-center leading-snug flex-1 flex items-center justify-center px-2">
            <span className="break-words hyphens-auto">
              {category.mainCategory}
            </span>
          </div>
          <div className="text-xs text-muted-foreground" style={{ flexShrink: 0 }}>
            {category.subCategories.length} options
          </div>
        </Button>
      ))}
    </div>
  );
}

interface SubcategoryListProps {
  mainCategory: string;
  subcategories: Array<{ id: string; subCategory: string }>;
  onSubcategorySelect: (mainCategory: string, subCategory: string) => void;
  isLoading: boolean;
}

function SubcategoryList({
  mainCategory,
  subcategories,
  onSubcategorySelect,
  isLoading,
}: SubcategoryListProps) {
  return (
    <div className="space-y-2">
      {subcategories.map((subcategory) => (
        <Button
          key={subcategory.id}
          variant="ghost"
          className="w-full justify-start h-auto p-4 text-left"
          onClick={() => onSubcategorySelect(mainCategory, subcategory.subCategory)}
          disabled={isLoading}
        >
          <div className="flex items-center space-x-3">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <div className="w-2 h-2 rounded-full bg-muted-foreground" />
            )}
            <span className="text-sm font-medium">{subcategory.subCategory}</span>
          </div>
        </Button>
      ))}
    </div>
  );
}