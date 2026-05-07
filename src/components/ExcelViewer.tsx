import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

interface Props {
  /** 文件名（相对于 public/excel/） */
  file: string;
  /** 默认显示的工作表（可选；不填默认第一张） */
  sheet?: string;
  title?: string;
  source?: string;
  /** 表格区域最大高度，默认 480px */
  height?: number | string;
  /** 是否显示搜索框，默认 true */
  searchable?: boolean;
  /** 是否显示下载按钮，默认 true */
  download?: boolean;
}

type CellValue = string | number | boolean | Date | null;
type Row = CellValue[];

export default function ExcelViewer({
  file,
  sheet,
  title,
  source,
  height = 480,
  searchable = true,
  download = true,
}: Props) {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<{ idx: number; dir: 1 | -1 } | null>(null);

  // 加载文件
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetch(`/excel/${file}`)
      .then((r) => {
        if (!r.ok) throw new Error(`无法加载 ${file}（${r.status}）`);
        return r.arrayBuffer();
      })
      .then((buf) => {
        if (!alive) return;
        try {
          const wb = XLSX.read(buf, { type: "array", cellDates: true });
          setWorkbook(wb);
          const names = wb.SheetNames;
          setActiveSheet(sheet && names.includes(sheet) ? sheet : names[0] ?? "");
        } catch (e) {
          throw new Error(`解析失败：${(e as Error).message}`);
        }
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [file, sheet]);

  // 抽取当前 sheet 的数据
  const rows: Row[] = useMemo(() => {
    if (!workbook || !activeSheet) return [];
    const ws = workbook.Sheets[activeSheet];
    if (!ws) return [];
    return XLSX.utils.sheet_to_json<Row>(ws, {
      header: 1,
      defval: "",
      blankrows: false,
      raw: true,
    });
  }, [workbook, activeSheet]);

  // 自动找到表头行：取前 8 行里非空单元格最多的那一行
  const { headers, dataRows } = useMemo(() => {
    if (rows.length === 0) return { headers: [] as CellValue[], dataRows: [] as Row[] };
    const candidatesEnd = Math.min(rows.length, 8);
    let bestIdx = 0;
    let bestNonEmpty = -1;
    for (let i = 0; i < candidatesEnd; i++) {
      const nonEmpty = rows[i].filter((c) => c !== null && c !== undefined && c !== "").length;
      if (nonEmpty > bestNonEmpty) {
        bestNonEmpty = nonEmpty;
        bestIdx = i;
      }
    }
    return {
      headers: rows[bestIdx],
      dataRows: rows.slice(bestIdx + 1).filter((r) =>
        r.some((c) => c !== null && c !== undefined && c !== "")
      ),
    };
  }, [rows]);

  const filtered = useMemo(() => {
    let res = dataRows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      res = res.filter((row) =>
        row.some((cell) => String(cell ?? "").toLowerCase().includes(q))
      );
    }
    if (sortCol) {
      res = [...res].sort((a, b) => {
        const av = a[sortCol.idx];
        const bv = b[sortCol.idx];
        if (av == null || av === "") return 1;
        if (bv == null || bv === "") return -1;
        if (typeof av === "number" && typeof bv === "number") {
          return (av - bv) * sortCol.dir;
        }
        return String(av).localeCompare(String(bv), "zh-CN") * sortCol.dir;
      });
    }
    return res;
  }, [dataRows, search, sortCol]);

  const formatCell = (v: CellValue) => {
    if (v == null || v === "") return "";
    if (v instanceof Date) {
      return v.toISOString().slice(0, 10);
    }
    if (typeof v === "boolean") return v ? "是" : "否";
    if (typeof v === "number") {
      if (!Number.isFinite(v)) return "";
      if (Number.isInteger(v) && Math.abs(v) < 1e15) {
        return v.toLocaleString();
      }
      return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
    }
    return String(v);
  };

  const handleSort = (i: number) => {
    setSortCol((prev) =>
      prev?.idx === i
        ? prev.dir === 1
          ? { idx: i, dir: -1 }
          : null
        : { idx: i, dir: 1 }
    );
  };

  const sheets = workbook?.SheetNames ?? [];

  return (
    <div className="glass my-6 p-5">
      {/* 头部 */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="min-w-0 flex-1">
          {title && (
            <h4 className="text-base font-semibold text-text-primary mb-0.5 flex items-center gap-2">
              <span className="text-emerald-accent text-sm">▦</span>
              {title}
            </h4>
          )}
          {source && (
            <p className="text-xs text-text-muted font-mono">数据来源：{source}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {searchable && (
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索..."
              className="px-3 py-1.5 text-xs rounded-md bg-bg-card border border-border-default focus:border-cyan-accent outline-none text-text-primary placeholder:text-text-muted w-32 transition-colors"
            />
          )}
          {download && (
            <a
              href={`/excel/${file}`}
              download
              className="px-3 py-1.5 text-xs rounded-md border border-border-default text-text-secondary hover:border-cyan-accent hover:text-cyan-accent transition-all flex items-center gap-1.5"
              title="下载原 Excel 文件"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Excel
            </a>
          )}
        </div>
      </div>

      {/* 工作表切换 */}
      {sheets.length > 1 && (
        <div className="flex gap-1 mb-3 border-b border-border-subtle overflow-x-auto">
          {sheets.map((s) => (
            <button
              key={s}
              onClick={() => setActiveSheet(s)}
              className={`px-3 py-1.5 text-xs whitespace-nowrap transition-colors ${
                s === activeSheet
                  ? "text-cyan-accent border-b-2 border-cyan-accent -mb-px font-semibold"
                  : "text-text-secondary hover:text-text-primary border-b-2 border-transparent"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* 内容区 */}
      {error ? (
        <div className="p-4 text-rose-accent text-sm bg-rose-accent/5 rounded-lg border border-rose-accent/20">
          ⚠ {error}
        </div>
      ) : loading ? (
        <div className="p-8 text-text-secondary text-sm text-center">
          <div className="inline-block w-4 h-4 rounded-full border-2 border-cyan-accent border-t-transparent animate-spin mr-2 align-middle"></div>
          加载中...
        </div>
      ) : headers.length === 0 ? (
        <div className="p-8 text-text-muted text-sm text-center">
          当前 sheet 为空
        </div>
      ) : (
        <div
          className="overflow-auto rounded-lg border border-border-subtle"
          style={{ maxHeight: typeof height === "number" ? `${height}px` : height }}
        >
          <table className="min-w-full text-sm">
            <thead className="bg-bg-elevated sticky top-0 z-10 backdrop-blur">
              <tr>
                {headers.map((h, i) => (
                  <th
                    key={i}
                    onClick={() => handleSort(i)}
                    className="px-3 py-2.5 text-left font-semibold text-cyan-accent border-b border-border-default cursor-pointer hover:bg-cyan-accent/5 select-none whitespace-nowrap"
                  >
                    {formatCell(h) || `列 ${i + 1}`}
                    {sortCol?.idx === i && (
                      <span className="ml-1 text-xs opacity-70">
                        {sortCol.dir === 1 ? "▲" : "▼"}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, r) => (
                <tr key={r} className="hover:bg-cyan-accent/5 transition-colors">
                  {headers.map((_h, c) => {
                    const v = row[c];
                    const isNum = typeof v === "number";
                    return (
                      <td
                        key={c}
                        className={`px-3 py-1.5 border-b border-border-subtle text-text-primary ${
                          isNum ? "text-right tabular" : ""
                        }`}
                      >
                        {formatCell(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={Math.max(headers.length, 1)}
                    className="px-3 py-8 text-center text-text-muted text-xs"
                  >
                    无匹配数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 底部统计 */}
      {dataRows.length > 0 && !error && (
        <div className="mt-3 text-xs text-text-muted font-mono flex justify-between">
          <span>共 {dataRows.length.toLocaleString()} 行 · {headers.length} 列</span>
          {search.trim() && <span>匹配 {filtered.length.toLocaleString()} 行</span>}
        </div>
      )}
    </div>
  );
}
