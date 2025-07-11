"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Area, AreaChart, XAxis, YAxis, CartesianGrid } from "recharts";
import { formatSimpleAmount } from "@/lib/utils";
import { useLocaleContext } from "@/providers/locale-provider";

interface MonthlySpendingData {
  month: string;
  spending: number;
}

interface MonthlySpendingChartProps {
  data: MonthlySpendingData[];
}

export function MonthlySpendingChart({ data }: MonthlySpendingChartProps) {
  const { locale } = useLocaleContext();
  const chartConfig = {
    spending: {
      label: "Monthly Spending",
      color: "hsl(var(--chart-1))",
    },
  };

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Monthly Spending</CardTitle>
          <CardDescription>Your spending pattern over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px] xs:h-[220px] sm:h-[250px] md:h-[280px] lg:h-[320px] xl:h-[350px] text-muted-foreground text-sm sm:text-base">
            No spending data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Spending</CardTitle>
        <CardDescription>Your spending pattern over time</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="h-[200px] xs:h-[220px] sm:h-[250px] md:h-[280px] lg:h-[320px] xl:h-[350px]"
        >
          <AreaChart
            data={data}
            margin={{ 
              top: 10, 
              right: 10, 
              left: 0, 
              bottom: 30,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              fontSize={10}
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
              height={40}
              tickMargin={5}
              angle={-45}
              textAnchor="end"
              className="text-xs sm:text-sm"
            />
            <YAxis
              fontSize={10}
              tick={{ fontSize: 10 }}
              tickFormatter={(value) => formatSimpleAmount(Number(value), "EUR", locale).replace(/\.\d{2}$/, "")}
              width={60}
              className="text-xs sm:text-sm"
            />
            <ChartTooltip
              content={<ChartTooltipContent />}
              formatter={(value) => [
                formatSimpleAmount(Number(value), "EUR", locale),
                "Spending",
              ]}
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
