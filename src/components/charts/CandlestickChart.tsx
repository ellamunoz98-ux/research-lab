import ReactECharts from "echarts-for-react";
import { useMemo } from "react";
import { baseOption } from "./theme";
import ChartCard from "./ChartCard";

interface Props {
  title?: string;
  subtitle?: string;
  source?: string;
  /** [date, open, close, low, high] */
  data: [string, number, number, number, number][];
  height?: number;
}

export default function CandlestickChart({
  title,
  subtitle,
  source,
  data,
  height = 420,
}: Props) {
  const option = useMemo(() => {
    const dates = data.map((d) => d[0]);
    const ohlc = data.map((d) => [d[1], d[2], d[3], d[4]]);

    return {
      ...baseOption,
      tooltip: {
        ...(baseOption.tooltip as object),
        formatter: (params: any) => {
          const p = params[0];
          if (!p) return "";
          const [open, close, low, high] = p.data;
          const change = close - open;
          const pct = ((change / open) * 100).toFixed(2);
          const isUp = close >= open;
          const color = isUp ? "#34d399" : "#fb7185";
          return `
            <div style="font-family:monospace;line-height:1.7">
              <div style="color:#94a3b8;margin-bottom:4px">${p.name}</div>
              <div>开盘 <span style="color:#e8eef7">${open}</span></div>
              <div>收盘 <span style="color:${color}">${close}</span></div>
              <div>最低 <span style="color:#e8eef7">${low}</span></div>
              <div>最高 <span style="color:#e8eef7">${high}</span></div>
              <div style="margin-top:4px;color:${color}">${isUp ? "+" : ""}${change.toFixed(2)} (${pct}%)</div>
            </div>
          `;
        },
      },
      xAxis: {
        ...(baseOption.xAxis as object),
        type: "category" as const,
        data: dates,
        boundaryGap: true,
      },
      yAxis: {
        ...(baseOption.yAxis as object),
        type: "value" as const,
        scale: true,
      },
      dataZoom: [
        {
          type: "inside" as const,
          start: 50,
          end: 100,
        },
        {
          type: "slider" as const,
          start: 50,
          end: 100,
          height: 18,
          bottom: 0,
          backgroundColor: "rgba(255,255,255,0.02)",
          borderColor: "rgba(148,163,184,0.1)",
          fillerColor: "rgba(34,211,238,0.1)",
          handleStyle: { color: "#22d3ee" },
          textStyle: { color: "#94a3b8", fontSize: 10 },
        },
      ],
      series: [
        {
          name: title ?? "K线",
          type: "candlestick" as const,
          data: ohlc,
          itemStyle: {
            color: "#34d399",
            color0: "#fb7185",
            borderColor: "#34d399",
            borderColor0: "#fb7185",
          },
        },
      ],
    };
  }, [data, title]);

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
