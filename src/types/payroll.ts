export type UserRole = 'Admin' | 'Leader' | 'User';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  employeeId?: string;
  department?: string;
}

export type Position = 'S. Manager' | 'Manager' | 'Senior Staff' | 'Staff' | 'OP' | 'Leader';

export interface Employee {
  id: string; // Mã NV (e.g. "11704029")
  fullName: string; // Họ tên
  birthDate: string; // YYYY-MM-DD
  department: string; // Phòng ban (e.g. "PPC")
  position: Position; // Vị trí
  startDate: string; // Ngày bắt đầu YYYY-MM-DD
  phone: string; // SĐT
  isFemale: boolean; // Nữ (check mark if true)
  baseSalary: number; // Lương CB (VNĐ) — ô D9
  dependentsCount: number; // Số người phụ thuộc — ô D7 (giữ lại field cũ để tương thích ngược)
  contractType?: 'Official' | 'Probation' | 'Seasonal'; // Loại hợp đồng
  email?: string;
  bankAccount?: string;
  bankName?: string;
  unionMember?: boolean; // Đoàn viên công đoàn
  // EPCC (setup-cai-dat-match-file) — bổ sung 2 field bị calculatePayslip() dùng nhưng
  // chưa từng khai báo trong type, khiến TypeScript không có chỗ hợp lệ để lưu:
  insuranceBaseSalary?: number; // Lương đóng BHXH/BHYT/BHTN nhập tay (ưu tiên tuyệt đối,
    // ghi đè công thức mặc định E57=D9+E61+E62+E63+E64+E65+E66). Để trống/0 = dùng công thức mặc định.
  numberOfDependents?: number; // Số người phụ thuộc dùng để tính giảm trừ gia cảnh (ô E74);
    // nếu cần khác `dependentsCount` (VD dependentsCount là số khai báo hồ sơ, numberOfDependents
    // là số đang được tính giảm trừ thuế thực tế) — dùng field riêng để không phá vỡ chỗ khác
    // đang dùng dependentsCount. Có thể set numberOfDependents = dependentsCount khi tạo NV.

  // Bổ sung theo yêu cầu người dùng (attendance-comp-leave-offsets-unpaid-leave): số ngày
  // "phép bù" (compensatory leave) CÒN LẠI của nhân viên, quản lý ở Hồ sơ nhân viên
  // (EmployeeProfilesTab). Dùng ở AttendanceTab.checkChuyenCanEligible() để xét xem những
  // ngày "Nghỉ không lương" (leaveUnpaidDays) trong tháng có được phép bù "phủ" hay không:
  //   - leaveUnpaidDays > 0 và compLeaveBalance không đủ bù → cảnh báo mất chuyên cần.
  //   - compLeaveBalance ≥ leaveUnpaidDays → vẫn coi là đạt chuyên cần.
  // LƯU Ý: đây là badge THAM KHẢO/cảnh báo sớm ở AttendanceTab, KHÔNG tự động ghi vào
  // EmployeeAttendanceRecord.manualUnauthorizedAbsenceDays — trường chính thức mà
  // calculatePayslip() dùng để cắt `diligenceBonus` (mục 20) hiện vẫn do
  // HR/kế toán nhập tay mỗi tháng ở Payslip, vì "nghỉ không phép" (unauthorized absence)
  // và "nghỉ không lương" (unpaid leave, có xin phép) là 2 khái niệm khác nhau trong file
  // lương gốc. Nếu muốn 2 luồng này tự đồng bộ, cần quyết định rõ nghiệp vụ trước khi nối.
  compLeaveBalance?: number; // Phép bù còn lại (ngày)
}

export type AttendanceType = 'HC' | 'OT150' | 'OTNight200' | 'OTSunday200' | 'OTHoliday300' | 'LeaveFull' | 'LeaveAnnual' | 'LeaveUnpaid' | 'LeaveSick';

