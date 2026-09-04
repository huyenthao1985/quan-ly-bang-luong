import { CalculatedPayslip, Employee, EmployeeAttendanceRecord, SalaryConfig } from '../types/payroll';

// Biểu thuế TNCN lũy tiến từng phần 5 bậc theo Luật Thuế TNCN 2025/2026 (hiệu lực kỳ lương từ 01/7/2026):
// - Bậc 1: ≤ 10 triệu đồng/tháng: 5% (trừ nhanh: 0)
// - Bậc 2: > 10 - 30 triệu đồng/tháng: 10% (trừ nhanh: 0.5 triệu)
// - Bậc 3: > 30 - 60 triệu đồng/tháng: 20% (trừ nhanh: 3.5 triệu)
// - Bậc 4: > 60 - 100 triệu đồng/tháng: 30% (trừ nhanh: 9.5 triệu)
// - Bậc 5: > 100 triệu đồng/tháng: 35% (trừ nhanh: 14.5 triệu)
const PIT_BRACKETS: { upTo: number; rate: number }[] = [
  { upTo: 10_000_000, rate: 0.05 },
  { upTo: 30_000_000, rate: 0.10 },
  { upTo: 60_000_000, rate: 0.20 },
  { upTo: 100_000_000, rate: 0.30 },
  { upTo: Infinity, rate: 0.35 },
];

/**
 * Tính thuế TNCN lũy tiến từng phần (biểu 5 bậc, Luật TNCN 2026) trên thu nhập tính thuế
 * (đã trừ BHXH/BHYT/BHTN, giảm trừ bản thân 15.5tr, giảm trừ NPT 6.2tr/người).
 * Tự động tính toán và khấu trừ vào Bảng lương; nếu HR nhập tay thì ưu tiên số nhập tay.
 */
export function calculateProgressivePIT(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  let tax = 0;
  let lowerBound = 0;
  for (const bracket of PIT_BRACKETS) {
    if (taxableIncome <= lowerBound) break;
    const amountInBracket = Math.min(taxableIncome, bracket.upTo) - lowerBound;
    tax += amountInBracket * bracket.rate;
    lowerBound = bracket.upTo;
  }
  return Math.round(tax);
}

