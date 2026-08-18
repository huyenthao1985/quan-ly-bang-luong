import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Calendar, Save, Search,
  ChevronDown, X, LayoutList, PencilLine, Edit3, Trash2,
} from 'lucide-react';
import { usePayroll } from '../../context/PayrollContext';
import { DailyAttendance } from '../../types/payroll';

// ── Types ─────────────────────────────────────────────────────────────────
type ViewMode = 'manual' | 'table';
type AttendanceStatus = 'present' | 'absent_paid' | 'absent_annual' | 'absent_unpaid' | 'ot' | 'sunday' | 'holiday' | 'night';
type ShiftType = 'day' | 'night' | 'split';
type OtType = 'none' | 'ot150' | 'sunday200' | 'holiday300';
type SpecialDay = 'normal' | 'leavePaid' | 'leaveAnnual' | 'leaveUnpaid';

const STATUS_OPTIONS = [
  { value: 'present' as AttendanceStatus,   label: 'Có mặt (HC)',        color: '#22c55e' },
  { value: 'ot' as AttendanceStatus,         label: 'OT 150%',            color: '#f59e0b' },
  { value: 'sunday' as AttendanceStatus,     label: 'Chủ nhật 200%',      color: '#ef4444' },
  { value: 'holiday' as AttendanceStatus,    label: 'Ngày lễ 300%',       color: '#a855f7' },
  { value: 'night' as AttendanceStatus,      label: 'Ca đêm 30%',         color: '#6366f1' },
  { value: 'absent_paid' as AttendanceStatus,    label: 'Nghỉ hưởng lương', color: '#64748b' },
  { value: 'absent_annual' as AttendanceStatus,  label: 'Nghỉ phép năm',   color: '#0ea5e9' },
  { value: 'absent_unpaid' as AttendanceStatus,  label: 'Nghỉ không lương', color: '#f43f5e' },
];
const SHIFT_OPTIONS = [
  { value: 'day' as ShiftType,   label: 'Ca ngày (8h)' },
  { value: 'night' as ShiftType, label: 'Ca đêm (8h)' },
  { value: 'split' as ShiftType, label: 'Ca chia đôi (4h)' },
];
const OT_OPTIONS = [
  { value: 'none' as OtType,       label: 'Không' },
  { value: 'ot150' as OtType,      label: 'OT 150%' },
  { value: 'sunday200' as OtType,  label: 'Chủ nhật 200%' },
  { value: 'holiday300' as OtType, label: 'Ngày lễ 300%' },
];
const SPECIAL_OPTIONS = [
  { value: 'normal' as SpecialDay,      label: 'Ngày thường' },
  { value: 'leavePaid' as SpecialDay,   label: 'Nghỉ hưởng lương' },
  { value: 'leaveAnnual' as SpecialDay, label: 'Nghỉ phép năm' },
  { value: 'leaveUnpaid' as SpecialDay, label: 'Nghỉ không lương' },
];

const pad2 = (n: number) => n < 10 ? '0' + n : '' + n;

/** Convert H/M/AM-PM to decimal hours (24h format) */
function toDecHours(h: number, m: number, ampm: 'AM' | 'PM'): number {
  let hour = h % 12;
  if (ampm === 'PM') hour += 12;
  return hour + m / 60;
}

/** Format H/M/AM-PM thành chuỗi 24h "HH:mm" để lưu lại giờ vào/ra thực tế đã nhập */
function fmtTime24(h: number, m: number, ampm: 'AM' | 'PM'): string {
  let hour = h % 12;
  if (ampm === 'PM') hour += 12;
  return `${pad2(hour)}:${pad2(m)}`;
}

/** Parse ngược chuỗi 24h "HH:mm" về H/M/AM-PM để đổ lại vào TimePicker khi mở sửa */
function parseTime24(t: string): { h: number; m: number; ampm: 'AM' | 'PM' } {
  const [hh, mm] = t.split(':').map(Number);
  const ampm: 'AM' | 'PM' = hh >= 12 ? 'PM' : 'AM';
  let h12 = hh % 12;
  if (h12 === 0) h12 = 12;
  return { h: h12, m: mm || 0, ampm };
}

/** Tổng giờ làm thực tế của ca đêm (qua nửa đêm), đã trừ 1.0h ăn ca nếu > 4h */
function calcOvernightTotal(startDec: number, endDec: number): number {
  const total = (24 - startDec) + endDec;
  return total > 4 ? total - 1.0 : total;
}

/**
 * Tính số giờ chồng lấn giữa khung làm việc thực tế [startDec, endDec] (nếu endDec <=
 * startDec nghĩa là ca qua đêm, tự động cộng thêm 24h vào endDec để biểu diễn "hôm sau")
 * với 1 khung giờ mốc cố định [wStart, wEnd] trên cùng trục 24h mở rộng đó.
 */
function calcWindowOverlapHours(startDec: number, endDec: number, wStart: number, wEnd: number): number {
  const s = startDec;
  const e = endDec <= startDec ? endDec + 24 : endDec;
  return Math.max(0, Math.min(e, wEnd) - Math.max(s, wStart));
}

/**
 * EPCC (night-allowance-30-50-clock-window) - FIX theo yêu cầu người dùng: PC ca đêm 30%
 * và 50% KHÔNG còn tính theo "toàn bộ 8h HC của ca đêm" như trước, mà tính đúng theo 2
 * khung giờ CỐ ĐỊNH trên đồng hồ:
 *   PC 30% = 22:00 → 05:00 (hôm sau)  — tối đa 7h thô, trừ 1h ăn ca giữa đêm → tối đa 6h.
 *   PC 50% = 05:00 → 06:00 (hôm sau)  — tối đa 1h, không trừ ăn ca (khung quá ngắn).
 * Giờ làm việc thực tế trước 22:00 (vd 20:00–22:00) hoặc sau 06:00 sẽ KHÔNG được tính vào
 * 2 khoản phụ cấp này nữa.
 */
function calcNightAllowance30(startDec: number, endDec: number): number {
  const raw = calcWindowOverlapHours(startDec, endDec, 22, 29); // 29 = 24 + 05:00 hôm sau
  const adjusted = raw > 4 ? raw - 1.0 : raw;
  return Math.round(Math.max(0, adjusted) * 2) / 2;
}

function calcNightAllowance50(startDec: number, endDec: number): number {
  const raw = calcWindowOverlapHours(startDec, endDec, 29, 30); // 29–30 = 05:00–06:00 hôm sau
  return Math.round(raw * 2) / 2;
}

/**
 * Tính giờ HC hành chính theo 2 ca chính thức:
 *   Ca sáng : 08:00 – 12:00 (tối đa 4h)
 *   Ca chiều: 13:00 – 17:00 (tối đa 4h)
 * Quy tắc:
 *  - Số giờ làm việc trong từng ca phải tính từ 30 phút (0.5h) trở đi.
 *  - Phần lẻ dưới 30 phút (ví dụ 15 phút từ 11:45–12:00) không đủ 30 phút nên không được tính vào ca đó.
 * Cụ thể:
 *  - Vào 11:45 AM -> Ca sáng 15p (< 30p) = 0h + Ca chiều 4h = 4.0h HC
 *  - Vào 11:30 AM -> Ca sáng 30p (>= 30p) = 0.5h + Ca chiều 4h = 4.5h HC
 *  - Vào 08:30 AM -> Ca sáng 3.5h + Ca chiều 4h = 7.5h HC
 *  - Vào 13:00 PM -> Ca chiều 4h = 4.0h HC
 */
function calcHcHours(startDec: number, endDec: number): number {
  if (endDec <= startDec) {
    // Ca đêm: 8h đầu là HC hành chính, tối đa 8h
    const total = calcOvernightTotal(startDec, endDec);
    return Math.min(total, 8);
  }

  // Morning session 08:00 – 12:00
  const mornStart = 8, mornEnd = 12;
  // Afternoon session 13:00 – 17:00
  const aftStart = 13, aftEnd = 17;

  const getSessionHours = (wStart: number, wEnd: number) => {
    const raw = Math.max(0, Math.min(endDec, wEnd) - Math.max(startDec, wStart));
    if (raw < 0.5) return 0;
    return Math.floor(raw * 2) / 2;
  };

  return getSessionHours(mornStart, mornEnd) + getSessionHours(aftStart, aftEnd);
}

/**
 * Tính giờ OT ngoài giờ:
 * Quy tắc:
 * - Ca ngày: Giờ tăng ca luôn được tính trực tiếp từ mốc 17:00 (5:00 PM) trở đi tới Giờ ra (endDec).
 *   Dù nhân viên vào muộn từ mấy giờ đi nữa (vd: vào lúc 11:45 AM, 13:00 PM...), khi làm tới 20:00 (8:00 PM)
 *   thì số giờ OT thuộc khung 17:00–20:00 luôn được tính đủ là 3.0h (không bị xén trừ do vào muộn).
 * - Ca đêm (qua đêm): Tăng ca ngoài ca đêm được tính từ mốc 05:00 AM trở đi đến Giờ ra.
 *   Làm đến 08:00 AM thì số giờ OT luôn tính là 3.0h (từ 05:00 đến 08:00 AM).
 */
function calcOtHours(startDec: number, endDec: number): number {
  const isOvernight = endDec <= startDec;

  if (isOvernight) {
    // Ca đêm: làm ngoài mốc 05:00 AM (5.0) -> tính OT từ 05:00 AM đến giờ ra
    if (endDec > 5.0) {
      const ot = endDec - 5.0;
      return Math.round(ot * 2) / 2;
    }
    return 0;
  }

  // Ca ngày: làm ngoài mốc 17:00 (17.0) -> tính OT từ mốc 17:00 (hoặc startDec nếu bắt đầu làm sau 17:00) đến giờ ra
  if (endDec > 17.0) {
    const otStart = Math.max(17.0, startDec);
    const ot = endDec - otStart;
    return Math.round(ot * 2) / 2;
  }

  return 0;
}