export interface DailyAttendance {
  date: string; // YYYY-MM-DD
  hcHours: number; // Số giờ làm HC (mặc định 8h/ngày chuẩn)
  otHours: number; // Làm thêm ngày 150%
  nightHours: number; // Phụ cấp ca đêm 30%
  sundayHours: number; // Làm chủ nhật 200%
  holidayHours: number; // Tăng ca ngày lễ 300%
  leavePaidDays: number; // Nghỉ hưởng lương 100% (ngày)
  leaveAnnualDays: number; // Nghỉ phép năm (ngày)
  leaveUnpaidDays: number; // Nghỉ không lương (ngày)
  femaleSupportHours: number; // Trợ cấp phụ nữ 150%
  // EPCC (checkin-checkout-missing-from-type) - FIX ROOT CAUSE "phải dùng `as any` để lưu giờ vào/ra thật":
  // Trước đây chỉ lưu số giờ HC/OT đã tính, không lưu giờ vào/ra thực tế → bảng "Điểm danh gần đây"
  // và chế độ sửa trực tiếp không có nơi khai báo hợp lệ để lưu. Khai báo chính thức ở đây.
  checkIn?: string;  // Giờ vào thực tế, định dạng 24h "HH:mm"
  checkOut?: string; // Giờ ra thực tế, định dạng 24h "HH:mm"
  isManual?: boolean; // true nếu bản ghi được nhập tay hoặc tạo tự động và đã xác nhận, dùng để hiện trong "Điểm danh gần đây"
  note?: string;
}

export interface EmployeeAttendanceRecord {
  employeeId: string;
  month: number; // 1 - 12
  year: number; // e.g. 2026

  // EPCC (allowance-ratio-is-calendar-not-attendance) — ô D10 "Ngày công chuẩn phụ cấp của
  // THÁNG NÀY": số ngày công chuẩn THEO LỊCH của tháng đó (áp dụng chung toàn công ty theo
  // từng tháng, VD 25.625 hoặc 27), dùng làm tử số tính tỷ lệ phụ cấp cố định
  // (=ROUND(E6x/26×D10,...)). HR nhập mỗi tháng; nếu bỏ trống sẽ mặc định = standardWorkDaysPerMonth
  // (tức tỷ lệ 100%, đúng hành vi mặc định của file gốc khi không có biến động).
  monthStandardDays?: number;

  dailyRecords: Record<string, DailyAttendance>; // key is YYYY-MM-DD or DD

  // Manual overrides for Payslip — ghi đè giá trị tự tính, luôn ưu tiên tuyệt đối khi có giá trị
  manualFemaleSupportHours?: number; // Trợ cấp phụ nữ (giờ) — mục 7
  manualTransferredAnnualLeave?: number; // Phép tồn chuyển — mục 4 (chỉ hiển thị, không cộng thu nhập)
  manualPersonalTax?: number; // Thuế TNCN nhập tay — mục e; nếu trống dùng pitAutoCalculated
  manualInsuranceArrears?: number; // Truy thu BHYT — mục b phần "+ truy thu"
  manualBonusOther?: number; // Thưởng khác — mục 24
  manualNightOt50Hours?: number; // Tăng ca đêm ngày thường 50% (giờ) — mục 10
  manualNightOt60Hours?: number; // Tăng ca đêm thông ca 60% (giờ) — mục 11
  manualOt70Hours?: number; // Tăng ca 70% night (giờ) — mục 12
  manualHolidayNightOt90Hours?: number; // Tăng ca đêm ngày lễ 90% (giờ) — mục 14
  manualMinWageLeaveDays?: number; // Số ngày nghỉ hưởng lương tối thiểu — mục 5
  manualNumberOfDependents?: number; // Số người phụ thuộc dùng tính thuế kỳ này, ghi đè Employee.numberOfDependents
  manualDocumentFee?: number; // Hồ sơ/서류 — mục 23
  manualOtherAllowance?: number; // Bù khác — mục 27
  manualReferralBonus?: number; // Thưởng giới thiệu — mục 28
  manualOtherAddition?: number; // Cộng khác — mục 29
  manualOtherDeduction?: number; // Trừ khác — mục f
  // EPCC (unauthorized-absence-cuts-diligence-bonus) — bổ sung field bị calculatePayslip()
  // cần dùng nhưng chưa từng khai báo: đối chiếu ô A69/E69 "Số ngày nghỉ không phép (tháng
  // này)" của BangLuong_PPC_fixed_1.xlsx, công thức mục 20 "Thưởng chuyên cần" (D32) đã đổi
  // từ hằng số cố định sang có điều kiện: D32 = IF(E69>0, 0, E66) — tức nếu tháng này có
  // ngày nghỉ không phép (>0) thì Thưởng chuyên cần bị cắt hoàn toàn về 0, ngược lại vẫn
  // hưởng đủ E66 (không prorate theo số ngày). HR/kế toán nhập tay mỗi tháng; để trống/0 =
  // không có ngày nghỉ không phép, Thưởng chuyên cần tính bình thường (đúng hành vi mặc định
  // cũ khi chưa có field này).
  manualUnauthorizedAbsenceDays?: number; // Số ngày nghỉ không phép (tháng này) — ô E69
}

