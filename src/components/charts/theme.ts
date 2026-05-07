// ECharts 暗色科技感主题
import type { EChartsOption } from "echarts";

export const PALETTE = [
  "#22d3ee", // cyan
  "#a78bfa", // purple
  "#34d399", // emerald
  "#fb7185", // rose
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#f472b6", // pink
];

export const CHART_TEXT = "#94a3b8";
export const CHART_GRID = "rgba(148, 163, 184, 0.08)";
export const CHART_AXIS = "rgba(148, 163, 184, 0.2)";

export const baseOption: Partial<EChartsOption> = {
  color: PALETTE,
  backgroundColor: "transparent",
  textStyle: {
    fontFamily:
      '"HarmonyOS Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
    color: CHART_TEXT,
  },
  tooltip: {
    trigger: "axis",
    backgroundColor: "rgba(13, 18, 32, 0.95)",
    borderColor: "rgba(34, 211, 238, 0.3)",
    borderWidth: 1,
    textStyle: { color: "#e8eef7", fontSize: 12 },
    padding: [10, 14],
    extraCssText:
      "backdrop-filter: blur(12px); border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.5);",
    axisPointer: {
      type: "cross",
      lineStyle: { color: "rgba(34, 211, 238, 0.4)", width: 1 },
      crossStyle: { color: "rgba(34, 211, 238, 0.3)" },
      label: {
        backgroundColor: "#22d3ee",
        color: "#060912",
        fontSize: 11,
      },
    },
  },
  legend: {
    textStyle: { color: CHART_TEXT, fontSize: 12 },
    top: 0,
    icon: "roundRect",
    itemWidth: 12,
    itemHeight: 8,
  },
  grid: {
    top: 50,
    left: 50,
    right: 30,
    bottom: 40,
    containLabel: true,
  },
  xAxis: {
    axisLine: { lineStyle: { color: CHART_AXIS } },
    axisLabel: { color: CHART_TEXT, fontSize: 11 },
    axisTick: { show: false },
    splitLine: { show: false },
  },
  yAxis: {
    axisLine: { show: false },
    axisLabel: { color: CHART_TEXT, fontSize: 11 },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: CHART_GRID, type: "dashed" } },
  },
};
