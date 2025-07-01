"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, XAxis, YAxis, CartesianGrid } from "recharts";

interface MonthlySpendingData {
  month: string;
  spending: number;
}

interface MonthlySpendingChartProps {
  data: MonthlySpendingData[];
}

export function MonthlySpendingChart({ data }: MonthlySpendingChartProps) {
  const chartConfig = {
    spending: {
      label: "Monthly Spending",
      color: "hsl(var(--chart-1))",
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Spending</CardTitle>
        <CardDescription>Your spending pattern over time</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[280px] sm:h-[330px] lg:h-[380px]">
          <AreaChart 
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="month" 
              fontSize={12}
              tick={{ fontSize: 12 }}
              interval={0}
              height={60}
              tickMargin={10}
            />
            <YAxis 
              fontSize={12}
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `€${Number(value).toLocaleString()}`}
              width={80}
            />
            <ChartTooltip 
              content={<ChartTooltipContent />}
              formatter={(value) => [`€${Number(value).toLocaleString()}`, "Spending"]}
            />
            <Area
              type="monotone"
              dataKey="spending"
              stroke="hsl(var(--chart-1))"
              fill="hsl(var(--chart-1))"
              fillOpacity={0.3}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}