export interface PositionAllowanceConfig {
  position: Position;
  responsibilityAllowance: number; // PC trách nhiệm — tham số E63, quy đổi qua D28
  cleanRoomAllowance: number; // PC phòng sạch — tham số E65, quy đổi qua D29
  developmentAllowance: number; // Phụ cấp phát triển — mục 18 (D30). ⚠️ File gốc hard-code D30=0,
    // KHÔNG có ô tham số E-nào cho khoản này — nếu set > 0 ở đây, kết quả sẽ lệch khỏi file gốc.
  seniorityAllowance: number; // PC thâm niên — tham số E66, quy đổi qua D37
  skillAllowance: number; // PC kỹ năng — tham số E64, quy đổi qua D31
  languageSupport: number; // Hỗ trợ tiếng — tham số E61, quy đổi qua D38
  diligenceBonus: number; // Thưởng chuyên cần — tham số E67, quy đổi thẳng qua D32 (KHÔNG prorate)
  transportSupport: number; // Hỗ trợ giao thông — tham số E59, quy đổi qua D33
  housingSupport: number; // Hỗ trợ nhà ở — tham số E60, quy đổi qua D34
  // EPCC (split-position-title-vs-development-allowance) — mục 15 "Chức vụ" (D27) là khoản
  // TÁCH BIỆT với mục 18 "Phụ cấp phát triển" (developmentAllowance ở trên). File gốc dùng ô
  // tham số E62 (quy đổi qua D27); ở NVD/Vân hiện đang để trống = 0.
  positionTitleAllowance?: number; // Chức vụ — tham số E62, quy đổi qua D27
}

export interface SalaryConfig {
  standardWorkDaysPerMonth: number; // Ngày công chuẩn/tháng CỐ ĐỊNH — ô E55 (26 ngày, dùng cho
    // E56/E58 và làm mẫu số của allowanceRatio; KHÔNG phải D10 biến đổi theo tháng)
  standardHoursPerDay: number; // e.g. 8 giờ

  // Coefficients — khớp trực tiếp các hệ số nhân trong cột D18-D26
  otRate: number; // 1.5 — OT150% (D20)
  nightShiftRate: number; // 0.3 — PC ca đêm (D18)
  sundayRate: number; // 2.0 — Làm thêm giờ 200% (D21)
  holidayRate: number; // 3.0 — Tăng ca ngày lễ 300% (D25)
  femaleSupportRate: number; // 1.5 — Trợ cấp phụ nữ (D19)
  nightOt50Rate?: number; // 0.5 — Tăng ca đêm ngày thường (D22)
  nightOt60Rate?: number; // 0.6 — Tăng ca đêm thông ca (D23)
  ot70Rate?: number; // 0.7 — Tăng ca 70% night (D24)
  holidayNightOt90Rate?: number; // 0.9 — Tăng ca đêm ngày lễ (D26)

  // Deductions
  bhxhRate: number; // 0.08 (8%) — D45
  bhytRate: number; // 0.015 (1.5%) — D46
  bhtnRate: number; // 0.01 (1.0%) — D47
  unionFeeFlat: number; // 31,500 đ — D48

  // Thuế TNCN — khớp ô E73/E74 (mức Luật TNCN 2025, hiệu lực từ kỳ lương 01/7/2026)
  personalDeductionAmount?: number; // Giảm trừ bản thân — E73 (mặc định 15.500.000)
  dependentDeductionAmount?: number; // Giảm trừ mỗi người phụ thuộc — hệ số trong E74 (mặc định 6.200.000)

