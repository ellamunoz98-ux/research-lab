import ReactECharts from "echarts-for-react";
import { useMemo } from "react";
import { baseOption, PALETTE } from "./theme";
import ChartCard from "./ChartCard";

interface Series {
  name: string;
  data: number[];
}

interface Props {
  title?: string;
  subtitle?: string;
  source?: string;
  xData: (string | number)[];
  series: Series[];
  yUnit?: string;
  height?: number;
  stacked?: boolean;
  horizontal?: boolean;
}

export default function BarChart({
  title,
  subtitle,
  source,
  xData,
  series,
  yUnit,
  height = 360,
  stacked = false,
  horizontal = false,
}: Props) {
  const option = useMemo(() => {
    const valueAxis = {
      type: "value" as const,
      name: yUnit ?? "",
      nameTextStyle: { color: "#94a3b8", fontSize: 11 },
      axisLine: { show: false },
      axisLabel: { color: "#94a3b8", fontSize: 11 },
      splitLine: { lineStyle: { color: "rgba(148,163,184,0.08)", type: "dashed" as const } },
    };
    const categoryAxis = {
      type: "category" as const,
      data: xData,
      axisLine: { lineStyle: { color: "rgba(148,163,184,0.2)" } },
      axisLabel: { color: "#94a3b8", fontSize: 11 },
      axisTick: { show: false },
    };

    return {
      ...baseOption,
      xAxis: horizontal ? valueAxis : categoryAxis,
      yAxis: horizontal ? categoryAxis : valueAxis,
      legend: {
        ...(baseOption.legend as object),
        data: series.map((s) => s.name),
      },
      series: series.map((s, i) => ({
        name: s.name,
        type: "bar" as const,
        stack: stacked ? "total" : undefined,
        data: s.data,
        barMaxWidth: 32,
        itemStyle: {
          borderRadius: stacked ? 0 : [4, 4, 0, 0],
          color: {
            type: "linear" as const,
            x: 0,
            y: 0,
            x2: horizontal ? 1 : 0,
            y2: horizontal ? 0 : 1,
            colorStops: [
              { offset: 0, color: PALETTE[i % PALETTE.length] },
              { offset: 1, color: PALETTE[i % PALETTE.length] + "60" },
            ],
          },
        },
        emphasis: { focus: "series" as const },
      })),
    };
  }, [xData, series, yUnit, stacked, horizontal]);

  return (
    <ChartCard title={title} subtitle={subtitle} source={source} height={height}>
      <ReactECharts
        option={option}
        style={{ height: "100%", width: "100%" }}
        opts={{ renderer: "canvas" }}
        notMerge
      />
    </ChartCard>
  );
}
