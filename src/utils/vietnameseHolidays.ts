/**
 * Ngày nghỉ lễ Việt Nam theo Bộ luật Lao động 2019 (sửa đổi 2024):
 *
 * 1. Tết Dương lịch:          1/1 (1 ngày)
 * 2. Tết Âm lịch:             29 hoặc 30 tháng Chạp + 1-4 tháng Giêng ÂL (5 ngày)
 * 3. Giỗ Tổ Hùng Vương:       10/3 Âm lịch (1 ngày)
 * 4. Ngày Chiến thắng:        30/4 (1 ngày)
 * 5. Ngày Quốc tế Lao động:   1/5 (1 ngày)
 * 6. Quốc khánh:              2/9 + 1 ngày liền kề (2 ngày)
 * 7. Ngày Văn hóa Việt Nam:   24/11 (1 ngày)
 */

// ── Thuật toán chuyển đổi Âm lịch → Dương lịch ──────────────────────────
// Based on the Chinese/Vietnamese Lunisolar calendar algorithm by Hồ Ngọc Đức

function INT(x: number): number {
  return Math.floor(x);
}

function jdFromDate(dd: number, mm: number, yy: number): number {
  let a = INT((14 - mm) / 12);
  let y = yy + 4800 - a;
  let m = mm + 12 * a - 3;
  let jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045;
  if (jd < 2299161) {
    jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  }
  return jd;
}

function jdToDate(jd: number): [number, number, number] {
  let a: number, b: number, c: number;
  if (jd > 2299160) {
    a = jd + 32044;
    b = INT((4 * a + 3) / 146097);
    c = a - INT((b * 146097) / 4);
  } else {
    b = 0;
    c = jd + 32082;
  }
  const d = INT((4 * c + 3) / 1461);
  const e = c - INT((1461 * d) / 4);
  const m = INT((5 * e + 2) / 153);
  const day = e - INT((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * INT(m / 10);
  const year = b * 100 + d - 4800 + INT(m / 10);
  return [day, month, year];
}

function getNewMoonDay(k: number, timeZone: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = Math.PI / 180;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 -= 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 -= 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 += 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 -= 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  C1 -= 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 += 0.0010 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (M + 2 * Mpr));
  let deltaT: number;
  if (T < -11) {
    deltaT = 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3;
  } else {
    deltaT = -0.000278 + 0.000265 * T + 0.000262 * T2;
  }
  const JdNew = Jd1 + C1 - deltaT;
  return INT(JdNew + 0.5 + timeZone / 24);
}

function getSunLongitude(jdn: number, timeZone: number): number {
  const T = (jdn - 2451545.5 - timeZone / 24) / 36525;
  const T2 = T * T;
  const dr = Math.PI / 180;
  const M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M);
  let L = L0 + DL;
  L -= 360 * INT(L / 360);
  return INT(L / 30);
}

function getLunarMonth11(yy: number, timeZone: number): number {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = INT(off / 29.530588853);
  let nm = getNewMoonDay(k, timeZone);
  const sunLong = getSunLongitude(nm, timeZone);
  if (sunLong >= 9) nm = getNewMoonDay(k - 1, timeZone);
  return nm;
}

function getLeapMonthOffset(a11: number, timeZone: number): number {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0;
  let i = 1;
  let arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  do {
    last = arc;
    i++;
    arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  } while (arc !== last && i < 14);
  return i - 1;
}

/**
 * Chuyển ngày Âm lịch → Dương lịch
 * @param lunarDay - ngày âm lịch
 * @param lunarMonth - tháng âm lịch
 * @param lunarYear - năm âm lịch
 * @returns Date object
 */
export function lunarToSolar(lunarDay: number, lunarMonth: number, lunarYear: number): Date {
  const timeZone = 7; // UTC+7 Việt Nam
  const k = INT((jdFromDate(1, 1, lunarYear) - 2415021.076998695) / 29.530588853);
  let monthStart = getNewMoonDay(k + lunarMonth - 1, timeZone);
  let a11 = getLunarMonth11(lunarYear - 1, timeZone);
  let b11 = getLunarMonth11(lunarYear, timeZone);
  const leapMonthDiff = getLeapMonthOffset(a11, timeZone);

  if (b11 - a11 > 365) {
    // Năm nhuận
    const leapOffset = lunarMonth > leapMonthDiff ? 1 : 0;
    monthStart = getNewMoonDay(k + lunarMonth - 1 + leapOffset, timeZone);
  }

  const jd = monthStart + lunarDay - 1;
  const [d, m, y] = jdToDate(jd);
  return new Date(y, m - 1, d);
}

// ── Tính ngày Giỗ Tổ Hùng Vương (10/3 ÂL) ──────────────────────────────
function getHungKings(year: number): Date {
  return lunarToSolar(10, 3, year);
}