  // EPCC (housing-language-not-pit-exempt-per-master-formula) — 2 cờ tùy chọn để kế toán tự
  // bật miễn thuế cho nhà ở/tiếng Hàn NẾU xác nhận công ty có áp dụng khác thực tế. Mặc định
  // false để khớp đúng công thức chính thức E76 = MAX(0,D42-E75-E73-E74) (không trừ E72).
  pitExemptHousingSupport?: boolean;
  pitExemptLanguageSupport?: boolean;

  // Position specific allowances
  positionAllowances: Record<Position, PositionAllowanceConfig>;
}

export interface CalculatedPayslip {
  employee: Employee;
  month: number;
  year: number;
  hasAllowanceConfig: boolean;

  // Header info
  baseSalary: number; // Lương CB — D9
  insuranceBaseSalary: number; // Lương đóng BHXH/BHYT/BHTN — E57

  // A. Các khoản thu nhập
  hcDays: number; // 1. Số ngày làm HC
  hcAmount: number;
  leavePaidDays: number; // 2. Nghỉ hưởng lương 100%
  leavePaidAmount: number;
  leaveAnnualDays: number; // 3. Nghỉ phép năm
  leaveAnnualAmount: number;
  minWageLeaveDays: number; // 5. Số ngày nghỉ hưởng lương tối thiểu
  minWageLeaveAmount: number;
  transferredAnnualLeaveDays: number; // 4. Phép tồn chuyển (chỉ hiển thị, không cộng thu nhập)
  transferredAnnualLeaveAmount: number;
  nightShiftHours: number; // 6. PC ca đêm 30%
  nightShiftAmount: number;
  femaleSupportHours: number; // 7. Trợ cấp phụ nữ 150%
  femaleSupportAmount: number;
  ot150Hours: number; // 8. Làm thêm ngày 150%
  ot150Amount: number;
  sunday200Hours: number; // 9. Làm thêm giờ 200%
  sunday200Amount: number;
  nightOt50Hours: number; // 10. Tăng ca đêm ngày thường 50%
  nightOt50Amount: number;
  nightOt60Hours: number; // 11. Tăng ca đêm thông ca 60%
  nightOt60Amount: number;
  ot70Hours: number; // 12. Tăng ca 70% night
  ot70Amount: number;
  holiday300Hours: number; // 13. Tăng ca ngày lễ 300%
  holiday300Amount: number;
  holidayNightOt90Hours: number; // 14. Tăng ca đêm ngày lễ 90%
  holidayNightOt90Amount: number;

  positionTitleAllowance: number; // 15. Chức vụ
  responsibilityAllowance: number; // 16. PC trách nhiệm
  cleanRoomAllowance: number; // 17. PC phòng sạch
  developmentAllowance: number; // 18. Phụ cấp phát triển
  skillAllowance: number; // 19. Phụ cấp kỹ năng
  diligenceBonus: number; // 20. Thưởng chuyên cần
  // EPCC (unauthorized-absence-cuts-diligence-bonus) — 2 field audit/hiển thị, không dùng để
  // tính toán thêm ở nơi khác: unauthorizedAbsenceDays là số đang được áp dụng (đã ưu tiên
  // manualUnauthorizedAbsenceDays), diligenceBonusCut = true nếu do số này > 0 nên
  // diligenceBonus phía trên đã bị cắt về 0 — dùng để hiển thị dòng ghi chú trên PayslipTab.
  unauthorizedAbsenceDays: number;
  diligenceBonusCut: boolean;
  transportSupport: number; // 21. Hỗ trợ giao thông
  housingSupport: number; // 22. Hỗ trợ nhà ở
  documentFee: number; // 23. Hồ sơ
  otherBonus: number; // 24. Thưởng khác
  seniorityAllowance: number; // 25. PC thâm niên
  languageSupport: number; // 26. Phụ cấp tiếng
  otherAllowance: number; // 27. Bù khác
  referralBonus: number; // 28. Thưởng giới thiệu
  otherAddition: number; // 29. Cộng khác

  totalIncome: number; // Tổng thu nhập — D42

