import ReactECharts from "echarts-for-react";
import { useMemo } from "react";
import { baseOption, PALETTE } from "./theme";
import ChartCard from "./ChartCard";

interface DataItem {
  name: string;
  value: number;
}

interface Props {
  title?: string;
  subtitle?: string;
  source?: string;
  data: DataItem[];
  height?: number;
  donut?: boolean;
  centerLabel?: string;
}

export default function PieChart({
  title,
  subtitle,
  source,
  data,
  height = 360,
  donut = true,
  centerLabel,
}: Props) {
  const option = useMemo(
    () => ({
      ...baseOption,
      tooltip: {
        ...(baseOption.tooltip as object),
        trigger: "item" as const,
        formatter: "{b}<br/><span style='color:#22d3ee'>{c}</span> ({d}%)",
      },
      legend: {
        ...(baseOption.legend as object),
        orient: "vertical" as const,
        right: 20,
        top: "middle" as const,
      },
      series: [
        {
          name: title ?? "",
          type: "pie" as const,
          radius: donut ? ["48%", "72%"] : "65%",
          center: ["38%", "50%"],
          avoidLabelOverlap: true,
          itemStyle: {
            borderColor: "#060912",
            borderWidth: 2,
            borderRadius: 4,
          },
          label: {
            color: "#94a3b8",
            fontSize: 11,
          },
          labelLine: {
            lineStyle: { color: "rgba(148,163,184,0.3)" },
          },
          emphasis: {
            scale: true,
            scaleSize: 8,
            label: { fontSize: 13, fontWeight: 600, color: "#e8eef7" },
          },
          data: data.map((item, i) => ({
            ...item,
            itemStyle: { color: PALETTE[i % PALETTE.length] },
          })),
        },
      ],
      ...(donut && centerLabel
        ? {
            graphic: {
              type: "text" as const,
              left: "38%",
              top: "middle" as const,
              style: {
                text: centerLabel,
                fill: "#e8eef7",
                fontSize: 14,
                fontWeight: 600,
                textAlign: "center" as const,
              },
            },
          }
        : {}),
    }),
    [data, title, donut, centerLabel]
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
