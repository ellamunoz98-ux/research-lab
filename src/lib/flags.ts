/**
 * 国旗图片 URL 工具
 * 用 flagcdn.com 的 PNG（免费、无需 token、CDN 直连），格式：
 *   https://flagcdn.com/w{宽}/{国家代码}.png
 * EU/欧盟 通过特殊代码 "eu" 拿到欧盟旗
 */

const ISO2_MAP: Record<string, string> = {
  // 货币代码 → ISO 国家代码
  USD: "us",
  EUR: "eu",
  GBP: "gb",
  JPY: "jp",
  CNY: "cn",
  HKD: "hk",
  AUD: "au",
  CAD: "ca",
  CHF: "ch",
  KRW: "kr",
  INR: "in",
  SGD: "sg",
  BRL: "br",
  RUB: "ru",
  // ISO 国家代码 → 自身（兼容）
  US: "us",
  EU: "eu",
  GB: "gb",
  JP: "jp",
  CN: "cn",
  HK: "hk",
  AU: "au",
  CA: "ca",
  CH: "ch",
  KR: "kr",
  IN: "in",
  SG: "sg",
  BR: "br",
  RU: "ru",
  DE: "de",
  FR: "fr",
};

export function flagUrl(code: string, width: 320 | 640 | 1280 = 640): string {
  const cc = ISO2_MAP[code.toUpperCase()] ?? code.toLowerCase();
  return `https://flagcdn.com/w${width}/${cc}.png`;
}

/**
 * 央行 → 国家 / 区域代码（用于央行卡国旗背景）
 */
export const BANK_FLAG: Record<string, string> = {
  fed: "us",
  ecb: "eu",
  boe: "gb",
  boj: "jp",
  pboc: "cn",
  rba: "au",
  bsnk: "ch",
  bocan: "ca",
};
