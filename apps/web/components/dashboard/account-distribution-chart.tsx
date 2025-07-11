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
import { formatSimpleAmount } from "@/lib/utils";
import { useLocaleContext } from "@/providers/locale-provider";

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
  const { locale } = useLocaleContext();
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
          <div className="flex items-center justify-center h-[180px] xs:h-[200px] sm:h-[220px] md:h-[250px] lg:h-[280px] xl:h-[320px] text-muted-foreground text-sm sm:text-base">
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
          className="h-[180px] xs:h-[200px] sm:h-[220px] md:h-[250px] lg:h-[280px] xl:h-[320px]"
        >
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="25%"
              outerRadius="60%"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <ChartTooltip
              content={<ChartTooltipContent />}
              formatter={(value) => [
                formatSimpleAmount(Number(value), "EUR", locale),
                "Balance",
              ]}
            />
            <ChartLegend
              content={<ChartLegendContent />}
              className="flex-wrap justify-center gap-1 text-[10px] sm:text-xs md:text-sm"
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
