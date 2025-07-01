"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface CategoryData {
  count: number;
  amount: number;
}

interface CategoryBreakdownProps {
  categoryBreakdown: Record<string, CategoryData>;
  totalExpenses: number;
}

export function CategoryBreakdown({ categoryBreakdown, totalExpenses }: CategoryBreakdownProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Spending Categories</CardTitle>
        <CardDescription>Where your money goes</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Object.entries(categoryBreakdown)
            .sort(([, a], [, b]) => Math.abs(b.amount) - Math.abs(a.amount))
            .slice(0, 5)
            .map(([category, data]) => (
              <div key={category} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-medium">{category}</div>
                  <div className="text-sm text-muted-foreground">{data.count} transactions</div>
                </div>
                <div className="text-right">
                  <div className="font-medium">€{Math.abs(data.amount).toLocaleString()}</div>
                  <div className="h-2 w-24 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300"
                      style={{ 
                        width: `${Math.min(100, (Math.abs(data.amount) / totalExpenses) * 100)}%` 
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}