/**
 * 太阳天文位置计算
 * 用于在地球上叠加昼夜分界（terminator）+ 日照层
 *
 * 算法：
 *   1. 太阳直射点经度 = -((UTC 小时 - 12) × 15°)
 *   2. 太阳赤纬 ≈ 23.45° × sin(360°/365 × (DOY - 81))
 *   3. 直射点的 3D 单位向量传给 shader，用于 dot product 判定昼夜
 */

export interface SubpointGeo {
  /** -23.45° ~ +23.45° 太阳赤纬 */
  lat: number;
  /** -180° ~ +180° */
  lng: number;
}

export function sunSubpoint(date: Date = new Date()): SubpointGeo {
  const utcHours =
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600;
  const rawLng = -((utcHours - 12) * 15);
  const lng = ((rawLng + 540) % 360) - 180;

  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - yearStart) / 86400000);
  const lat =
    23.45 * Math.sin(((360 / 365) * (dayOfYear - 81) * Math.PI) / 180);

  return { lat, lng };
}

/**
 * 把太阳直射点（经纬度）转换为 three-globe 内部坐标系下的 3D 单位向量
 * three-globe 约定：北极朝 +Y，本初子午线在 +Z 方向（lng=0 → z=R），
 *                   东经为正 X 方向（lng=90 → x=R）
 */
export function sunDirectionVector(date: Date = new Date()): [number, number, number] {
  const sub = sunSubpoint(date);
  const phi = ((90 - sub.lat) * Math.PI) / 180;
  const theta = (sub.lng * Math.PI) / 180;
  const x = Math.sin(phi) * Math.sin(theta);
  const y = Math.cos(phi);
  const z = Math.sin(phi) * Math.cos(theta);
  return [x, y, z];
}
