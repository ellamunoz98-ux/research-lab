import type { ReactNode } from "react";

interface Props {
  title?: string;
  subtitle?: string;
  source?: string;
  height?: number | string;
  children: ReactNode;
}

export default function ChartCard({
  title,
  subtitle,
  source,
  height = 360,
  children,
}: Props) {
  return (
    <div className="glass my-6 p-5">
      {(title || subtitle) && (
        <div className="mb-4">
          {title && (
            <h4 className="text-base font-semibold text-text-primary mb-1">{title}</h4>
          )}
          {subtitle && (
            <p className="text-xs text-text-secondary">{subtitle}</p>
          )}
        </div>
      )}
      <div style={{ height: typeof height === "number" ? `${height}px` : height }}>
        {children}
      </div>
      {source && (
        <div className="mt-3 pt-3 border-t border-border-subtle text-xs text-text-muted font-mono">
          数据来源：{source}
        </div>
      )}
    </div>
  );
}
