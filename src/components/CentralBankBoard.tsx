import { useEffect, useState } from "react";
import {
  BANKS,
  ACCENT_GRADIENT,
  ACTION_COLOR,
  type CentralBank,
} from "../lib/centralBanks";
import { flagUrl, BANK_FLAG } from "../lib/flags";
import { fetchBoardNews, timeAgo, type BoardNews } from "../lib/industryData";

export default function CentralBankBoard() {
  const [selected, setSelected] = useState<CentralBank | null>(null);

  return (
    <div>
      <div className="mb-5">
        <div className="text-xs text-cyan-accent tracking-[0.3em] font-mono mb-2">
          CENTRAL BANKS
        </div>
        <h2 className="text-2xl font-bold text-text-primary">主要央行政策利率</h2>
        <p className="text-xs text-text-secondary mt-1">
          数据更新于 2026-05 · 点击卡片查看决议历史 + 政策叙事 + 媒体观点
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {BANKS.map((b) => (
          <BankCard key={b.id} bank={b} onSelect={() => setSelected(b)} />
        ))}
      </div>

      {selected && (
        <BankDetailModal bank={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function BankCard({
  bank: b,
  onSelect,
}: {
  bank: CentralBank;
  onSelect: () => void;
}) {
  const diff = b.rate - b.prevRate;
  const diffBp = Math.round(diff * 100);
  const flagCode = BANK_FLAG[b.id] ?? "us";
  return (
    <button
      onClick={onSelect}
      className={`relative overflow-hidden glass text-left bg-gradient-to-br ${ACCENT_GRADIENT[b.accent]} hover:scale-[1.02] hover:border-cyan-accent/50 transition-all flex flex-col`}
    >
      {/* 顶部国旗横幅（约 1/4 卡片高度，完整显示） */}
      <div
        className="relative shrink-0"
        style={{ height: 80, background: "rgba(8,12,22,0.65)" }}
      >
        <img
          src={flagUrl(flagCode, 640)}
          alt=""
          loading="lazy"
          decoding="async"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            filter: "saturate(1.15)",
          }}
        />
        {/* 顶部小角标：国家代码 + 决议状态 */}
        <div className="absolute top-2 left-2 right-2 flex items-start justify-between pointer-events-none">
          <span
            className="text-[10px] font-mono font-bold tracking-[0.18em] text-text-primary px-1.5 py-0.5 rounded bg-bg-base/65 backdrop-blur-sm"
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}
          >
            {b.shortName.toUpperCase()}
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap ${ACTION_COLOR[b.lastAction]} backdrop-blur-sm`}
          >
            {b.lastAction}
            {diffBp !== 0 && ` ${diffBp > 0 ? "+" : ""}${diffBp}bp`}
          </span>
        </div>
      </div>

      {/* 内容区 */}
      <div className="p-5 flex-1">
        <div className="flex items-end justify-between mb-2">
          <div>
            <div className="text-text-primary font-semibold">{b.name}</div>
            <div className="text-[10px] text-text-muted font-mono">
              {b.shortName}
            </div>
          </div>
        </div>

        <div className="text-xs text-text-muted mb-1">{b.rateName}</div>
        <div className="text-3xl font-bold text-text-primary tabular mb-3">
          {b.rate.toFixed(2)}
          <span className="text-sm text-text-secondary ml-0.5">%</span>
        </div>

        <div className="text-[11px] space-y-1 mt-4 pt-3 border-t border-border-subtle">
          <div className="flex justify-between text-text-secondary">
            <span>上次决议</span>
            <span className="text-text-primary font-mono">{b.lastChange}</span>
          </div>
          <div className="flex justify-between text-text-secondary">
            <span>下次会议</span>
            <span className="text-cyan-accent font-mono">{b.nextMeeting}</span>
          </div>
          <div className="flex justify-between text-text-secondary">
            <span>行长</span>
            <span className="text-text-primary truncate ml-2 text-right">
              {b.governor}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function BankDetailModal({
  bank: b,
  onClose,
}: {
  bank: CentralBank;
  onClose: () => void;
}) {
  const [news, setNews] = useState<BoardNews[] | null>(null);
  const [newsLoading, setNewsLoading] = useState(true);
  const flagCode = BANK_FLAG[b.id] ?? "us";

  useEffect(() => {
    let cancelled = false;
    setNewsLoading(true);
    fetchBoardNews(b.newsKeyword).then((items) => {
      if (cancelled) return;
      setNews(items);
      setNewsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [b.newsKeyword]);

  // ESC 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 py-8 backdrop-blur-md bg-bg-base/80 overflow-y-auto animate-[fadeIn_0.2s_ease-out]"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full glass overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部国旗横幅 */}
        <div
          className="relative"
          style={{ height: 180, background: "rgba(8,12,22,0.85)" }}
        >
          <img
            src={flagUrl(flagCode, 1280)}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              filter: "saturate(1.1)",
            }}
          />
          {/* 底部渐变让标题区平滑过渡 */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: "30%",
              background:
                "linear-gradient(to bottom, transparent 0%, rgba(13,18,32,0.85) 100%)",
              pointerEvents: "none",
            }}
          />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-bg-base/70 hover:bg-bg-base flex items-center justify-center text-text-muted hover:text-text-primary transition-colors backdrop-blur-sm"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        <div className="p-8">
          {/* Header */}
          <div className="flex items-start gap-4 mb-6 pb-5 border-b border-border-subtle">
            <div className="text-5xl">{b.flag}</div>
            <div className="flex-1">
              <div className="text-xs text-cyan-accent tracking-[0.3em] font-mono mb-1">
                {b.shortName}
              </div>
              <h2 className="text-3xl font-bold text-text-primary">
                {b.name}
              </h2>
              <div className="text-sm text-text-secondary mt-1">
                {b.rateName} ·{" "}
                <span className="text-text-primary font-mono font-semibold">
                  {b.rate.toFixed(2)}%
                </span>{" "}
                · 行长 {b.governor}
              </div>
            </div>
          </div>

          {/* 过去 / 现在 / 未来 三段叙事 */}
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <NarrativeBlock
              label="PAST"
              title="过去"
              text={b.narrative.past}
              accent="text-text-muted"
              border="border-border-default"
            />
            <NarrativeBlock
              label="PRESENT"
              title="现在"
              text={b.narrative.present}
              accent="text-cyan-accent"
              border="border-cyan-accent/30"
            />
            <NarrativeBlock
              label="FUTURE"
              title="未来"
              text={b.narrative.future}
              accent="text-purple-accent"
              border="border-purple-accent/30"
            />
          </div>

          {/* 决议历史 */}
          <div className="mb-6">
            <div className="text-[10px] text-cyan-accent font-mono tracking-wider mb-3">
              MEETING HISTORY · 近期决议
            </div>
            <div className="space-y-1.5">
              {b.history.map((m) => {
                const isUp = m.changeBp > 0;
                const isDown = m.changeBp < 0;
                const flat = m.changeBp === 0;
                return (
                  <div
                    key={m.date}
                    className="flex items-center gap-3 px-3 py-2 rounded bg-bg-card/40 border border-border-subtle text-sm"
                  >
                    <div className="text-text-muted font-mono text-xs w-24 shrink-0">
                      {m.date}
                    </div>
                    <div className="text-text-primary font-mono tabular shrink-0 w-16">
                      {m.rateAfter.toFixed(2)}%
                    </div>
                    <div
                      className={`text-xs font-mono font-semibold shrink-0 w-16 ${
                        isUp
                          ? "text-rose-accent"
                          : isDown
                            ? "text-emerald-accent"
                            : "text-text-muted"
                      }`}
                    >
                      {flat ? "维持" : `${isUp ? "+" : ""}${m.changeBp}bp`}
                    </div>
                    <div className="text-xs text-text-secondary truncate flex-1">
                      {m.note ?? ""}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 媒体观点 */}
          <div>
            <div className="text-[10px] text-purple-accent font-mono tracking-wider mb-3">
              MARKET VIEWS · 近期媒体讨论
            </div>
            {newsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-12 bg-text-muted/10 rounded animate-pulse"
                  ></div>
                ))}
              </div>
            ) : news && news.length > 0 ? (
              <div className="space-y-2">
                {news.slice(0, 6).map((n, i) => (
                  <a
                    key={i}
                    href={n.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-3 py-2 rounded bg-bg-card/40 border border-border-subtle hover:border-cyan-accent/40 group"
                  >
                    <div className="text-sm text-text-secondary group-hover:text-cyan-accent leading-relaxed line-clamp-2">
                      {n.title}
                    </div>
                    <div className="text-[10px] text-text-muted font-mono mt-1">
                      {n.source} · {timeAgo(n.time)}
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="text-xs text-text-muted px-3 py-3">
                暂无相关报道
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NarrativeBlock({
  label,
  title,
  text,
  accent,
  border,
}: {
  label: string;
  title: string;
  text: string;
  accent: string;
  border: string;
}) {
  return (
    <div className={`rounded-lg p-4 bg-bg-card/30 border ${border}`}>
      <div className={`text-[10px] font-mono tracking-[0.2em] mb-1 ${accent}`}>
        {label}
      </div>
      <div className="text-sm text-text-primary font-semibold mb-2">{title}</div>
      <p className="text-xs text-text-secondary leading-relaxed">{text}</p>
    </div>
  );
}
