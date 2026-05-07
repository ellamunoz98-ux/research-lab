/**
 * 各金融中心的本地交易时段
 * 用 IANA 时区名 + 本地小时:分钟 表示
 * 不处理节假日（开销不值），但处理周末
 */

export type SessionStatus = "OPEN" | "PRE" | "POST" | "CLOSED" | "ALWAYS";

export interface TradingHours {
  /** IANA 时区名 */
  tz: string;
  /** 主力交易时段开始（本地 HH:mm） */
  open: string;
  /** 主力交易时段结束 */
  close: string;
  /** 盘前开始（可选） */
  preOpen?: string;
  /** 盘后结束（可选） */
  postClose?: string;
  /** 是否周末交易（加密货币 true） */
  weekend?: boolean;
  /** 24x7 交易（如加密） */
  alwaysOn?: boolean;
}

/** 按 financialCenters.id 索引 */
export const TRADING_HOURS: Record<string, TradingHours> = {
  "cn-mainland": { tz: "Asia/Shanghai", open: "09:30", close: "15:00" },
  hk: { tz: "Asia/Hong_Kong", open: "09:30", close: "16:00" },
  "us-east": {
    tz: "America/New_York",
    open: "09:30",
    close: "16:00",
    preOpen: "04:00",
    postClose: "20:00",
  },
  uk: { tz: "Europe/London", open: "08:00", close: "16:30" },
  de: { tz: "Europe/Berlin", open: "09:00", close: "17:30" },
  fr: { tz: "Europe/Paris", open: "09:00", close: "17:30" },
  jp: { tz: "Asia/Tokyo", open: "09:00", close: "15:00" },
  kr: { tz: "Asia/Seoul", open: "09:00", close: "15:30" },
  in: { tz: "Asia/Kolkata", open: "09:15", close: "15:30" },
  sg: { tz: "Asia/Singapore", open: "09:00", close: "17:00" },
  au: { tz: "Australia/Sydney", open: "10:00", close: "16:00" },
  br: { tz: "America/Sao_Paulo", open: "10:00", close: "17:00" },
  ca: {
    tz: "America/Toronto",
    open: "09:30",
    close: "16:00",
    preOpen: "07:00",
    postClose: "20:00",
  },
  ru: { tz: "Europe/Moscow", open: "10:00", close: "18:45" },
  crypto: { tz: "UTC", open: "00:00", close: "23:59", alwaysOn: true, weekend: true },
};

interface LocalParts {
  hour: number;
  minute: number;
  weekday: number; // 0 = 周日 ... 6 = 周六
}

function localPartsAt(tz: string, date: Date): LocalParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
  const parts = fmt.formatToParts(date);
  const hourRaw = parts.find((p) => p.type === "hour")?.value ?? "0";
  const minuteRaw = parts.find((p) => p.type === "minute")?.value ?? "0";
  const wdRaw = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  // Intl 在午夜可能给 "24" 而不是 "00"
  const hour = parseInt(hourRaw, 10) % 24;
  return { hour, minute: parseInt(minuteRaw, 10), weekday: map[wdRaw] ?? 1 };
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  return h * 60 + m;
}

export interface SessionInfo {
  status: SessionStatus;
  /** 本地时间（如 "09:42"），用于显示 */
  localTime: string;
  /** 距下一次状态变化的分钟数（仅参考） */
  nextChangeMin?: number;
}

export function getSessionStatus(
  centerId: string,
  now: Date = new Date()
): SessionInfo {
  const hours = TRADING_HOURS[centerId];
  if (!hours) {
    return { status: "CLOSED", localTime: "—" };
  }
  if (hours.alwaysOn) {
    const local = localPartsAt(hours.tz, now);
    return {
      status: "ALWAYS",
      localTime: `${pad(local.hour)}:${pad(local.minute)}`,
    };
  }

  const local = localPartsAt(hours.tz, now);
  const localTime = `${pad(local.hour)}:${pad(local.minute)}`;
  const nowMin = local.hour * 60 + local.minute;

  // 周末：除非显式 weekend=true，否则关闭
  const isWeekend = local.weekday === 0 || local.weekday === 6;
  if (isWeekend && !hours.weekend) {
    return { status: "CLOSED", localTime };
  }

  const openMin = hhmmToMinutes(hours.open);
  const closeMin = hhmmToMinutes(hours.close);
  const preMin = hours.preOpen ? hhmmToMinutes(hours.preOpen) : null;
  const postMin = hours.postClose ? hhmmToMinutes(hours.postClose) : null;

  if (nowMin >= openMin && nowMin < closeMin) {
    return { status: "OPEN", localTime, nextChangeMin: closeMin - nowMin };
  }
  if (preMin !== null && nowMin >= preMin && nowMin < openMin) {
    return { status: "PRE", localTime, nextChangeMin: openMin - nowMin };
  }
  if (postMin !== null && nowMin >= closeMin && nowMin < postMin) {
    return { status: "POST", localTime, nextChangeMin: postMin - nowMin };
  }
  return { status: "CLOSED", localTime };
}

export function statusLabel(status: SessionStatus): string {
  return {
    OPEN: "交易中",
    PRE: "盘前",
    POST: "盘后",
    CLOSED: "已收盘",
    ALWAYS: "24×7",
  }[status];
}

export function statusColor(status: SessionStatus): string {
  return {
    OPEN: "#10b981", // emerald
    PRE: "#f59e0b", // amber
    POST: "#a78bfa", // purple
    CLOSED: "#64748b", // slate
    ALWAYS: "#22d3ee", // cyan
  }[status];
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