  // B. Các khoản khấu trừ
  bhxhDeduction: number; // a. BHXH (8%)
  bhytDeduction: number; // b. BHYT (1,5%)
  bhtnDeduction: number; // c. BHTN (1%)
  unionFeeDeduction: number; // d. Đoàn phí CĐ (31.500)
  personalTaxDeduction: number; // e. Thuế TNCN
  insuranceArrearsDeduction: number; // Truy thu BHYT
  otherDeduction: number; // f. Trừ khác

  // Thông tin tính thuế (tham khảo/audit) — khớp vùng "TÍNH THUẾ TNCN" ô E71-E77
  pitAutoCalculated: number; // Thuế TNCN tự tính theo biểu lũy tiến 5 bậc — E77
  pitTaxableIncome: number; // Thu nhập tính thuế (TNTT) — E76. Công thức = MAX(0, totalIncome
    // − BHXH/BHYT/BHTN − giảm trừ bản thân − giảm trừ phụ thuộc), KHÔNG trừ pitExemptAmount
    // (khớp đúng file gốc, xem ghi chú EPCC pit-exempt-is-memo-only-not-subtracted).
  pitExemptAmount?: number; // Số miễn thuế OT/ca đêm theo NĐ145 — E71 = SUM(E18:E26). CHỈ mang
    // tính THAM KHẢO/hiển thị (giống vai trò của E71 trong file gốc) — KHÔNG được trừ vào
    // pitTaxableIncome ở trên.
  pitExemptHousingSupport: boolean;
  pitExemptLanguageSupport: boolean;

  numberOfDependents?: number; // Số người phụ thuộc dùng tính thuế kỳ này
  personalDeductionAmount?: number; // Mức giảm trừ bản thân (15.500.000)
  dependentDeductionAmount?: number; // Mức giảm trừ mỗi người phụ thuộc (6.200.000)
  totalPersonalDeduction?: number; // Tổng giảm trừ gia cảnh = bản thân + NPT * 6.2tr

  attendanceRatio: number; // Hệ số phụ cấp theo ngày công chuẩn của THÁNG (monthStandardDays)
    // so với standardWorkDaysPerMonth cố định — tương ứng tỷ lệ D10/E55 dùng trong D27-D38.

  totalDeduction: number; // TỔNG KHẤU TRỪ — D51

  netSalary: number; // THỰC LĨNH — D52
}

// EPCC (payroll-view-permission-matrix) — phân quyền XEM Bảng lương theo cấp bậc: chỉ
// Admin được cấu hình vị trí nào xem được bảng lương của vị trí nào. Vị trí của người
// đang xem được suy ra từ hồ sơ nhân viên gắn với currentUser (User.employeeId), KHÔNG
// dùng role thô Admin/Leader/User để quyết định trực tiếp — đúng theo yêu cầu "dựa theo
// hồ sơ nhân viên".
export const POSITION_HIERARCHY: Position[] = [
  'S. Manager', 'Manager', 'Senior Staff', 'Leader', 'Staff', 'OP',
];

// key: vị trí người XEM | value: danh sách vị trí họ được phép xem bảng lương
export type PayrollViewPermissions = Record<Position, Position[]>;

// EPCC (payroll-view-permission-default-self-only) — theo yêu cầu: đổi mặc định từ "mỗi vị
// trí thấy chính mình + các vị trí thấp hơn" (kiểu phân cấp) sang "mỗi vị trí CHỈ thấy chính
// mình", riêng S. Manager mặc định thấy được cả 6 vị trí. Đây chỉ là GIÁ TRỊ MẶC ĐỊNH dùng
// lần đầu (chưa có localStorage/Supabase) — sau đó chỉ thay đổi khi Admin tick thêm ô trong
// ma trận ở SettingsTab và bấm "Lưu tất cả cấu hình" (updatePayrollViewPermissions), không tự
// đổi theo logic nào khác.
export function buildDefaultPayrollViewPermissions(): PayrollViewPermissions {
  const result = {} as PayrollViewPermissions;
  POSITION_HIERARCHY.forEach((viewerPos) => {
    result[viewerPos] = viewerPos === 'S. Manager' ? [...POSITION_HIERARCHY] : [viewerPos];
  });
  return result;
}