// ── Tính 5 ngày Tết Âm lịch ─────────────────────────────────────────────
// Giao thừa + 4 ngày Tết: ngày cuối tháng Chạp năm trước + 1/1, 2/1, 3/1, 4/1 ÂL
function getTetHolidays(solarYear: number): Date[] {
  // Tính 1/1 âm lịch của năm âm lịch nào có Tết rơi vào solarYear
  // Thông thường Tết rơi vào tháng 1 hoặc 2 dương lịch
  // Tết của năm âm lịch = solarYear là 1/1/solarYear (ÂL)
  // Nhưng thực ra phải thử cả năm solarYear và solarYear-1 vì Tết 2025 rơi vào Jan 2025

  const tet1 = lunarToSolar(1, 1, solarYear); // 1/1 ÂL của năm đó
  // Nếu Tết 1/1 ÂL của solarYear rơi vào solarYear+1 (rất hiếm), thử solarYear-1
  // Tính ngày cuối tháng Chạp (ngày 29 hoặc 30 tháng 12 ÂL của năm trước)
  const lunarYear = solarYear; // Năm âm lịch có Tết trong solarYear dương lịch

  // Ngày 30/12 ÂL (Giao Thừa)
  const giaoThua30 = lunarToSolar(30, 12, lunarYear - 1);
  const giaoThua29 = lunarToSolar(29, 12, lunarYear - 1);

  // Nếu 30/12 ÂL hợp lệ (tháng Chạp đủ 30 ngày)
  const tet1Solar = lunarToSolar(1, 1, lunarYear);
  const giaoThua = new Date(tet1Solar.getTime() - 24 * 60 * 60 * 1000); // ngày trước 1/1 ÂL

  const holidays: Date[] = [giaoThua]; // Giao thừa (29 hoặc 30/12 ÂL)
  for (let d = 1; d <= 4; d++) {
    holidays.push(lunarToSolar(d, 1, lunarYear)); // 1-4/1 ÂL
  }
  return holidays.filter((d) => d.getFullYear() === solarYear);
}

// ── Tính 2 ngày Quốc khánh 2/9 (thêm 1 ngày bù) ───────────────────────
// Ngày bù được chính phủ công bố hàng năm. Quy tắc chung:
// - Nếu 2/9 là thứ Hai → nghỉ bù Thứ 7 trước (1/9)
// - Nếu 2/9 là thứ Tư → nghỉ bù Thứ 3 (1/9) hoặc Thứ 5 (3/9) — thường là ngày tiếp theo
// - Nếu 2/9 là thứ 7 → nghỉ bù thứ 2 (3/9) hoặc thứ 6 (1/9)... theo quyết định của CP
// Mặc định: lấy thứ 3, thứ 6, thứ 7 → bù sang Thứ 2 hoặc Thứ 4 gần nhất
function getQuocKhanhDays(year: number): Date[] {
  const sep2 = new Date(year, 8, 2); // 2/9
  const dow = sep2.getDay(); // 0=Sun, 1=Mon...
  const days: Date[] = [sep2];
  // Thêm ngày bù: trước hoặc sau tuỳ ngày trong tuần
  if (dow === 0) {
    // Chủ Nhật → bù Thứ 2 (3/9)
    days.push(new Date(year, 8, 3));
  } else if (dow === 6) {
    // Thứ 7 → bù Thứ 2 (4/9)
    days.push(new Date(year, 8, 4));
  } else if (dow === 1) {
    // Thứ 2 → bù Thứ 7 trước (1/9)
    days.push(new Date(year, 8, 1));
  } else {
    // Thứ 3-6 → bù ngày tiếp theo (3/9)
    days.push(new Date(year, 8, 3));
  }
  return days;
}

// ── Interface ─────────────────────────────────────────────────────────────
export interface VietnamHoliday {
  date: Date;
  dateStr: string; // "YYYY-MM-DD"
  name: string;
  shortName: string;
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Trả về tất cả ngày nghỉ lễ Việt Nam trong năm dương lịch chỉ định.
 * Bao gồm: Tết DL, Tết ÂL (5 ngày), Giỗ Tổ HV, 30/4, 1/5, Quốc khánh (2 ngày), 24/11.
 */
export function getVietnamHolidays(year: number): VietnamHoliday[] {
  const holidays: VietnamHoliday[] = [];

  const add = (date: Date, name: string, shortName: string) => {
    if (date.getFullYear() !== year) return; // chỉ lấy ngày thuộc năm này
    holidays.push({ date, dateStr: toDateStr(date), name, shortName });
  };

  // 1. Tết Dương lịch 1/1
  add(new Date(year, 0, 1), 'Tết Dương lịch', 'TDL');

  // 2. Tết Âm lịch (5 ngày: Giao Thừa + 1-4/1 ÂL)
  const tetDays = getTetHolidays(year);
  const tetLabels = ['Giao Thừa', 'Mồng 1 Tết', 'Mồng 2 Tết', 'Mồng 3 Tết', 'Mồng 4 Tết'];
  tetDays.forEach((d, i) => add(d, tetLabels[i] || 'Tết Âm lịch', 'TẾT'));

  // 3. Giỗ Tổ Hùng Vương 10/3 ÂL
  const hungKings = getHungKings(year);
  add(hungKings, 'Giỗ Tổ Hùng Vương (10/3 ÂL)', 'GTHV');

  // 4. Ngày Chiến thắng 30/4
  add(new Date(year, 3, 30), 'Ngày Chiến thắng 30/4', '30/4');

  // 5. Ngày Quốc tế Lao động 1/5
  add(new Date(year, 4, 1), 'Ngày Quốc tế Lao động', '1/5');

  // 6. Quốc khánh 2/9 + ngày bù
  const quocKhanh = getQuocKhanhDays(year);
  add(quocKhanh[0], 'Quốc khánh 2/9', 'QK');
  if (quocKhanh[1]) add(quocKhanh[1], 'Nghỉ bù Quốc khánh', 'QK+');

  // 7. Ngày Văn hóa Việt Nam 24/11
  add(new Date(year, 10, 24), 'Ngày Văn hóa Việt Nam', '24/11');

  return holidays;
}

/**
 * Tạo Map từ dateStr → VietnamHoliday để tra cứu O(1)
 */
export function getHolidayMap(year: number): Map<string, VietnamHoliday> {
  const map = new Map<string, VietnamHoliday>();
  getVietnamHolidays(year).forEach((h) => map.set(h.dateStr, h));
  return map;
}