export function calculatePayslip(
  employee: Employee,
  attendanceRecord: EmployeeAttendanceRecord | undefined,
  config: SalaryConfig
): CalculatedPayslip {
  const baseSalary = employee.baseSalary || 0;

  const positionConfig = config.positionAllowances[employee.position];
  const hasAllowanceConfig = !!positionConfig;

  // EPCC (insurance-base-default-includes-allowances) — FIX ROOT CAUSE "lương đóng BH mặc
  // định thiếu phụ cấp": đối chiếu ô E57 của BangLuong_PPC.xlsx —
  //   Lương đóng BHXH/BHYT/BHTN = Lương CB + Phụ cấp tiếng + Chức vụ + Trách nhiệm +
  //                                Kỹ năng + Phòng sạch + Thâm niên
  // (KHÔNG gồm hỗ trợ giao thông/nhà ở/chuyên cần — 3 khoản này bị loại khỏi lương đóng BH
  // theo đúng công thức gốc). Trước đây insuranceBaseSalary mặc định = thẳng baseSalary khi
  // HR chưa nhập tay, bỏ sót toàn bộ phần phụ cấp cộng thêm này → lương đóng BH bị tính
  // thấp hơn thực tế, kéo theo đơn giá giờ OT (hourlyRate) và các khoản BHXH/BHYT/BHTN đều
  // sai. Field insuranceBaseSalary trên Employee vẫn LUÔN được ưu tiên tuyệt đối nếu HR đã
  // nhập tay (ô "Lương cơ bản mới" trên PayslipTab) — công thức dưới đây chỉ là giá trị mặc
  // định khi ô đó còn trống/0.
  const computedInsuranceBase =
    baseSalary +
    (hasAllowanceConfig ? (positionConfig as any).positionTitleAllowance || 0 : 0) +
    (hasAllowanceConfig ? positionConfig.responsibilityAllowance || 0 : 0) +
    (hasAllowanceConfig ? positionConfig.skillAllowance || 0 : 0) +
    (hasAllowanceConfig ? positionConfig.cleanRoomAllowance || 0 : 0) +
    (hasAllowanceConfig ? positionConfig.seniorityAllowance || 0 : 0) +
    (hasAllowanceConfig ? positionConfig.languageSupport || 0 : 0);
  const insuranceBaseSalary = employee.insuranceBaseSalary || computedInsuranceBase;

  const standardDays = config.standardWorkDaysPerMonth || 26;
  const standardHoursPerDay = config.standardHoursPerDay || 8;
  const totalStandardHours = standardDays * standardHoursPerDay;

  const dailyRate = standardDays > 0 ? baseSalary / standardDays : 0;
  // ✅ ĐÃ ĐỐI CHIẾU với BangLuong_PPC.xlsx (ô E58): Đơn giá giờ làm thêm = Lương đóng
  // BHXH/BHYT/BHTN / (Ngày công chuẩn cố định × 8 giờ) — công thức này khớp CHÍNH XÁC với
  // insuranceBaseSalary/totalStandardHours đang dùng bên dưới (26 × 8 = 208 giờ theo đúng
  // tham số "Ngày công chuẩn/tháng" cố định ở ô E55, KHÔNG phải ngày công chuẩn phụ cấp
  // biến đổi theo từng tháng ở ô D10 — hai khái niệm này khác nhau trong file gốc, xem ghi
  // chú ở EPCC (fixed-vs-monthly-standard-days) phía dưới). Ghi chú nghi vấn cũ về lệch 33%
  // được gỡ bỏ vì đã xác nhận công thức đúng bằng file lương gốc của công ty.
  const hourlyRate = totalStandardHours > 0 ? insuranceBaseSalary / totalStandardHours : 0;

  // Aggregate attendance data if present
  let hcTotalHours = 0;
  let ot150Hours = 0;
  let nightShiftHours = 0;
  let sunday200Hours = 0;
  let holiday300Hours = 0;
  let leavePaidDays = 0;
  let leaveAnnualDays = 0;
  let femaleSupportHours = 0;

  const nightOt50Hours = attendanceRecord?.manualNightOt50Hours ?? 0;
  const nightOt60Hours = attendanceRecord?.manualNightOt60Hours ?? 0;
  const ot70Hours = attendanceRecord?.manualOt70Hours ?? 0;
  const holidayNightOt90Hours = attendanceRecord?.manualHolidayNightOt90Hours ?? 0;
  const minWageLeaveDays = attendanceRecord?.manualMinWageLeaveDays ?? 0;

  if (attendanceRecord && attendanceRecord.dailyRecords) {
    let sumDailyFemale = 0;
    Object.values(attendanceRecord.dailyRecords).forEach((day) => {
      // EPCC (sunday-work-200-percent-no-hc-day) — FIX ROOT CAUSE: Đi làm vào ngày Chủ Nhật
      // được tính TOÀN BỘ là 200% (CN 200%), KHÔNG tính ngày công HC như bình thường.
      const parts = day.date?.split('-').map(Number);
      const isSunday = parts && parts.length === 3 && new Date(parts[0], parts[1] - 1, parts[2]).getDay() === 0;

      let dayHc = day.hcHours || 0;
      let dayOt = day.otHours || 0;
      let daySunday = day.sundayHours || 0;

      if (isSunday) {
        // Chủ nhật: toàn bộ giờ làm thực tế (HC + OT + Sunday) đều hưởng 200%
        const totalSundayWorkHours = (daySunday > 0 ? daySunday : 0) + (dayHc > 0 ? dayHc : 0) + (dayOt > 0 ? dayOt : 0);
        daySunday = totalSundayWorkHours;
        dayHc = 0;
        dayOt = 0;
      } else {
        if ((day.nightHours || 0) > 0 && day.checkIn && day.checkOut) {
          const [hhIn, mmIn] = day.checkIn.split(':').map(Number);
          const [hhOut, mmOut] = day.checkOut.split(':').map(Number);
          const sDec = (hhIn || 0) + (mmIn || 0) / 60;
          const eDec = (hhOut || 0) + (mmOut || 0) / 60;
          const eAdjusted = eDec <= sDec ? eDec + 24 : eDec;
          const pc50 = Math.round(Math.max(0, Math.min(eAdjusted, 30) - Math.max(sDec, 29)) * 2) / 2;
          if (dayOt === pc50 && eDec > 5.0 && eDec <= sDec) {
            dayOt = Math.round((eDec - 5.0) * 2) / 2;
          }
        }
      }

      hcTotalHours += dayHc;
      ot150Hours += dayOt;
      nightShiftHours += day.nightHours || 0;
      sunday200Hours += daySunday;
      holiday300Hours += day.holidayHours || 0;
      leavePaidDays += day.leavePaidDays || 0;
      leaveAnnualDays += day.leaveAnnualDays || 0;
      sumDailyFemale += day.femaleSupportHours || 0;
    });
    if (employee.isFemale) {
      femaleSupportHours = attendanceRecord.manualFemaleSupportHours ?? (sumDailyFemale > 0 ? sumDailyFemale : 1.5);
    }
  } else if (employee.isFemale) {
    femaleSupportHours = attendanceRecord?.manualFemaleSupportHours ?? 1.5;
  }

  // Days worked HC
  const hcDays = hcTotalHours / standardHoursPerDay;
  const hcAmount = Math.round(hcDays * dailyRate);

  const leavePaidAmount = Math.round(leavePaidDays * dailyRate);
  const leaveAnnualAmount = Math.round(leaveAnnualDays * dailyRate);
  const minWageLeaveAmount = Math.round(minWageLeaveDays * dailyRate);

  // EPCC (transferred-leave-not-income) — FIX ROOT CAUSE "phép tồn chuyển tháng sau bị
  // tính nhầm thành thu nhập kỳ này": đối chiếu phiếu gốc mục 4 "Phép tồn chuyển tháng
  // sau: 11.5" — cột Số tiền BỎ TRỐNG, không như 21 dòng còn lại đều có số tiền. Đây là
  // SỐ NGÀY PHÉP CÒN LẠI sẽ chuyển sang tháng sau để dùng, không phải khoản được trả kỳ
  // này. Giữ transferredAnnualLeaveDays để hiển thị thông tin, nhưng KHÔNG cộng vào
  // totalIncome nữa. Amount chỉ còn để tương thích ngược UI cũ (luôn = 0 giờ).
  const transferredAnnualLeaveDays = attendanceRecord?.manualTransferredAnnualLeave || 0;
  const transferredAnnualLeaveAmount = 0;

  const nightShiftAmount = Math.round(nightShiftHours * hourlyRate * config.nightShiftRate);
  const femaleSupportAmount = Math.round(femaleSupportHours * hourlyRate * config.femaleSupportRate);
  const ot150Amount = Math.round(ot150Hours * hourlyRate * config.otRate);
  const sunday200Amount = Math.round(sunday200Hours * hourlyRate * config.sundayRate);
  const holiday300Amount = Math.round(holiday300Hours * hourlyRate * config.holidayRate);
  const nightOt50Amount = Math.round(nightOt50Hours * hourlyRate * (config.nightOt50Rate ?? 0.5));
  const nightOt60Amount = Math.round(nightOt60Hours * hourlyRate * (config.nightOt60Rate ?? 0.6));
  const ot70Amount = Math.round(ot70Hours * hourlyRate * (config.ot70Rate ?? 0.7));
  const holidayNightOt90Amount = Math.round(holidayNightOt90Hours * hourlyRate * (config.holidayNightOt90Rate ?? 0.9));

  // EPCC (allowance-ratio-is-calendar-not-attendance) — FIX ROOT CAUSE "prorate phụ cấp cố
  // định sai cơ sở": đối chiếu trực tiếp công thức D27/D28/D29/D31/D33/D34/D37/D38 của
  // BangLuong_PPC.xlsx, VD ô D27 = ROUND(E62/26*D10,0) — nghĩa là:
  //   phụ cấp = giá trị cấu hình (config) × (Ngày công chuẩn phụ cấp CỦA THÁNG NÀY / 26)
  // "Ngày công chuẩn phụ cấp CỦA THÁNG NÀY" (D10) là SỐ NGÀY CÔNG CHUẨN THEO LỊCH của
  // tháng đó (áp dụng chung toàn công ty, VD 25,625 hoặc 27 ngày tuỳ tháng) — KHÔNG phải số
  // ngày nhân viên đó thực đi làm/được trả lương. Hệ số này KHÔNG bị trần ở 1.0 (27/26 ≈
  // 103,8% vẫn hợp lệ trong file gốc). Bản sửa TRƯỚC ĐÂY (attendanceRatio = số ngày được trả
  // lương/standardDays, trần tại 1.0) đã nhầm 2 khái niệm này — vô tình CẮT GIẢM phụ cấp
  // của nhân viên nghỉ phép, trong khi file gốc công ty không hề làm vậy (phụ cấp cố định
  // chỉ biến động theo lịch tháng, không theo chấm công cá nhân).
  // ⚠️ CẦN BỔ SUNG: thêm field `monthStandardDays` (số ngày công chuẩn phụ cấp của tháng,
  // HR nhập mỗi tháng — tương ứng ô D10) vào kiểu EmployeeAttendanceRecord/SalaryConfig
  // trong types/payroll.ts (file này không có sẵn nên chưa tự ý sửa type). Trước khi field
  // đó tồn tại, allowanceRatio tạm mặc định = 1 (= standardDays/standardDays), tức trả ĐỦ
  // 100% phụ cấp theo config — đúng hành vi mặc định của file gốc khi không có biến động
  // theo lịch tháng, và AN TOÀN hơn việc tự ý cắt giảm theo chấm công như bản cũ.
  const monthStandardDays = (attendanceRecord as any)?.monthStandardDays ?? standardDays;
  const allowanceRatio = standardDays > 0 ? monthStandardDays / standardDays : 1;

  // Allowances (10..19) — nhân theo allowanceRatio (hệ số ngày công chuẩn theo lịch tháng),
  // KHÔNG phải attendanceRatio cá nhân — xem ghi chú EPCC (allowance-ratio-is-calendar-not-attendance) ở trên.
  const responsibilityAllowance = hasAllowanceConfig
    ? Math.round(positionConfig.responsibilityAllowance * allowanceRatio)
    : 0;
  const cleanRoomAllowance = hasAllowanceConfig
    ? Math.round(positionConfig.cleanRoomAllowance * allowanceRatio)
    : 0;
  // EPCC (split-position-title-vs-development-allowance) — FIX ROOT CAUSE "thiếu dòng
  // Chức vụ (mục 15)": trước đây developmentAllowance dùng chung cho cả mục 15 "Chức vụ"
  // và mục 18 "Phụ cấp phát triển" trên phiếu gốc, nhưng đây là 2 khoản tách biệt (ví dụ
  // đối chiếu: Chức vụ = 3.115.385, Phụ cấp phát triển = để trống/0). Cần thêm field
  // `positionTitleAllowance` vào PositionAllowanceConfig trong types/payroll.ts.
  const positionTitleAllowance = hasAllowanceConfig
    ? Math.round(((positionConfig as any).positionTitleAllowance || 0) * allowanceRatio)
    : 0;
  const developmentAllowance = hasAllowanceConfig
    ? Math.round(positionConfig.developmentAllowance * allowanceRatio)
    : 0;
  const seniorityAllowance = hasAllowanceConfig
    ? Math.round((positionConfig.seniorityAllowance || 0) * allowanceRatio)
    : 0;
  const skillAllowance = hasAllowanceConfig
    ? Math.round((positionConfig.skillAllowance || 0) * allowanceRatio)
    : 0;
  const languageSupport = hasAllowanceConfig
    ? Math.round((positionConfig.languageSupport || 0) * allowanceRatio)
    : 0;
  // EPCC (unauthorized-absence-cuts-diligence-bonus) — FIX ROOT CAUSE "Thưởng chuyên cần
  // luôn tính đủ dù nhân viên có nghỉ không phép": đối chiếu ô D32 của
  // BangLuong_PPC_fixed_1.xlsx — công thức đã đổi từ hằng số cố định (bản file gốc cũ)
  // sang có điều kiện: D32 = IF($E$69>0, 0, E66). E69 = "Số ngày nghỉ không phép (tháng
  // này)": nếu > 0 thì Thưởng chuyên cần bị cắt hoàn toàn về 0 (không phải trừ theo tỷ lệ),
  // ngược lại vẫn hưởng đủ, giống hệt hành vi "không prorate" trước đây khi E69=0.
  const unauthorizedAbsenceDays = attendanceRecord?.manualUnauthorizedAbsenceDays ?? 0;
  const diligenceBonusCut = unauthorizedAbsenceDays > 0;
  const diligenceBonus = hasAllowanceConfig && !diligenceBonusCut ? positionConfig.diligenceBonus : 0; // không prorate, khớp D32 = IF(E69>0,0,E66)
  const transportSupport = hasAllowanceConfig
    ? Math.round(positionConfig.transportSupport * allowanceRatio)
    : 0;
  const housingSupport = hasAllowanceConfig
    ? Math.round(positionConfig.housingSupport * allowanceRatio)
    : 0;
  const otherBonus = attendanceRecord?.manualBonusOther || 0;

  const documentFee = attendanceRecord?.manualDocumentFee || 0;
  const otherAllowance = attendanceRecord?.manualOtherAllowance || 0;
  const referralBonus = attendanceRecord?.manualReferralBonus || 0;
  const otherAddition = attendanceRecord?.manualOtherAddition || 0;

  const totalIncome =
    hcAmount +
    leavePaidAmount +
    leaveAnnualAmount +
    minWageLeaveAmount +
    transferredAnnualLeaveAmount + // luôn 0, xem ghi chú EPCC transferred-leave-not-income
    nightShiftAmount +
    femaleSupportAmount +
    ot150Amount +
    sunday200Amount +
    nightOt50Amount +
    nightOt60Amount +
    ot70Amount +
    holiday300Amount +
    holidayNightOt90Amount +
    positionTitleAllowance +
    responsibilityAllowance +
    cleanRoomAllowance +
    developmentAllowance +
    seniorityAllowance +
    skillAllowance +
    languageSupport +
    diligenceBonus +
    transportSupport +
    housingSupport +
    documentFee +
    otherAllowance +
    otherBonus +
    referralBonus +
    otherAddition;

  // Deductions (B. Các khoản khấu trừ)
  const bhxhDeduction = insuranceBaseSalary > 0 ? Math.round(insuranceBaseSalary * config.bhxhRate) : 0;
  const bhytDeduction = insuranceBaseSalary > 0 ? Math.round(insuranceBaseSalary * config.bhytRate) : 0;
  const bhtnDeduction = insuranceBaseSalary > 0 ? Math.round(insuranceBaseSalary * config.bhtnRate) : 0;

  const unionFeeDeduction = employee.unionMember !== false ? config.unionFeeFlat : 0;

  // EPCC (auto-progressive-pit) — FIX ROOT CAUSE "Thuế TNCN mặc định = 0 khi chưa nhập
  // tay": trước đây `manualPersonalTax ?? 0` khiến ô Thuế TNCN luôn về 0 nếu HR chưa nhập.
  // Nay tự tính TNCN lũy tiến làm giá trị GỢI Ý; nếu HR đã nhập tay (manualPersonalTax có
  // giá trị, kể cả 0) thì số nhập tay LUÔN được ưu tiên tuyệt đối — đúng như yêu cầu
  // "có nhập tay thì dùng, không thì tự tính thay vì mặc định 0".
  // 1. Miễn thuế TNCN làm thêm giờ / ca đêm theo Nghị định 145/2020 (khoản 1.i Điều 3 TT 111/2013/TT-BTC)
  const ot150ExemptPortion = Math.round(ot150Hours * hourlyRate * 0.5);
  const sunday200ExemptPortion = Math.round(sunday200Hours * hourlyRate * 1.0);
  const holiday300ExemptPortion = Math.round(holiday300Hours * hourlyRate * 2.0);

  const otNd145Exempt =
    ot150ExemptPortion +
    sunday200ExemptPortion +
    holiday300ExemptPortion +
    nightShiftAmount +
    nightOt50Amount +
    nightOt60Amount +
    ot70Amount +
    holidayNightOt90Amount;

  // 2. Thu nhập miễn thuế khác (Nhà ở + Phụ cấp tiếng nếu được tích chọn trong Cài đặt)
  const pitExemptHousingSupport = config.pitExemptHousingSupport === true;
  const pitExemptLanguageSupport = config.pitExemptLanguageSupport === true;
  const housingExemptPortion = pitExemptHousingSupport ? housingSupport : 0;
  const languageExemptPortion = pitExemptLanguageSupport ? languageSupport : 0;
  const otherPitExempt = housingExemptPortion + languageExemptPortion;

  // Tổng thu nhập được miễn thuế (NĐ145 + Nhà ở + Tiếng)
  const pitExemptAmount = otNd145Exempt + otherPitExempt;

  // 3. Giảm trừ gia cảnh (Luật TNCN 2025/2026: bản thân 15.5tr, NPT 6.2tr/người)
  const personalDeductionAmount = config.personalDeductionAmount ?? 15_500_000;
  const dependentDeductionAmount = config.dependentDeductionAmount ?? 6_200_000;
  const numberOfDependents = attendanceRecord?.manualNumberOfDependents ?? employee.numberOfDependents ?? employee.dependentsCount ?? 0;
  const totalPersonalDeduction = personalDeductionAmount + numberOfDependents * dependentDeductionAmount;

  // 4. Bảo hiểm bắt buộc đã đóng (BHXH + BHYT + BHTN)
  const insuranceDeductionForPit = bhxhDeduction + bhytDeduction + bhtnDeduction;

  // 5. Thu nhập tính thuế (TNTT) theo công thức chuẩn PPC (ô E76 = MAX(0, D42 - E75 - E73 - E74))
  // Khớp chính xác tuyệt đối với phiếu lương thực tế: TNTT = 50.145.645 - 3.096.135 - 15.500.000 - 24.800.000 = 6.749.510 đ
  // Phần miễn thuế OT NĐ145 (ô E71) là số tham khảo memo, không trừ vào TNTT.
  const pitTaxableIncome = Math.max(0, totalIncome - otherPitExempt - insuranceDeductionForPit - totalPersonalDeduction);

  // 6. Thuế TNCN lũy tiến 5 bậc tự động tính (Bậc 1: ≤ 10tr 5% -> 6.749.510 × 5% = 337.476 đ)
  const pitAutoCalculated = calculateProgressivePIT(pitTaxableIncome);

  // Nếu người dùng nhập tay (không rỗng / undefined) thì ưu tiên số nhập tay, ngược lại TỰ ĐỘNG TÍNH THEO CÔNG THỨC CHUẨN
  const personalTaxDeduction = (attendanceRecord?.manualPersonalTax !== undefined && attendanceRecord?.manualPersonalTax !== null)
    ? attendanceRecord.manualPersonalTax
    : pitAutoCalculated;
  const insuranceArrearsDeduction = attendanceRecord?.manualInsuranceArrears ?? 0;
  const otherDeduction = attendanceRecord?.manualOtherDeduction || 0;

  const totalDeduction =
    bhxhDeduction +
    bhytDeduction +
    bhtnDeduction +
    unionFeeDeduction +
    personalTaxDeduction +
    insuranceArrearsDeduction +
    otherDeduction;

  const netSalary = totalIncome - totalDeduction;

  return {
    employee,
    month: attendanceRecord?.month || 8,
    year: attendanceRecord?.year || 2026,
    hasAllowanceConfig,
    baseSalary,
    insuranceBaseSalary,

    hcDays: Number(hcDays.toFixed(1)),
    hcAmount,
    leavePaidDays,
    leavePaidAmount,
    leaveAnnualDays,
    leaveAnnualAmount,
    minWageLeaveDays,
    minWageLeaveAmount,
    transferredAnnualLeaveDays,
    transferredAnnualLeaveAmount,
    nightShiftHours: Number(nightShiftHours.toFixed(1)),
    nightShiftAmount,
    femaleSupportHours: Number(femaleSupportHours.toFixed(1)),
    femaleSupportAmount,
    ot150Hours: Number(ot150Hours.toFixed(1)),
    ot150Amount,
    sunday200Hours: Number(sunday200Hours.toFixed(1)),
    sunday200Amount,
    nightOt50Hours: Number(nightOt50Hours.toFixed(1)),
    nightOt50Amount,
    nightOt60Hours: Number(nightOt60Hours.toFixed(1)),
    nightOt60Amount,
    ot70Hours: Number(ot70Hours.toFixed(1)),
    ot70Amount,
    holiday300Hours: Number(holiday300Hours.toFixed(1)),
    holiday300Amount,
    holidayNightOt90Hours: Number(holidayNightOt90Hours.toFixed(1)),
    holidayNightOt90Amount,

    positionTitleAllowance,
    responsibilityAllowance,
    cleanRoomAllowance,
    developmentAllowance,
    seniorityAllowance,
    skillAllowance,
    languageSupport,
    diligenceBonus,
    unauthorizedAbsenceDays,
    diligenceBonusCut,
    transportSupport,
    housingSupport,
    documentFee,
    otherAllowance,
    otherBonus,
    referralBonus,
    otherAddition,

    totalIncome,

    bhxhDeduction,
    bhytDeduction,
    bhtnDeduction,
    unionFeeDeduction,
    personalTaxDeduction,
    insuranceArrearsDeduction,
    otherDeduction,
    pitAutoCalculated,
    pitTaxableIncome,
    pitExemptAmount, // tham khảo — khớp vai trò E71 trong file, KHÔNG dùng để trừ thuế
    pitExemptHousingSupport,
    pitExemptLanguageSupport,
    numberOfDependents,
    personalDeductionAmount,
    dependentDeductionAmount,
    totalPersonalDeduction,
    // Ghi chú: field này vẫn tên `attendanceRatio` để không phải sửa type CalculatedPayslip
    // trong types/payroll.ts, nhưng giá trị giờ là allowanceRatio (hệ số phụ cấp theo ngày
    // công chuẩn CỦA THÁNG so với 26 ngày cố định) — không còn là tỷ lệ chấm công cá nhân.
    attendanceRatio: Number(allowanceRatio.toFixed(3)),

    totalDeduction,

    netSalary,
  };
}

export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' đ';
}