/**
 * Kiểm tra điều kiện nhận PHỤ CẤP CHUYÊN CẦN trong kỳ (dùng chung cho Bảng lương).
 *
 * Quy tắc:
 *  - Chỉ cần có ≥ 1 ngày "Nghỉ không lương" trong kỳ mà KHÔNG được "phép bù" phủ hết
 *    → tính là ngày nghỉ không phép hiệu lực, làm CẮT chuyên cần.
 *  - Nếu phép bù còn lại đủ để bù đắp đúng/vượt số ngày nghỉ không lương đó, thì xem như
 *    các ngày đó đã được phép bù "phủ" — KHÔNG bị trừ chuyên cần, tính bình thường.
 *
 * Khớp với công thức CHÍNH THỨC trong payroll.ts (EmployeeAttendanceRecord.manualUnauthorizedAbsenceDays,
 * ô E69) mà calculatePayslip() dùng để cắt `diligenceBonus` (mục 20): D32 = IF(E69>0, 0, E66).
 * `suggestedUnauthorizedAbsenceDays` trả về dưới đây chính là giá trị GỢI Ý cho E69 —
 * = max(0, leaveUnpaidDays − remainingCompLeaveDays) — để điền/ghi đè vào
 * `manualUnauthorizedAbsenceDays` bên Bảng lương (HR vẫn có thể sửa tay nếu cần).
 *
 * Lưu ý nguồn dữ liệu:
 *  - `leaveUnpaidDays`: tổng số ngày nghỉ không lương trong tháng, lấy từ cột
 *    "Nghỉ Không Lương" ở Card 1 (Bảng nhập điểm danh & giờ làm việc chi tiết) — trong
 *    component này chính là biến `tLu` được gộp theo từng nhân viên.
 *  - `remainingCompLeaveDays`: số ngày phép bù CÒN LẠI của nhân viên, lấy từ
 *    Employee.compLeaveBalance (Hồ sơ nhân viên).
 */
function checkChuyenCanEligible(
  leaveUnpaidDays: number,
  remainingCompLeaveDays: number = 0
): { eligible: boolean; reason: string; suggestedUnauthorizedAbsenceDays: number } {
  const suggestedUnauthorizedAbsenceDays = Math.max(0, leaveUnpaidDays - remainingCompLeaveDays);

  if (leaveUnpaidDays <= 0) {
    return {
      eligible: true,
      reason: 'Không có ngày nghỉ không lương trong kỳ.',
      suggestedUnauthorizedAbsenceDays,
    };
  }
  if (remainingCompLeaveDays >= leaveUnpaidDays) {
    return {
      eligible: true,
      reason: `Có ${leaveUnpaidDays} ngày nghỉ không lương nhưng đã dùng phép bù còn lại (${remainingCompLeaveDays} ngày) để bù đủ → vẫn tính chuyên cần.`,
      suggestedUnauthorizedAbsenceDays,
    };
  }
  return {
    eligible: false,
    reason: `Có ${leaveUnpaidDays} ngày nghỉ không lương, phép bù còn lại không đủ bù (còn ${remainingCompLeaveDays} ngày) → còn ${suggestedUnauthorizedAbsenceDays} ngày tính là nghỉ không phép, cắt phụ cấp chuyên cần (gợi ý điền vào "Số ngày nghỉ không phép" ở Bảng lương).`,
    suggestedUnauthorizedAbsenceDays,
  };
}


// EPCC (statbadge-single-line-unified-size) - FIX theo yêu cầu người dùng:
// trước đây label ("HC"/"OT"/"Tổng cộng") và value ("24.0 h") nằm 2 dòng
// riêng, cỡ chữ lệch nhau rất nhiều (text-[10px] vs text-2xl). Gộp thành 1
// dòng (flex items-baseline) và đồng nhất cỡ chữ label = cỡ chữ value hiện
// có (text-2xl) để 2 phần cân đối nhau, chỉ giữ khác biệt về màu/độ đậm.
// EPCC (statbadge-darker-label) - FIX theo yêu cầu người dùng: label
// "HC"/"OT" trước đây màu text-slate-400 (xám nhạt) khó đọc ở cỡ chữ lớn.
// Đổi sang text-slate-800/dark:text-slate-100 + font-extrabold để chữ đen
// đậm hơn, dễ đọc hơn hẳn so với xám nhạt cũ.
// EPCC (statbadge-full-border) - FIX theo yêu cầu người dùng: trước đây chỉ
// có viền trái (border-l-4), 3 cạnh còn lại không có viền. Đổi sang viền đủ
// 4 cạnh (border-2) cùng màu với borderLeftColor để ô nổi bật, rõ ràng hơn.
const StatBadge: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div className="flex-1 rounded-xl px-4 py-3 border-2 bg-white dark:bg-slate-800 shadow-sm flex items-baseline gap-2" style={{ borderColor: color }}>
    <p className="text-2xl font-extrabold uppercase tracking-widest text-slate-800 dark:text-slate-100">{label}</p>
    <p className="text-2xl font-extrabold" style={{ color }}>{value}</p>
  </div>


);

