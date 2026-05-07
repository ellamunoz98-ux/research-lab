import ReactECharts from "echarts-for-react";
import { useMemo } from "react";
import { baseOption, PALETTE } from "./theme";
import ChartCard from "./ChartCard";

interface Series {
  name: string;
  data: number[];
  smooth?: boolean;
  area?: boolean;
}

interface Props {
  title?: string;
  subtitle?: string;
  source?: string;
  xData: (string | number)[];
  series: Series[];
  yUnit?: string;
  height?: number;
  smooth?: boolean;
  area?: boolean;
}

export default function LineChart({
  title,
  subtitle,
  source,
  xData,
  series,
  yUnit,
  height = 360,
  smooth = true,
  area = false,
}: Props) {
  const option = useMemo(
    () => ({
      ...baseOption,
      xAxis: {
        ...(baseOption.xAxis as object),
        type: "category" as const,
        data: xData,
        boundaryGap: false,
      },
      yAxis: {
        ...(baseOption.yAxis as object),
        type: "value" as const,
        name: yUnit ?? "",
        nameTextStyle: { color: "#94a3b8", fontSize: 11 },
      },
      legend: {
        ...(baseOption.legend as object),
        data: series.map((s) => s.name),
      },
      series: series.map((s, i) => ({
        name: s.name,
        type: "line" as const,
        data: s.data,
        smooth: s.smooth ?? smooth,
        symbol: "circle",
        symbolSize: 6,
        showSymbol: false,
        emphasis: { focus: "series" as const, scale: 1.5 },
        lineStyle: { width: 2.5, shadowColor: PALETTE[i % PALETTE.length], shadowBlur: 8 },
        areaStyle: (s.area ?? area)
          ? {
              opacity: 0.18,
              color: {
                type: "linear" as const,
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: PALETTE[i % PALETTE.length] },
                  { offset: 1, color: "transparent" },
                ],
              },
            }
          : undefined,
      })),
    }),
    [xData, series, yUnit, smooth, area]
  );

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
