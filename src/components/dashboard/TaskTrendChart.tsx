import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const chartConfig = {
  count: {
    label: "Tasks approved",
    color: "var(--brand)",
  },
} satisfies ChartConfig;

export function TaskTrendChart({ data }: { data: { date: string; count: number }[] }) {
  return (
    <div className="as-card p-4 sm:p-5">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Tasks approved — last 30 days
      </div>
      <ChartContainer config={chartConfig} className="mt-3 aspect-auto h-40 w-full">
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <defs>
            <filter id="taskTrendGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow
                dx="0"
                dy="0"
                stdDeviation="4"
                floodColor="var(--brand)"
                floodOpacity="0.55"
              />
            </filter>
            <linearGradient id="taskTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
          <Area
            dataKey="count"
            type="monotone"
            stroke="var(--brand)"
            strokeWidth={2}
            fill="url(#taskTrendFill)"
            style={{ filter: "url(#taskTrendGlow)" }}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
