"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { CategoryCombobox } from "./category-combobox";
import { format, parseISO } from "date-fns";
import { formatAmount, calculateScaledAmount } from "@/lib/utils";
import { useLocaleContext } from "@/providers/locale-provider";
import {
  Building,
  Calendar,
  CreditCard,
  FileText,
  Tag,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

interface Transaction {
  id: string;
  tinkTransactionId: string;
  tinkAccountId: string;
  amount: string;
  amountScale: number | null;
  currencyCode: string;
  bookedDate: string | null;
  transactionDate: string | null;
  displayDescription: string | null;
  originalDescription: string | null;
  status: string;
  mainCategory: string | null;
  subCategory: string | null;
  categoryName: string | null;
  merchantName: string | null;
  reference: string | null;
  createdAt: string;
}

interface TransactionDetailSheetProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCategoryChange?: () => void;
  getAccountName: (tinkAccountId: string) => string;
}

export function TransactionDetailSheet({
  transaction,
  open,
  onOpenChange,
  onCategoryChange,
  getAccountName,
}: TransactionDetailSheetProps) {
  const { locale } = useLocaleContext();
  if (!transaction) return null;

  const scaledAmount = calculateScaledAmount(transaction.amount, transaction.amountScale);
  const isIncome = scaledAmount > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Transaction Details</SheetTitle>
          <SheetDescription>
            View and edit transaction information
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Amount and Status */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Amount</span>
              <div className="flex items-center gap-2">
                {isIncome ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                <span
                  className={`text-lg font-semibold ${
                    isIncome ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {formatAmount(
                    transaction.amount,
                    transaction.amountScale,
                    transaction.currencyCode,
                    locale
                  )}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge
                variant={
                  transaction.status === "BOOKED"
                    ? "default"
                    : transaction.status === "PENDING"
                    ? "secondary"
                    : "outline"
                }
              >
                {transaction.status}
              </Badge>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>Description</span>
            </div>
            <p className="text-sm font-medium">
              {transaction.displayDescription ||
                transaction.originalDescription ||
                "No description"}
            </p>
            {transaction.reference && (
              <p className="text-xs text-muted-foreground">
                Reference: {transaction.reference}
              </p>
            )}
          </div>

          {/* Account */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building className="h-4 w-4" />
              <span>Account</span>
            </div>
            <p className="text-sm font-medium">
              {getAccountName(transaction.tinkAccountId)}
            </p>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Date</span>
            </div>
            <p className="text-sm font-medium">
              {transaction.bookedDate
                ? format(parseISO(transaction.bookedDate), "MMMM d, yyyy")
                : "No date"}
            </p>
          </div>

          {/* Merchant */}
          {transaction.merchantName && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CreditCard className="h-4 w-4" />
                <span>Merchant</span>
              </div>
              <p className="text-sm font-medium">{transaction.merchantName}</p>
            </div>
          )}

          {/* Category */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Tag className="h-4 w-4" />
              <span>Category</span>
            </div>
            <CategoryCombobox
              transactionId={transaction.id}
              currentMainCategory={transaction.mainCategory}
              currentSubCategory={transaction.subCategory}
              onCategoryChange={() => {
                if (onCategoryChange) {
                  onCategoryChange();
                }
              }}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}