// ── SelectField sub-component ─────────────────────────────────────────────
const SelectRow: React.FC<{
  label: string; required?: boolean; value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; color?: string }[];
  rowCls?: string; style?: React.CSSProperties;
}> = ({ label, required, value, onChange, options, rowCls = '', style }) => (
  <div>
    <label className={`block text-[10px] font-bold mb-0.5 ${required ? 'text-red-500' : 'text-slate-500'}`}>
      {required ? '● ' : ''}{label}
    </label>
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={style}
        className={`w-full appearance-none pl-2.5 pr-6 text-xs h-[32px] rounded-md font-semibold cursor-pointer focus:outline-none focus:ring-2 border ${rowCls}`}
      >
        {options.map(o => (
          <option key={o.value} value={o.value} style={o.color ? { color: o.color } : undefined}>
            {o.color ? '● ' : ''}{o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
    </div>
  </div>
);

// ── TimePicker sub-component ──────────────────────────────────────────────
const TimePick: React.FC<{
  label: string;
  h: number; m: number; ampm: 'AM' | 'PM';
  onH: (v: number) => void; onM: (v: number) => void; onAP: (v: 'AM' | 'PM') => void;
}> = ({ label, h, m, ampm, onH, onM, onAP }) => (
  <div>
    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">● {label}</label>
    <div className="flex gap-1">
      <select value={h} onChange={e => onH(Number(e.target.value))}
        className="flex-1 px-1 py-1 text-xs h-[32px] bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-slate-800 dark:text-slate-200 font-semibold cursor-pointer">
        {Array.from({ length: 12 }, (_, i) => i + 1).map(hv => <option key={hv} value={hv}>{pad2(hv)}</option>)}
      </select>
      <select value={m} onChange={e => onM(Number(e.target.value))}
        className="flex-1 px-1 py-1 text-xs h-[32px] bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-slate-800 dark:text-slate-200 font-semibold cursor-pointer">
        {[0, 15, 30, 45].map(mv => <option key={mv} value={mv}>{pad2(mv)}</option>)}
      </select>
      <select value={ampm} onChange={e => onAP(e.target.value as 'AM' | 'PM')}
        className="px-1 py-1 text-xs h-[32px] bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-slate-800 dark:text-slate-200 font-semibold cursor-pointer">
        <option>AM</option><option>PM</option>
      </select>
    </div>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────
export const AttendanceTab: React.FC = () => {
  const {
    employees, attendanceRecords,
    selectedMonth, selectedYear,
    setSelectedMonth, setSelectedYear,
    updateAttendanceDay, deleteAttendanceDay, showToast,
    setLastCheckedInEmployeeId,
  } = usePayroll();

  const [viewMode, setViewMode] = useState<ViewMode>('manual');
  const [searchTerm, setSearchTerm] = useState('');
  const [selEmpId, setSelEmpId] = useState('');
  const [status, setStatus] = useState<AttendanceStatus>('present');
  const [shift, setShift] = useState<ShiftType>('day');
  // EPCC (require-fields-red-highlight-on-save) — theo yêu cầu người dùng: khi bấm "Lưu" mà
  // còn ô bắt buộc (có dấu ●) chưa nhập, tô viền đỏ ô đó thay vì chỉ hiện toast lỗi. Trạng
  // thái/Ca làm/Ngày luôn có giá trị mặc định (select/date không thể rỗng) nên trên thực tế
  // chỉ "Nhân viên" mới có thể thực sự chưa chọn — cờ này bật lên sau lần bấm Lưu đầu tiên bị
  // chặn, các ô bắt buộc sẽ tự hết đỏ ngay khi người dùng điền đúng (tính reactive theo state).
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [otType, setOtType] = useState<OtType>('none');
  const [specialDay, setSpecialDay] = useState<SpecialDay>('normal');

  const td = new Date();
  const [eDay, setEDay] = useState(td.getDate());
  const [eMon, setEMon] = useState(td.getMonth() + 1);
  const [eYr, setEYr] = useState(td.getFullYear());

  // EPCC (default-end-time-wrong) - FIX ROOT CAUSE "OT tự sinh ra 3h dù không ai yêu cầu tăng ca":
  // Giờ kết thúc mặc định trước đây là 8:00 PM (ca ngày) / 7:30 AM (ca đêm), lệch với khung giờ
  // chuẩn dùng để tính HC/OT (calcHcHours/calcOtHours giả định ca ngày kết thúc 17:00, ca đêm 05:00).
  // Ca ngày mặc định: 7:30 AM → 5:00 PM | Ca đêm mặc định: 8:00 PM → 5:00 AM
  const [sH, setSH] = useState(7);  const [sMin, setSMin] = useState(30); const [sAP, setSAP] = useState<'AM' | 'PM'>('AM');
  const [eH, setEH] = useState(5);  const [eMin, setEMin] = useState(0);  const [eAP, setEAP] = useState<'AM' | 'PM'>('PM');

  const hcAuto = useMemo(() => {
    const s = toDecHours(sH, sMin, sAP);
    const e = toDecHours(eH, eMin, eAP);
    return calcHcHours(s, e);
  }, [sH, sMin, sAP, eH, eMin, eAP]);

  const otAuto = useMemo(() => {
    if (otType === 'none') return 0;
    const s = toDecHours(sH, sMin, sAP);
    const e = toDecHours(eH, eMin, eAP);
    return calcOtHours(s, e);
  }, [sH, sMin, sAP, eH, eMin, eAP, otType]);

  // ── Inline-edit state cho bảng "Danh sách điểm danh gần đây" ─────────────
  // editingDate = ngày (key gốc) của bản ghi đang mở sửa; null = không có dòng nào đang sửa.
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editIsNight, setEditIsNight] = useState(false);
  const [editSH, setEditSH] = useState(7); const [editSMin, setEditSMin] = useState(30); const [editSAP, setEditSAP] = useState<'AM' | 'PM'>('AM');
  const [editEH, setEditEH] = useState(5); const [editEMin, setEditEMin] = useState(0);  const [editEAP, setEditEAP] = useState<'AM' | 'PM'>('PM');

  const editHcAuto = useMemo(() => {
    const s = toDecHours(editSH, editSMin, editSAP);
    const e = toDecHours(editEH, editEMin, editEAP);
    return calcHcHours(s, e);
  }, [editSH, editSMin, editSAP, editEH, editEMin, editEAP]);

  const editOtAuto = useMemo(() => {
    const s = toDecHours(editSH, editSMin, editSAP);
    const e = toDecHours(editEH, editEMin, editEAP);
    return calcOtHours(s, e);
  }, [editSH, editSMin, editSAP, editEH, editEMin, editEAP]);

  // EPCC (night-allowance-30-50-clock-window) - preview PC ca đêm 30%/50% khi đang sửa
  // trực tiếp 1 dòng, tính theo khung giờ cố định 22:00–05:00 / 05:00–06:00.
  const editNight30Auto = useMemo(() => {
    const s = toDecHours(editSH, editSMin, editSAP);
    const e = toDecHours(editEH, editEMin, editEAP);
    return calcNightAllowance30(s, e);
  }, [editSH, editSMin, editSAP, editEH, editEMin, editEAP]);

  const editNight50Auto = useMemo(() => {
    const s = toDecHours(editSH, editSMin, editSAP);
    const e = toDecHours(editEH, editEMin, editEAP);
    return calcNightAllowance50(s, e);
  }, [editSH, editSMin, editSAP, editEH, editEMin, editEAP]);

  // ── Click-to-edit: sửa từng ô riêng lẻ (không cần bấm nút Edit) ──────────
  // ── Click-to-edit: sửa từng ô riêng lẻ (không cần bấm nút Edit) ──────────
  // cellEdit = { date, field } xác định ô đang được sửa trực tiếp
  type CellField = 'shift' | 'checkIn' | 'checkOut' | 'hcHours' | 'otHours';
  const [cellEdit, setCellEdit] = useState<{ date: string; field: CellField } | null>(null);
  // Giá trị tạm trong ô đang sửa
  const [cellVal, setCellVal] = useState<string>('');

  /** Mở sửa 1 ô cụ thể */
  const openCellEdit = (rec: DailyAttendance, field: CellField) => {
    if (!selEmpId) return;
    let initial = '';
    const isNight = (rec.nightHours || 0) > 0;
    if (field === 'shift')    initial = isNight ? 'night' : 'day';
    if (field === 'checkIn')  initial = rec.checkIn  || (isNight ? '20:00' : '07:30');
    if (field === 'checkOut') initial = rec.checkOut || (isNight ? '05:00' : '17:00');
    if (field === 'hcHours')  initial = (rec.hcHours  || 0).toString();
    if (field === 'otHours') {
      let otVal = rec.otHours || 0;
      if (isNight && rec.checkIn && rec.checkOut) {
        const s = parseTime24(rec.checkIn);  const startD = toDecHours(s.h, s.m, s.ampm);
        const e = parseTime24(rec.checkOut); const endD   = toDecHours(e.h, e.m, e.ampm);
        const pc50 = calcNightAllowance50(startD, endD);
        if (otVal === pc50) {
          otVal = calcOtHours(startD, endD);
        }
      }
      initial = otVal.toString();
    }
    setCellEdit({ date: rec.date, field });
    setCellVal(initial);
  };

  /** Lưu ô vừa sửa xong */
  const commitCellEdit = (rec: DailyAttendance) => {
    if (!selEmpId || !cellEdit) return;
    const { field } = cellEdit;
    if (field === 'shift') {
      const isNight = cellVal === 'night';
      // Khi đổi ca → tính lại HC/OT từ giờ vào-ra hiện tại
      const inStr  = rec.checkIn  || (isNight ? '20:00' : '07:30');
      const outStr = rec.checkOut || (isNight ? '05:00' : '17:00');
      const s = parseTime24(inStr);  const startD = toDecHours(s.h, s.m, s.ampm);
      const e = parseTime24(outStr); const endD   = toDecHours(e.h, e.m, e.ampm);
      const hc = calcHcHours(startD, endD);
      const ot = calcOtHours(startD, endD);
      // EPCC (night-shift-ot-fix) - Ca đêm: nightHours là PC 30% (22:00-05:00), otHours là số giờ tăng ca thực tế (calcOtHours)
      updateAttendanceDay(selEmpId, rec.date, 'nightHours',  isNight ? calcNightAllowance30(startD, endD) : 0);
      updateAttendanceDay(selEmpId, rec.date, 'hcHours',     hc);
      updateAttendanceDay(selEmpId, rec.date, 'otHours',     ot);
      showToast(`Đổi ca ngày ${rec.date} → ${isNight ? 'Ca đêm' : 'Ca ngày'}`);
    } else if (field === 'checkIn' || field === 'checkOut') {
      // Lưu giờ vào/ra mới và tính lại HC (+ PC đêm 30% nếu là ca đêm)
      const isNight = (rec.nightHours || 0) > 0;
      const inStr  = field === 'checkIn'  ? cellVal : (rec.checkIn  || (isNight ? '20:00' : '07:30'));
      const outStr = field === 'checkOut' ? cellVal : (rec.checkOut || (isNight ? '05:00' : '17:00'));
      updateAttendanceDay(selEmpId, rec.date, field, cellVal);
      const s = parseTime24(inStr);  const startD = toDecHours(s.h, s.m, s.ampm);
      const e = parseTime24(outStr); const endD   = toDecHours(e.h, e.m, e.ampm);
      const hc = calcHcHours(startD, endD);
      const ot = calcOtHours(startD, endD);
      updateAttendanceDay(selEmpId, rec.date, 'hcHours', hc);
      updateAttendanceDay(selEmpId, rec.date, 'otHours', ot);
      if (isNight) {
        updateAttendanceDay(selEmpId, rec.date, 'nightHours', calcNightAllowance30(startD, endD));
      } else {
        updateAttendanceDay(selEmpId, rec.date, 'nightHours', 0);
      }
      showToast(`Cập nhật giờ ngày ${rec.date}: vào ${inStr} → ra ${outStr}, HC=${hc.toFixed(1)}h | OT=${ot.toFixed(1)}h`);
    } else if (field === 'hcHours') {
      const val = parseFloat(cellVal);
      if (!isNaN(val) && val >= 0) {
        updateAttendanceDay(selEmpId, rec.date, 'hcHours', val);
        showToast(`Cập nhật HC ngày ${rec.date}: ${val.toFixed(1)}h`);
      }
    } else if (field === 'otHours') {
      const val = parseFloat(cellVal);
      if (!isNaN(val) && val >= 0) {
        // Chỉ ghi otHours; nightHours/sundayHours/holidayHours GIỮ NGUYÊN
        updateAttendanceDay(selEmpId, rec.date, 'otHours', val);
        showToast(`Cập nhật OT ngày ${rec.date}: ${val.toFixed(1)}h`);
      }
    }
    setCellEdit(null);
  };

  const cancelCellEdit = () => setCellEdit(null);

  /** Mở chế độ sửa trực tiếp cho 1 dòng trong bảng "Điểm danh gần đây" */
  const startEditRow = (rec: DailyAttendance) => {
    const r = rec;
    const isNight = (rec.nightHours || 0) > 0;
    setEditingDate(rec.date);
    setEditDate(rec.date);
    setEditIsNight(isNight);
    if (r.checkIn && r.checkOut) {
      // Đã có giờ vào/ra thực tế được lưu trước đó → đổ đúng giá trị đã nhập
      const s = parseTime24(r.checkIn);
      const e = parseTime24(r.checkOut);
      setEditSH(s.h); setEditSMin(s.m); setEditSAP(s.ampm);
      setEditEH(e.h); setEditEMin(e.m); setEditEAP(e.ampm);
    } else if (isNight) {
      // Bản ghi cũ chưa có checkIn/checkOut (tạo trước khi có bản vá này) → tạm dùng khung giờ chuẩn
      setEditSH(8); setEditSMin(0); setEditSAP('PM');
      setEditEH(5); setEditEMin(0); setEditEAP('AM');
    } else {
      setEditSH(7); setEditSMin(30); setEditSAP('AM');
      setEditEH(5); setEditEMin(0); setEditEAP('PM');
    }
  };

  const cancelEditRow = () => setEditingDate(null);

  /** Lưu dòng đang sửa: tính lại HC/OT/Ca đêm từ giờ vào-ra mới, ghi đè bản ghi (và di chuyển
   *  sang ngày mới nếu người dùng đổi cả cột Ngày). */
  const saveEditRow = (rec: DailyAttendance) => {
    if (!selEmpId) return;
    const hcH = editHcAuto;
    const otH = editOtAuto;
    let nightH = 0;
    if (editIsNight) {
      // EPCC (night-shift-ot-fix) - Ca đêm: nightHours là PC 30% (22:00-05:00), otHours là số giờ tăng ca (editOtAuto)
      nightH = editNight30Auto;
    }

    const applyTo = (dateKey: string) => {
      updateAttendanceDay(selEmpId, dateKey, 'hcHours', hcH);
      updateAttendanceDay(selEmpId, dateKey, 'otHours', otH);
      updateAttendanceDay(selEmpId, dateKey, 'nightHours', nightH);
      updateAttendanceDay(selEmpId, dateKey, 'sundayHours', rec.sundayHours || 0);
      updateAttendanceDay(selEmpId, dateKey, 'holidayHours', rec.holidayHours || 0);
      updateAttendanceDay(selEmpId, dateKey, 'isManual', true);
      updateAttendanceDay(selEmpId, dateKey, 'checkIn',  fmtTime24(editSH, editSMin, editSAP));
      updateAttendanceDay(selEmpId, dateKey, 'checkOut', fmtTime24(editEH, editEMin, editEAP));
    };

    if (editDate !== rec.date) {
      // Đổi sang ngày khác → ghi bản ghi mới, đồng thời "xóa mềm" (đưa về 0) bản ghi ngày cũ
      applyTo(editDate);
      updateAttendanceDay(selEmpId, rec.date, 'hcHours', 0);
      updateAttendanceDay(selEmpId, rec.date, 'otHours', 0);
      updateAttendanceDay(selEmpId, rec.date, 'nightHours', 0);
      updateAttendanceDay(selEmpId, rec.date, 'sundayHours', 0);
      updateAttendanceDay(selEmpId, rec.date, 'holidayHours', 0);
      updateAttendanceDay(selEmpId, rec.date, 'isManual', false);
    } else {
      applyTo(rec.date);
    }

    setEditingDate(null);
    showToast(`Đã sửa điểm danh ngày ${editDate}: HC=${hcH.toFixed(1)}h | OT=${otH.toFixed(1)}h`);
  };

  const recentRecs = useMemo(() => {
    if (!selEmpId) return [];
    const rec = attendanceRecords[`${selEmpId}_${selectedYear}_${selectedMonth}`];
    if (!rec?.dailyRecords) return [];
    return (Object.values(rec.dailyRecords) as (DailyAttendance & { isManual?: boolean })[])
      .filter(d => d.isManual === true)
      .sort((a, b) => a.date > b.date ? -1 : 1)
      .slice(0, 10);
  }, [selEmpId, selectedYear, selectedMonth, attendanceRecords]);

  const stats = useMemo(() => {
    if (!selEmpId) return { hc: 0, ot: 0 };
    const rec = attendanceRecords[`${selEmpId}_${selectedYear}_${selectedMonth}`];
    if (!rec?.dailyRecords) return { hc: 0, ot: 0 };
    let hc = 0, ot = 0;
    (Object.values(rec.dailyRecords) as DailyAttendance[]).forEach(d => {
      hc += d.hcHours || 0;
      let dayOt = d.otHours || 0;
      if ((d.nightHours || 0) > 0 && d.checkIn && d.checkOut) {
        const dIn = parseTime24(d.checkIn);
        const dOut = parseTime24(d.checkOut);
        const sDec = toDecHours(dIn.h, dIn.m, dIn.ampm);
        const eDec = toDecHours(dOut.h, dOut.m, dOut.ampm);
        const legacyPc50 = calcNightAllowance50(sDec, eDec);
        if (dayOt === legacyPc50) {
          dayOt = calcOtHours(sDec, eDec);
        }
      }
      ot += dayOt + (d.sundayHours || 0) + (d.holidayHours || 0);
    });
    return { hc, ot };
  }, [selEmpId, selectedYear, selectedMonth, attendanceRecords]);

  const doSave = () => {
    if (!selEmpId) { setSaveAttempted(true); showToast('Vui lòng chọn nhân viên!', 'error'); return; }
    const ds = `${eYr}-${pad2(eMon)}-${pad2(eDay)}`;
    let hcH = 0, otH = 0, nightH = 0, sunH = 0, holH = 0, lpD = 0, laD = 0, luD = 0;

    if (status !== 'absent_paid' && status !== 'absent_annual' && status !== 'absent_unpaid') {
      hcH = hcAuto;
    }

    if (shift === 'night') {
      // EPCC (night-shift-ot-fix) - PC ca đêm 30% = khung 22:00–05:00 (tối đa 6h),
      // OT (otHours) = số giờ làm thêm thực tế (05:00–08:00 = 3h) từ otAuto.
      const sDec = toDecHours(sH, sMin, sAP);
      const eDec = toDecHours(eH, eMin, eAP);
      nightH = calcNightAllowance30(sDec, eDec);
      if (otType === 'sunday200') {
        sunH = otAuto;
      } else if (otType === 'holiday300') {
        holH = otAuto;
      } else {
        otH = otAuto;
      }
    } else if (otType === 'sunday200') {
      sunH = otAuto;
    } else if (otType === 'holiday300') {
      holH = otAuto;
    } else {
      otH = otAuto;
    }

    if (status === 'absent_paid'   || specialDay === 'leavePaid')   lpD = 1;
    if (status === 'absent_annual' || specialDay === 'leaveAnnual') laD = 1;
    if (status === 'absent_unpaid' || specialDay === 'leaveUnpaid') luD = 1;

    updateAttendanceDay(selEmpId, ds, 'hcHours',        hcH);
    updateAttendanceDay(selEmpId, ds, 'otHours',        otH);
    updateAttendanceDay(selEmpId, ds, 'nightHours',     nightH);
    updateAttendanceDay(selEmpId, ds, 'sundayHours',    sunH);
    updateAttendanceDay(selEmpId, ds, 'holidayHours',   holH);
    updateAttendanceDay(selEmpId, ds, 'leavePaidDays',  lpD);
    updateAttendanceDay(selEmpId, ds, 'leaveAnnualDays', laD);
    updateAttendanceDay(selEmpId, ds, 'leaveUnpaidDays', luD);
    updateAttendanceDay(selEmpId, ds, 'isManual',       true);
    // EPCC (checkin-checkout-not-persisted) - FIX ROOT CAUSE "Giờ vào/ra trong bảng không khớp lúc nhập Manual":
    // Lưu giờ vào/ra thực tế đã chọn để bảng "Điểm danh gần đây" hiển thị đúng giờ đã nhập.
    updateAttendanceDay(selEmpId, ds, 'checkIn',  fmtTime24(sH, sMin, sAP));
    updateAttendanceDay(selEmpId, ds, 'checkOut', fmtTime24(eH, eMin, eAP));

    const nm = employees.find(e => e.id === selEmpId)?.fullName;
    showToast(`Đã lưu điểm danh ngày ${pad2(eDay)}/${pad2(eMon)}/${eYr} cho ${nm}! HC=${hcH}h | OT=${otH + sunH + holH}h`);
    setSaveAttempted(false);

    // EPCC (checkin-sets-viewer-identity) — sau khi điểm danh xong, nhớ nhân viên này là
    // người đang dùng thiết bị/trình duyệt này
    setLastCheckedInEmployeeId(selEmpId);
  };

  /** Khi đổi ca → tự động điền giờ mặc định phù hợp
   *  EPCC (default-end-time-wrong) - FIX ROOT CAUSE: giờ kết thúc chuẩn của ca ngày là 17:00 (5:00 PM),
   *  của ca đêm là 05:00 (5:00 AM hôm sau) — không phải 20:00 / 07:30 như trước. Người dùng chỉnh tay
   *  giờ kết thúc nếu thực tế có tăng ca thêm, hệ thống không được tự cộng OT khi chưa ai yêu cầu. */
  const onShiftChange = (newShift: ShiftType) => {
    setShift(newShift);
    if (newShift === 'night') {
      // Ca đêm: bắt đầu 8:00 PM, kết thúc chuẩn 5:00 AM
      setSH(8);  setSMin(0);  setSAP('PM');
      setEH(5);  setEMin(0);  setEAP('AM');
    } else {
      // Ca ngày / chia đôi: bắt đầu 7:30 AM, kết thúc chuẩn 5:00 PM
      setSH(7);  setSMin(30); setSAP('AM');
      setEH(5);  setEMin(0);  setEAP('PM');
    }
  };

  const doCancel = () => {
    setSelEmpId(''); setStatus('present'); setShift('day'); setOtType('none'); setSpecialDay('normal');
    // Reset về mặc định ca ngày
    setSH(7); setSMin(30); setSAP('AM'); setEH(8); setEMin(0); setEAP('PM');
    setSaveAttempted(false);
  };

  const filteredEmps = employees.filter(e =>
    e.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || e.id.includes(searchTerm)
  );
  const mp = pad2(selectedMonth);
  const statusColor = STATUS_OPTIONS.find(s => s.value === status)?.color || 'inherit';

  // ── Ma trận ngày (HC vs OT) — hiển thị theo từng tháng, freeze panes 3 cột đầu
  // (copy nguyên bản từ ReportsTab.tsx theo yêu cầu người dùng, không đổi gì)
  const matrixScrollRef = useRef<HTMLDivElement>(null);

  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const dayColumns = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const monthDays = useMemo(() => {
    return dayColumns.map((d) => ({
      day: d,
      dateStr: `${selectedYear}-${pad2(selectedMonth)}-${pad2(d)}`,
      isSunday: new Date(selectedYear, selectedMonth - 1, d).getDay() === 0,
    }));
  }, [selectedYear, selectedMonth]);

  /** Lấy giờ HC hoặc OT (gộp OT150/Đêm/CN/Lễ) của 1 nhân viên trong 1 ngày cụ thể của tháng đang chọn */
  const getDayVal = (empId: string, dateStr: string, type: 'hc' | 'ot'): number => {
    const rec = attendanceRecords[`${empId}_${selectedYear}_${selectedMonth}`];
    const d = rec?.dailyRecords?.[dateStr] as DailyAttendance | undefined;
    if (!d) return 0;
    if (type === 'hc') return d.hcHours || 0;
    let otVal = d.otHours || 0;
    if ((d.nightHours || 0) > 0 && d.checkIn && d.checkOut) {
      const dIn = parseTime24(d.checkIn);
      const dOut = parseTime24(d.checkOut);
      const sDec = toDecHours(dIn.h, dIn.m, dIn.ampm);
      const eDec = toDecHours(dOut.h, dOut.m, dOut.ampm);
      const legacyPc50 = calcNightAllowance50(sDec, eDec);
      if (otVal === legacyPc50) {
        otVal = calcOtHours(sDec, eDec);
      }
    }
    return otVal + (d.sundayHours || 0) + (d.holidayHours || 0);
  };

  // Về đầu bảng mỗi khi đổi tháng, để luôn thấy ngày 01 trước tiên
  useEffect(() => {
    matrixScrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
  }, [selectedMonth, selectedYear]);

  return (
    // EPCC (gap-sync-2mm-with-header) - FIX theo yêu cầu người dùng: đồng bộ
    // khoảng cách Topbar -> 2 card thông tin bên dưới theo đúng 2mm mà App.tsx
    // đang dùng cho khoảng cách Header -> Card đầu tiên (trước đây space-y-4
    // = 16px, rộng gấp đôi 2mm ~ 7.6px nên nhìn không đều).
    <div className="space-y-[2mm]">
      {/* ── Top Bar ── */}
      {/* EPCC (remove-autofill-bigger-topbar-text) - FIX theo yêu cầu người
          dùng: (1) xóa hẳn nút "Điền tự động tháng .../..." (đã bị gạch chéo
          trong ảnh mẫu, không dùng nữa); (2) tăng cỡ chữ toàn vùng khoanh đỏ
          (ô "Kỳ:"/dropdown Tháng-Năm/3 nút chuyển view) lên 20% so với cỡ cũ
          (text-xs = 0.75rem -> 0.9rem = 0.75rem * 1.2). */}
      <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period selector */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <Calendar className="w-4 h-4 text-blue-500" />
            <span className="text-[0.9rem] font-semibold text-slate-600 dark:text-slate-300">Kỳ:</span>
            <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent border-none text-[0.9rem] font-bold text-slate-800 dark:text-slate-200 cursor-pointer outline-none">
              {Array.from({ length: 12 }, (_, i) => i + 1).map(mo =>
                <option key={mo} value={mo}>Tháng {mo}</option>)}
            </select>
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
              className="bg-transparent border-none text-[0.9rem] font-bold text-slate-800 dark:text-slate-200 cursor-pointer outline-none">
              {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
            {([['manual', 'Nhập điểm danh', PencilLine], ['table', 'Bảng tổng hợp', LayoutList]] as const).map(([mode, label, Icon]) => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[0.9rem] font-semibold transition-all ${viewMode === mode ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50'}`}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>
        </div>

        {/* Search filter — chuyển từ header bảng "Bảng tổng hợp" lên card đầu tiên */}
        <div className="flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <input type="text" placeholder="Lọc NV theo tên hoặc Mã NV..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>


      {/* ══════════ MANUAL MODE ══════════ */}
      {viewMode === 'manual' && (
        // EPCC (gap-sync-2mm-with-header) - đồng bộ khoảng cách 2 card thông
        // tin -> bảng "Danh sách điểm danh gần đây" theo đúng 2mm (xem ghi
        // chú ở div bọc ngoài phía trên).
        <div className="space-y-[2mm]">
          {/* Form cards */}
          {/* EPCC (merge-2-cards-into-1-mobile-friendly) - FIX theo yêu cầu
              người dùng: trước đây có 2 card riêng "Thông tin chấm công"
              (trái) / "Thông tin nhân viên" (phải) xếp cạnh nhau bằng
              grid-cols-2 — trên mobile bị bóp chật, khó dùng. Đã GỘP toàn bộ
              5 ô của card phải (Nhân viên, Ngày, Trạng thái, Ca làm, Ngày
              đặc biệt) vào chung 1 card duy nhất với card trái, xếp theo cột
              dọc — hợp lý hơn hẳn khi xem trên điện thoại. Đồng thời xoá hẳn
              dòng tiêu đề chữ "Thông tin chấm công" theo yêu cầu người dùng
              (không còn header bar trên cùng của card nữa). */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="p-2.5 space-y-2">
              {/* Dòng 1: Nhân viên + Trạng thái + Ngày + Ngày đặc biệt */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-red-500 mb-0.5">● Nhân viên</label>
                  <div className="relative">
                    <select value={selEmpId} onChange={e => setSelEmpId(e.target.value)}
                      className={`w-full h-[32px] appearance-none pl-2.5 pr-6 text-xs border rounded-md font-semibold cursor-pointer focus:outline-none bg-yellow-50 dark:bg-yellow-950/30 ${
                        saveAttempted && !selEmpId
                          ? 'border-red-500 ring-2 ring-red-300 dark:ring-red-800 text-slate-400'
                          : selEmpId
                            ? 'border-yellow-400 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-yellow-400'
                            : 'border-yellow-300 text-slate-400 focus:ring-2 focus:ring-yellow-400'
                      }`}>
                      <option value="">Chọn nhân viên</option>
                      {employees.map(e => (
                        <option key={e.id} value={e.id}>[{e.id}] {e.fullName} – {e.department}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                  {saveAttempted && !selEmpId && (
                    <p className="mt-0.5 text-[9px] font-semibold text-red-500">⚠ Vui lòng chọn NV</p>
                  )}
                </div>

                <SelectRow
                  label="Trạng thái" required
                  value={status} onChange={v => setStatus(v as AttendanceStatus)}
                  options={STATUS_OPTIONS}
                  rowCls="bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 focus:ring-blue-500"
                  style={{ color: statusColor }}
                />

                <div>
                  <label className="block text-[10px] font-bold text-red-500 mb-0.5">● Ngày</label>
                  <input type="date"
                    value={`${eYr}-${pad2(eMon)}-${pad2(eDay)}`}
                    onChange={e => { const d = new Date(e.target.value); if (!isNaN(d.getTime())) { setEDay(d.getDate()); setEMon(d.getMonth() + 1); setEYr(d.getFullYear()); } }}
                    className="w-full h-[32px] px-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-slate-800 dark:text-slate-200 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>

                <SelectRow
                  label="Ngày đặc biệt" value={specialDay} onChange={v => setSpecialDay(v as SpecialDay)}
                  options={SPECIAL_OPTIONS}
                  rowCls="bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 focus:ring-blue-500"
                />
              </div>

              {/* Dòng 2: Giờ bắt đầu + Giờ kết thúc + Nút Lưu (cùng dòng) */}
              <div className="grid grid-cols-5 gap-2 items-end">
                <div className="col-span-2">
                  <TimePick label="Giờ bắt đầu" h={sH} m={sMin} ampm={sAP} onH={setSH} onM={setSMin} onAP={setSAP} />
                </div>
                <div className="col-span-2">
                  <TimePick label="Giờ kết thúc" h={eH} m={eMin} ampm={eAP} onH={setEH} onM={setEMin} onAP={setEAP} />
                </div>
                <div className="col-span-1">
                  <button onClick={doSave}
                    className="w-full h-[32px] flex items-center justify-center gap-1 bg-green-600 hover:bg-green-700 active:scale-95 text-white font-bold text-xs rounded-md shadow transition-all cursor-pointer">
                    <Save className="w-3.5 h-3.5" />💾 Lưu
                  </button>
                </div>
              </div>

              {/* Dòng 3: Ca làm + HC / OT ngoài giờ / Loại OT-Phụ cấp */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-stretch">
                <SelectRow
                  label="Ca làm" required value={shift} onChange={v => onShiftChange(v as ShiftType)}
                  options={SHIFT_OPTIONS}
                  rowCls="bg-yellow-50 dark:bg-yellow-950/30 border-yellow-300 dark:border-yellow-700 text-slate-800 dark:text-slate-100 focus:ring-yellow-400"
                />
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">HC (h)</label>
                  <div className="h-[32px] px-2 bg-green-50 dark:bg-green-950/30 border border-green-400 dark:border-green-600 rounded-md text-green-800 dark:text-green-300 font-bold text-xs flex items-center justify-between">
                    <span>{hcAuto % 1 === 0 ? hcAuto.toFixed(1) : hcAuto}</span>
                    <span className="text-[9px] font-normal text-green-600/70">(= {(hcAuto / 8).toFixed(3)} công)</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-amber-600 mb-0.5">
                    {shift === 'night' ? '🌙 Ca đêm' : '⏰ OT (h)'}
                  </label>
                  <div className={`h-[32px] px-2.5 rounded-md font-bold text-xs flex items-center justify-between border ${
                    otAuto > 0
                      ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-300'
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-400'
                  }`}>
                    <span>{otAuto.toFixed(1)}</span>
                    {otAuto > 0 && (
                      <span className="text-[9px] font-semibold px-1 py-0.2 rounded bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100">
                        {shift === 'night' ? 'Đêm' : 'OT'}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Loại OT / Phụ cấp</label>
                  <div className="relative">
                    <select
                      value={otType}
                      onChange={e => setOtType(e.target.value as OtType)}
                      className="w-full h-[32px] appearance-none pl-2.5 pr-6 text-xs rounded-md font-semibold cursor-pointer focus:outline-none focus:ring-2 border bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 focus:ring-blue-500"
                    >
                      {OT_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
          </div>


          {/* Recent records table */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                {/* EPCC (date-first-no-stt) - FIX theo yêu cầu người dùng:
                    bỏ hẳn cột "STT", chuyển cột "Ngày" lên vị trí đầu tiên. */}
                <thead className="bg-[#122842] text-white text-[11px] font-bold uppercase">
                  <tr>
                    {/* EPCC (add-night-allowance-30-50-columns) - FIX theo
                        yêu cầu người dùng: thêm 2 cột "PC Đêm 30%" (nightHours)
                        và "PC Đêm 50%" (otHours phát sinh trong ca đêm) vào
                        bảng "Danh sách điểm danh gần đây", đặt giữa "OT (h)"
                        và "Thao tác" — cùng nguồn dữ liệu và ý nghĩa với 2 cột
                        "Đêm 30%"/"Đêm 50%" ở bảng tổng hợp phía dưới. */}
                    {['Ngày','Mã NV','Họ tên','Vị trí','Ca làm','Trạng thái','Giờ vào','Giờ ra','HC (h)','OT (h)','PC Đêm 30%','PC Đêm 50%','Thao tác']
                      .map(h => <th key={h} className="py-2 px-3 text-left">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {recentRecs.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="py-8 text-center text-slate-400 text-xs">
                        {selEmpId
                          ? 'Chưa có bản ghi điểm danh nào. Hãy nhập thông tin phía trên và nhấn Lưu!'
                          : 'Chọn nhân viên để xem danh sách điểm danh.'}
                      </td>
                    </tr>
                  ) : recentRecs.map((rec) => {
                    const emp = employees.find(e => e.id === selEmpId);
                    const isNightRow = (rec.nightHours || 0) > 0;
                    const pcIn  = parseTime24(rec.checkIn  || (isNightRow ? '20:00' : '07:30'));
                    const pcOut = parseTime24(rec.checkOut || (isNightRow ? '05:00' : '17:00'));
                    const pcStartDec = toDecHours(pcIn.h, pcIn.m, pcIn.ampm);
                    const pcEndDec   = toDecHours(pcOut.h, pcOut.m, pcOut.ampm);
                    const pc30 = isNightRow ? calcNightAllowance30(pcStartDec, pcEndDec) : 0;
                    const pc50 = isNightRow ? calcNightAllowance50(pcStartDec, pcEndDec) : 0;
                    let displayOt = rec.otHours || 0;
                    if (isNightRow && (displayOt === pc50 || (rec.checkIn && rec.checkOut))) {
                      displayOt = calcOtHours(pcStartDec, pcEndDec);
                    }
                    const ot = displayOt + (rec.sundayHours || 0) + (rec.holidayHours || 0);
                    const badge = (text: string, cls: string) =>
                      <span className={`inline-flex px-2 py-0.5 rounded-full font-semibold text-[10px] ${cls}`}>{text}</span>;
                    // EPCC (date-first-no-stt) - tính isEditing sớm hơn (trước đây khai
                    // báo bên trong IIFE) để dùng chung cho ô "Ngày" mới đưa lên đầu dòng.
                    const isEditing = editingDate === rec.date;
                    // rec.date dạng "YYYY-MM-DD" — chỉ lấy DD/MM để hiển thị theo yêu cầu người dùng.
                    const [, dMonth, dDay] = rec.date.split('-');
                    return (
                      <tr key={rec.date} className="hover:bg-blue-50/40 dark:hover:bg-slate-700/40 transition-colors">
                        {/* EPCC (bold-dark-text-match-hoten) - FIX theo yêu
                            cầu người dùng: các ô "Ngày"/"Mã NV"/"Vị trí"/
                            "Ca làm"/"Giờ vào"/"Giờ ra" trước đây màu xám nhạt
                            (text-slate-500/600), khó đọc hơn hẳn cột "Họ
                            tên" (font-bold text-slate-900). Đồng bộ toàn bộ
                            sang font-bold text-slate-900 dark:text-slate-100
                            giống "Họ tên" để rõ, dễ đọc như nhau. */}
                        {/* Cột "Ngày" — chuyển lên đầu, thay cho cột STT đã bỏ */}
                        {isEditing ? (
                          <td className="py-1.5 px-2">
                            <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                              className="w-full px-1.5 py-1 text-[11px] font-mono bg-yellow-50 dark:bg-yellow-950/30 border border-amber-400 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                          </td>
                        ) : (
                          <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100 font-mono">{dDay}/{dMonth}</td>
                        )}
                        <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">{selEmpId}</td>
                        <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">{emp?.fullName}</td>
                        <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">{emp?.position}</td>
                        {(() => {
                          const statusBadge = rec.hcHours > 0 ? badge('Có mặt', 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300')
                            : rec.leavePaidDays > 0 ? badge('Nghỉ lương', 'bg-blue-100 text-blue-700')
                            : rec.leaveAnnualDays > 0 ? badge('Nghỉ phép', 'bg-sky-100 text-sky-700')
                            : rec.sundayHours > 0 ? badge('Chủ nhật', 'bg-red-100 text-red-700')
                            : badge('–', 'bg-slate-100 text-slate-500');
                          if (!isEditing) {
                            // Helpers để render ô có thể click-to-edit
                            const isCellActive = (field: CellField) =>
                              cellEdit?.date === rec.date && cellEdit.field === field;

                            /** Wrapper cho ô click-to-edit: hiện value tĩnh hoặc input khi click */
                            const EditableCell = ({
                              field, display, children,
                            }: { field: CellField; display: React.ReactNode; children: React.ReactNode }) => {
                              if (isCellActive(field)) return <>{children}</>;
                              return (
                                <span
                                  className="cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900/30 hover:text-yellow-800 dark:hover:text-yellow-200 rounded px-1 transition-colors"
                                  title="Click để sửa"
                                  onClick={() => openCellEdit(rec, field)}>
                                  {display}
                                </span>
                              );
                            };

                            const cellCls = "w-full px-1 py-0.5 text-[11px] border border-amber-400 rounded bg-yellow-50 dark:bg-yellow-950/30 focus:outline-none focus:ring-1 focus:ring-amber-500";

                            return (
                              <>
                                {/* CA LÀM — click để chuyển Ca ngày ↔ Ca đêm */}
                                <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">
                                  <EditableCell field="shift" display={rec.nightHours > 0 ? 'Ca đêm' : 'Ca ngày'}>
                                    <select
                                      autoFocus
                                      value={cellVal}
                                      className={cellCls}
                                      onChange={e => setCellVal(e.target.value)}
                                      onBlur={() => commitCellEdit(rec)}
                                      onKeyDown={e => { if (e.key === 'Enter') commitCellEdit(rec); if (e.key === 'Escape') cancelCellEdit(); }}>
                                      <option value="day">Ca ngày</option>
                                      <option value="night">Ca đêm</option>
                                    </select>
                                  </EditableCell>
                                </td>
                                <td className="py-2 px-3">{statusBadge}</td>
                                {/* GIỜ VÀO */}
                                <td className="py-2 px-3 text-center font-bold text-slate-900 dark:text-slate-100 font-mono">
                                  <EditableCell field="checkIn" display={rec.checkIn || (rec.nightHours > 0 ? '20:00' : '07:30')}>
                                    <input
                                      type="time"
                                      autoFocus
                                      value={cellVal}
                                      className={cellCls + ' w-24'}
                                      onChange={e => setCellVal(e.target.value)}
                                      onBlur={() => commitCellEdit(rec)}
                                      onKeyDown={e => { if (e.key === 'Enter') commitCellEdit(rec); if (e.key === 'Escape') cancelCellEdit(); }} />
                                  </EditableCell>
                                </td>
                                {/* GIỜ RA */}
                                <td className="py-2 px-3 text-center font-bold text-slate-900 dark:text-slate-100 font-mono">
                                  <EditableCell field="checkOut" display={rec.checkOut || (rec.nightHours > 0 ? '05:00' : '17:00')}>
                                    <input
                                      type="time"
                                      autoFocus
                                      value={cellVal}
                                      className={cellCls + ' w-24'}
                                      onChange={e => setCellVal(e.target.value)}
                                      onBlur={() => commitCellEdit(rec)}
                                      onKeyDown={e => { if (e.key === 'Enter') commitCellEdit(rec); if (e.key === 'Escape') cancelCellEdit(); }} />
                                  </EditableCell>
                                </td>
                                {/* HC (H) */}
                                <td className="py-2 px-3 text-center font-bold text-blue-700 dark:text-blue-300">
                                  <EditableCell field="hcHours" display={rec.hcHours?.toFixed(1) || '0.0'}>
                                    <input
                                      type="number"
                                      autoFocus
                                      step="0.5" min="0" max="24"
                                      value={cellVal}
                                      className={cellCls + ' w-16 text-center'}
                                      onChange={e => setCellVal(e.target.value)}
                                      onBlur={() => commitCellEdit(rec)}
                                      onKeyDown={e => { if (e.key === 'Enter') commitCellEdit(rec); if (e.key === 'Escape') cancelCellEdit(); }} />
                                  </EditableCell>
                                </td>
                                {/* OT (H) */}
                                <td className="py-2 px-3 text-center font-bold text-amber-600 dark:text-amber-300">
                                  <EditableCell field="otHours" display={ot > 0 ? ot.toFixed(1) : '–'}>
                                    <input
                                      type="number"
                                      autoFocus
                                      step="0.5" min="0" max="24"
                                      value={cellVal}
                                      className={cellCls + ' w-16 text-center'}
                                      onChange={e => setCellVal(e.target.value)}
                                      onBlur={() => commitCellEdit(rec)}
                                      onKeyDown={e => { if (e.key === 'Enter') commitCellEdit(rec); if (e.key === 'Escape') cancelCellEdit(); }} />
                                  </EditableCell>
                                </td>
                                {/* PC ĐÊM 30% — tính live từ checkIn/checkOut theo khung 22:00–05:00 (calcNightAllowance30) */}
                                <td className="py-2 px-3 text-center font-bold text-indigo-600 dark:text-indigo-300">
                                  {pc30 > 0 ? pc30.toFixed(1) : '–'}
                                </td>
                                {/* PC ĐÊM 50% — tính live từ checkIn/checkOut theo khung 05:00–06:00 (calcNightAllowance50) */}
                                <td className="py-2 px-3 text-center font-bold text-purple-600 dark:text-purple-300">
                                  {pc50 > 0 ? pc50.toFixed(1) : '–'}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <div className="flex gap-1 justify-center">
                                    <button
                                      onClick={() => startEditRow(rec)}
                                      title="Sửa toàn bộ dòng"
                                      className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-500 transition-colors">
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    {/* EPCC (delete-attendance-day-row) — nút xóa hẳn 1 dòng
                                        điểm danh (1 ngày) khi nhập sai, để nhập lại từ đầu.
                                        Có window.confirm chặn trước để tránh bấm nhầm mất dữ
                                        liệu ngày đó. */}
                                    <button
                                      onClick={() => {
                                        if (window.confirm(`Xóa điểm danh ngày ${dDay}/${dMonth} của ${emp?.fullName}? Hành động này không thể hoàn tác.`)) {
                                          deleteAttendanceDay(selEmpId, rec.date);
                                          showToast(`Đã xóa điểm danh ngày ${dDay}/${dMonth} — vui lòng nhập lại nếu cần.`, 'success');
                                        }
                                      }}
                                      title="Xóa dòng — nhập sai thì xóa để nhập lại"
                                      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 transition-colors">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </>
                            );
                          }
                          // ── Chế độ sửa trực tiếp trên dòng ──
                          return (
                            <>
                              <td className="py-1.5 px-2">
                                {/* EPCC (ca-lam-not-editable) - FIX ROOT CAUSE "chưa sửa trực tiếp được ca làm nếu nhập nhầm ngày/đêm":
                                    Ô Ca làm giờ nằm ngay trong khối sửa trực tiếp, đổi ca sẽ tự nạp lại khung giờ chuẩn tương ứng. */}
                                <select value={editIsNight ? 'night' : 'day'} onChange={e => {
                                  const night = e.target.value === 'night';
                                  setEditIsNight(night);
                                  if (night) { setEditSH(8); setEditSMin(0); setEditSAP('PM'); setEditEH(5); setEditEMin(0); setEditEAP('AM'); }
                                  else { setEditSH(7); setEditSMin(30); setEditSAP('AM'); setEditEH(5); setEditEMin(0); setEditEAP('PM'); }
                                }} className="w-full px-1.5 py-1 text-[11px] font-semibold bg-yellow-50 dark:bg-yellow-950/30 border border-amber-400 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500">
                                  <option value="day">Ca ngày</option>
                                  <option value="night">Ca đêm</option>
                                </select>
                              </td>
                              <td className="py-1.5 px-2">{statusBadge}</td>
                              <td className="py-1.5 px-1">
                                <div className="flex gap-0.5 justify-center">
                                  <select value={editSH} onChange={e => setEditSH(Number(e.target.value))}
                                    className="w-10 px-0.5 py-1 text-[10px] bg-yellow-50 dark:bg-yellow-950/30 border border-amber-400 rounded text-slate-900 dark:text-slate-100">
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(hv => <option key={hv} value={hv}>{pad2(hv)}</option>)}
                                  </select>
                                  <select value={editSMin} onChange={e => setEditSMin(Number(e.target.value))}
                                    className="w-10 px-0.5 py-1 text-[10px] bg-yellow-50 dark:bg-yellow-950/30 border border-amber-400 rounded text-slate-900 dark:text-slate-100">
                                    {[0, 15, 30, 45].map(mv => <option key={mv} value={mv}>{pad2(mv)}</option>)}
                                  </select>
                                  <select value={editSAP} onChange={e => setEditSAP(e.target.value as 'AM' | 'PM')}
                                    className="w-10 px-0.5 py-1 text-[10px] bg-yellow-50 dark:bg-yellow-950/30 border border-amber-400 rounded text-slate-900 dark:text-slate-100">
                                    <option>AM</option><option>PM</option>
                                  </select>
                                </div>
                              </td>
                              <td className="py-1.5 px-1">
                                <div className="flex gap-0.5 justify-center">
                                  <select value={editEH} onChange={e => setEditEH(Number(e.target.value))}
                                    className="w-10 px-0.5 py-1 text-[10px] bg-yellow-50 dark:bg-yellow-950/30 border border-amber-400 rounded text-slate-900 dark:text-slate-100">
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(hv => <option key={hv} value={hv}>{pad2(hv)}</option>)}
                                  </select>
                                  <select value={editEMin} onChange={e => setEditEMin(Number(e.target.value))}
                                    className="w-10 px-0.5 py-1 text-[10px] bg-yellow-50 dark:bg-yellow-950/30 border border-amber-400 rounded text-slate-900 dark:text-slate-100">
                                    {[0, 15, 30, 45].map(mv => <option key={mv} value={mv}>{pad2(mv)}</option>)}
                                  </select>
                                  <select value={editEAP} onChange={e => setEditEAP(e.target.value as 'AM' | 'PM')}
                                    className="w-10 px-0.5 py-1 text-[10px] bg-yellow-50 dark:bg-yellow-950/30 border border-amber-400 rounded text-slate-900 dark:text-slate-100">
                                    <option>AM</option><option>PM</option>
                                  </select>
                                </div>
                              </td>
                              <td className="py-1.5 px-2 text-center font-bold text-blue-700 dark:text-blue-300">{editHcAuto.toFixed(1)}</td>
                              <td className="py-1.5 px-2 text-center font-bold text-amber-600 dark:text-amber-300">{editOtAuto > 0 ? editOtAuto.toFixed(1) : '–'}</td>
                              {/* PC ĐÊM 30%/50% khi đang sửa trực tiếp — theo khung giờ cố định 22:00–05:00 / 05:00–06:00 (calcNightAllowance30/50) */}
                              <td className="py-1.5 px-2 text-center font-bold text-indigo-600 dark:text-indigo-300">{editIsNight && editNight30Auto > 0 ? editNight30Auto.toFixed(1) : '–'}</td>
                              <td className="py-1.5 px-2 text-center font-bold text-purple-600 dark:text-purple-300">{editIsNight && editNight50Auto > 0 ? editNight50Auto.toFixed(1) : '–'}</td>
                              <td className="py-1.5 px-2 text-center">
                                <div className="flex gap-1 justify-center">
                                  <button onClick={() => saveEditRow(rec)} title="Lưu"
                                    className="p-1 rounded bg-green-600 hover:bg-green-700 text-white transition-colors">
                                    <Save className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={cancelEditRow} title="Hủy"
                                    className="p-1 rounded bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 transition-colors">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </>
                          );
                        })()}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ TABLE MODE ══════════ */}
      {viewMode === 'table' && (
        <>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="py-1 px-3 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
            <h3 className="text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider leading-tight">
              Bảng nhập điểm danh &amp; Giờ làm việc chi tiết
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse text-left">
              <thead className="bg-[#122842] text-white uppercase text-[11px] font-bold">
                <tr>
                  <th className="py-1 px-2 border-r border-slate-700/60 sticky left-0 bg-[#122842] z-10 w-20">Mã NV</th>
                  <th className="py-1 px-2 border-r border-slate-700/60 sticky left-20 bg-[#122842] z-10 w-[180px] max-w-[180px]">Họ tên</th>
                  {[['HC (Công)',''],['OT 150%',''],['Đêm 30%',''],['Đêm 50%',''],['CN 200%',''],['Lễ 300%',''],['Nghỉ Lương',''],['Nghỉ Phép',''],['Nghỉ Không Lương',''],['Chuyên Cần','']].map(([h]) => (
                    <th key={h} className="py-1 px-2 border-r border-slate-700/60 text-center w-24">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/60">
                {filteredEmps.map(emp => {
                  const rec = attendanceRecords[`${emp.id}_${selectedYear}_${selectedMonth}`];
                  let tHc = 0, tOt = 0, tNightOt = 0, tN = 0, tSun = 0, tHol = 0, tLp = 0, tLa = 0, tLu = 0;
                  if (rec?.dailyRecords) (Object.values(rec.dailyRecords) as DailyAttendance[]).forEach(d => {
                    tHc += d.hcHours || 0;
                    // EPCC (night-allowance-live-recompute-summary-table) - FIX theo yêu cầu
                    // người dùng: đồng bộ với "Danh sách điểm danh gần đây" — cột "Đêm 30%"/
                    // "Đêm 50%" ở bảng này KHÔNG còn đọc thẳng d.nightHours/d.otHours đã lưu
                    // (có thể là dữ liệu cũ, tính theo công thức cũ) nữa, mà tính LẠI LIVE từ
                    // checkIn/checkOut thực tế bằng calcNightAllowance30/50 (khung 22:00–05:00
                    // / 05:00–06:00), giống hệt công thức dùng ở bảng "Danh sách điểm danh
                    // gần đây" — đảm bảo 2 bảng luôn khớp số nhau.
                    let dayOt = d.otHours || 0;
                    if ((d.nightHours || 0) > 0) {
                      const dIn  = parseTime24(d.checkIn  || '20:00');
                      const dOut = parseTime24(d.checkOut || '05:00');
                      const dStartDec = toDecHours(dIn.h, dIn.m, dIn.ampm);
                      const dEndDec   = toDecHours(dOut.h, dOut.m, dOut.ampm);
                      tN += calcNightAllowance30(dStartDec, dEndDec);
                      const pc50 = calcNightAllowance50(dStartDec, dEndDec);
                      tNightOt += pc50;
                      if (dayOt === pc50 || (d.checkIn && d.checkOut)) {
                        dayOt = calcOtHours(dStartDec, dEndDec);
                      }
                    }
                    tOt += dayOt;
                    tSun += d.sundayHours || 0; tHol += d.holidayHours || 0;
                    tLp += d.leavePaidDays || 0; tLa += d.leaveAnnualDays || 0;
                    // Nghỉ không lương: dùng để Bảng lương xét điều kiện phụ cấp chuyên cần
                    // (thường chỉ áp dụng khi không có ngày nghỉ không lương nào trong kỳ).
                    tLu += d.leaveUnpaidDays || 0;
                  });
                  // EPCC (attendance-summary-plain-numbers) — theo yêu cầu: bỏ các ô "hộp"
                  // (input có nền màu + viền bo góc) ở dải cột HC (Công) → Chuyên Cần trong
                  // bảng tổng hợp này, chỉ còn hiển thị CHỮ SỐ thuần (căn giữa, không nền/viền).
                  // Giá trị = 0 sẽ ẩn hẳn (chuỗi rỗng) thay vì hiện số 0, đúng yêu cầu "chỉ hiển
                  // thị số > 0". Lưu ý: bảng này KHÔNG còn sửa trực tiếp được nữa (trước đây
                  // mk()/mkHcCong() là input onChange ghi đè cả tháng) — muốn sửa dữ liệu, dùng
                  // "Ma trận ngày HC/OT theo nhân viên" ngay bên dưới (sửa theo từng ngày).
                  const fmt = (n: number) => {
                    if (!n) return '';
                    return Number.isInteger(n) ? String(n) : n.toFixed(1);
                  };
                  const cell = (val: number, cls: string) => (
                    <span className={`inline-block w-full text-center font-semibold ${cls}`}>{fmt(val)}</span>
                  );
                  const hcCong = Math.round((tHc / 8) * 2) / 2;
                  return (
                    <tr key={emp.id} className="hover:bg-blue-50/40 dark:hover:bg-slate-700/40">
                      <td className="py-0.5 px-2 font-semibold text-blue-900 dark:text-blue-300 sticky left-0 bg-white dark:bg-slate-800 z-10 border-r border-slate-200 dark:border-slate-700 align-middle leading-tight whitespace-nowrap">{emp.id}</td>
                      <td className="py-0.5 px-2 font-bold text-slate-900 dark:text-slate-100 sticky left-20 bg-white dark:bg-slate-800 z-10 border-r border-slate-200 dark:border-slate-700 align-middle leading-tight w-[180px] max-w-[180px] whitespace-nowrap overflow-hidden">{emp.fullName}</td>
                      <td className="py-0.5 px-2 text-center border-r border-slate-200 dark:border-slate-700">{cell(hcCong,'text-slate-800 dark:text-slate-200')}</td>
                      <td className="py-0.5 px-2 text-center border-r border-slate-200 dark:border-slate-700">{cell(tOt,'text-amber-900 dark:text-amber-200')}</td>
                      <td className="py-0.5 px-2 text-center border-r border-slate-200 dark:border-slate-700">{cell(tN,'text-indigo-900 dark:text-indigo-200')}</td>
                      <td className="py-0.5 px-2 text-center border-r border-slate-200 dark:border-slate-700">{cell(tNightOt,'text-violet-900 dark:text-violet-200')}</td>
                      <td className="py-0.5 px-2 text-center border-r border-slate-200 dark:border-slate-700">{cell(tSun,'text-red-900 dark:text-red-200')}</td>
                      <td className="py-0.5 px-2 text-center border-r border-slate-200 dark:border-slate-700">{cell(tHol,'text-purple-900 dark:text-purple-200')}</td>
                      <td className="py-0.5 px-2 text-center border-r border-slate-200 dark:border-slate-700">{cell(tLp,'text-slate-800 dark:text-slate-200')}</td>
                      <td className="py-0.5 px-2 text-center border-r border-slate-200 dark:border-slate-700">{cell(tLa,'text-slate-800 dark:text-slate-200')}</td>
                      <td className="py-0.5 px-2 text-center border-r border-slate-200 dark:border-slate-700">{cell(tLu,'text-rose-900 dark:text-rose-200')}</td>
                      {(() => {
                        // Lấy số phép bù còn lại từ Hồ sơ nhân viên (EmployeeProfilesTab →
                        // field Employee.compLeaveBalance) để xét điều kiện chuyên cần chính xác.
                        const cc = checkChuyenCanEligible(tLu, emp.compLeaveBalance || 0);
                        return (
                          <td className="py-0.5 px-2 text-center" title={cc.reason}>
                            <span className={`inline-block w-full text-center font-semibold text-[11px] ${
                              cc.eligible
                                ? 'text-emerald-700 dark:text-emerald-300'
                                : 'text-red-700 dark:text-red-300'
                            }`}>
                              {cc.eligible ? 'Đạt' : `Không đạt (${cc.suggestedUnauthorizedAbsenceDays})`}
                            </span>
                          </td>
                        );
                      })()}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Ma trận ngày HC/OT theo nhân viên ── */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mt-4">
          <div ref={matrixScrollRef} className="overflow-x-auto max-h-[70vh] overflow-y-auto scroll-smooth">
            <table className="border-collapse text-left text-xs w-max">
              <thead className="bg-[#122842] text-white uppercase text-[12px] font-bold sticky top-0 z-20">
                <tr>
                  <th rowSpan={2} className="py-2 px-2 border-r border-slate-700/60 sticky left-0 bg-[#122842] z-30 w-20 align-middle">Mã NV</th>
                  <th rowSpan={2} className="py-2 px-2 border-r border-slate-700/60 sticky left-20 bg-[#122842] z-30 w-[180px] max-w-[180px] align-middle">Họ Tên</th>
                  {/* Freeze pane boundary — đường kẻ phân cách rõ giữa vùng cố định và vùng cuộn */}
                  <th rowSpan={2} className="py-2 px-2 border-r-2 border-slate-500 sticky left-[260px] bg-[#1e3a5f] z-30 w-16 align-middle shadow-[4px_0_8px_-3px_rgba(0,0,0,0.45)]">Loại giờ</th>

                  <th colSpan={monthDays.length} className="py-1.5 text-center border-l border-slate-700/60 font-bold">
                    Tháng {selectedMonth}/{selectedYear}
                  </th>
                  <th rowSpan={2} className="py-2 px-2 text-center w-16 bg-amber-600 text-white sticky right-0 z-30 align-middle">Tổng</th>
                </tr>
                <tr className="bg-[#1a3552] text-slate-200 text-[12px] font-semibold">
                  {monthDays.map((d) => (
                    <th key={d.dateStr} className={`w-9 py-1 text-center border-l border-slate-700/40 font-normal ${d.isSunday ? 'text-red-300' : ''}`}>
                      {pad2(d.day)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300 dark:divide-slate-700 text-slate-800 dark:text-slate-200 font-medium">
                {filteredEmps.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400 text-xs">
                      Không tìm thấy nhân viên phù hợp.
                    </td>
                  </tr>
                ) : filteredEmps.map((emp) => {
                  let hcSum = 0;
                  let otSum = 0;
                  monthDays.forEach((d) => {
                    hcSum += getDayVal(emp.id, d.dateStr, 'hc');
                    otSum += getDayVal(emp.id, d.dateStr, 'ot');
                  });

                  return (
                    <React.Fragment key={emp.id}>
                      {/* HC Row */}
                      <tr className="hover:bg-blue-50/30 dark:hover:bg-slate-700/30">
                        <td rowSpan={2} className="py-1 px-2 font-semibold text-blue-900 dark:text-blue-300 sticky left-0 bg-white dark:bg-slate-800 z-10 border-r border-b border-slate-300 dark:border-slate-700 align-middle leading-tight">
                          {emp.id}
                        </td>
                        <td rowSpan={2} className="py-1 px-2 font-bold text-slate-900 dark:text-slate-100 sticky left-20 bg-white dark:bg-slate-800 z-10 border-r border-b border-slate-300 dark:border-slate-700 align-middle leading-tight w-[180px] max-w-[180px] whitespace-nowrap overflow-hidden">
                          {emp.fullName}
                        </td>
                        <td className="py-1 px-2 font-bold bg-blue-50/50 dark:bg-blue-950/30 sticky left-[260px] z-10 border-r-2 border-slate-300 dark:border-slate-600 text-center shadow-[4px_0_8px_-3px_rgba(0,0,0,0.15)] dark:shadow-[4px_0_8px_-3px_rgba(0,0,0,0.5)] whitespace-nowrap">
                          <span className="text-[10px] text-black dark:text-black">HC</span> <span className="text-[9.6px] font-normal text-black dark:text-black">(Công)</span>
                        </td>

                        {monthDays.map((d) => {
                          const val = getDayVal(emp.id, d.dateStr, 'hc');
                          const cong = val / 8; // Quy đổi HC sang đơn vị Công (8h = 1 công)
                          return (
                            <td key={d.dateStr} className={`py-1 px-1 text-center border-r border-slate-200 dark:border-slate-700 text-[11px] ${d.isSunday ? 'bg-red-50/40 dark:bg-red-950/10' : ''}`}>
                              {val > 0 ? cong.toFixed(1) : ''}
                            </td>
                          );
                        })}

                        <td rowSpan={2} className="py-1 px-2 text-center font-bold text-slate-900 dark:text-white bg-amber-100 dark:bg-amber-900/60 sticky right-0 z-10 align-middle">
                          <div className="text-blue-700 dark:text-blue-300">{(hcSum / 8).toFixed(1)}</div>
                          <div className="text-amber-700 dark:text-amber-300">{otSum.toFixed(1)}</div>
                        </td>
                      </tr>

                      {/* OT Row */}
                      <tr className="border-b-2 border-slate-400 dark:border-slate-700 hover:bg-amber-50/30 dark:hover:bg-slate-700/30">
                        <td className="py-1 px-2 font-bold text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/30 sticky left-[260px] z-10 border-r-2 border-slate-300 dark:border-slate-600 text-center shadow-[4px_0_8px_-3px_rgba(0,0,0,0.15)] dark:shadow-[4px_0_8px_-3px_rgba(0,0,0,0.5)]">
                          OT
                        </td>

                        {monthDays.map((d) => {
                          const val = getDayVal(emp.id, d.dateStr, 'ot');
                          return (
                            <td key={d.dateStr} className={`py-1 px-1 text-center border-r border-slate-200 dark:border-slate-700 text-[11px] ${d.isSunday ? 'bg-red-50/40 dark:bg-red-950/10' : ''}`}>
                              {val > 0 ? val.toFixed(1) : ''}
                            </td>
                          );
                        })}
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}
    </div>
  );
};