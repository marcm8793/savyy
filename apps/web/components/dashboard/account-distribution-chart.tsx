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
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { PieChart, Pie, Cell } from "recharts";

interface AccountDistributionData {
  name: string;
  value: number;
  color: string;
}

interface AccountDistributionChartProps {
  data: AccountDistributionData[];
  chartConfig: Record<string, { label: string; color: string }>;
}

export function AccountDistributionChart({
  data,
  chartConfig,
}: AccountDistributionChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account Distribution</CardTitle>
          <CardDescription>
            Balance distribution across accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[250px] text-muted-foreground">
            No account data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Distribution</CardTitle>
        <CardDescription>Balance distribution across accounts</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="h-[250px] sm:h-[300px] lg:h-[350px]"
        >
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="30%"
              outerRadius="70%"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <ChartTooltip
              content={<ChartTooltipContent />}
              formatter={(value) => [
                `€${Number(value).toLocaleString()}`,
                "Balance",
              ]}
            />
            <ChartLegend
              content={<ChartLegendContent />}
              className="flex-wrap justify-center gap-1 text-xs"
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
