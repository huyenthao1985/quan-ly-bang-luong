import { CalculatedPayslip, Employee, EmployeeAttendanceRecord, SalaryConfig } from '../types/payroll';

// EPCC (pit-5-bracket-2026-law) — FIX ROOT CAUSE "vẫn dùng biểu thuế TNCN 7 bậc CŨ đã hết
// hiệu lực": đối chiếu file gốc BangLuong_PPC.xlsx (ô A77/A78, công ty PPC) — kể từ kỳ
// tính thuế THÁNG 07/2026 trở đi, Luật Thuế TNCN 2025 (số 109/2025/QH15, hiệu lực từ
// 01/7/2026) áp dụng biểu thuế lũy tiến MỚI chỉ còn 5 bậc (thay biểu 7 bậc cũ):
//   ≤10tr: 5% · 10-30tr: 10% (trừ nhanh 500.000) · 30-60tr: 20% (trừ nhanh 3.500.000) ·
//   60-100tr: 30% (trừ nhanh 9.500.000) · >100tr: 35% (trừ nhanh 14.500.000)
// Bảng dưới đây dùng phương pháp cộng dồn theo từng bậc (tương đương về số học với công
// thức "trừ nhanh" trong Excel — đã kiểm chứng chéo tại TNTT=50.000.000đ: cả 2 cách đều
// ra 6.500.000đ thuế). Vì ngày hiện tại (tháng 08/2026) đã sau mốc 01/7/2026, TOÀN BỘ kỳ
// lương từ giờ trở đi phải dùng biểu 5 bậc này — không còn trường hợp nào cần biểu 7 bậc cũ.
const PIT_BRACKETS: { upTo: number; rate: number }[] = [
  { upTo: 10_000_000, rate: 0.05 },
  { upTo: 30_000_000, rate: 0.10 },
  { upTo: 60_000_000, rate: 0.20 },
  { upTo: 100_000_000, rate: 0.30 },
  { upTo: Infinity, rate: 0.35 },
];

/**
 * Tính thuế TNCN lũy tiến từng phần (biểu 5 bậc, Luật TNCN 2025, hiệu lực từ kỳ lương
 * 01/7/2026) trên thu nhập tính thuế (đã trừ BHXH/BHYT/BHTN, giảm trừ bản thân, giảm trừ
 * người phụ thuộc và phần miễn thuế OT/ca đêm).
 * Đây là giá trị GỢI Ý TỰ ĐỘNG — ô "Thuế TNCN" nhập tay trên PayslipTab vẫn luôn được
 * ưu tiên tuyệt đối nếu HR đã nhập (xem cách dùng ở personalTaxDeduction bên dưới).
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
  //
  // Miễn thuế TNCN cho phần thu nhập trả THÊM so với ngày công bình thường khi làm
  // thêm giờ/ban đêm (Điều 3.1.i TT111/2013): với OT150%/OT200%/Lễ 300% (áp hệ số nhân
  // trên đơn giá giờ), chỉ phần VƯỢT 100% được miễn — phần 100% gốc vẫn tính thuế như
  // giờ công bình thường. Các khoản tăng ca đêm tính theo hệ số cộng thêm thuần túy (PC ca
  // đêm 30%, tăng ca đêm 50/60/70/90%) được coi là MIỄN TOÀN BỘ vì bản chất là phần phụ
  // trội, giờ công gốc đã được tính ở HC.
  // ⚠️ Phụ cấp cố định khác (nhà ở, tiếng Hàn, chức vụ...) mặc định TÍNH THUẾ đầy đủ —
  // nếu công ty có chính sách miễn/giảm riêng cho các khoản này, cần bổ sung thêm.
  const ot150ExemptPortion = Math.round(ot150Hours * hourlyRate * 0.5);
  const sunday200ExemptPortion = Math.round(sunday200Hours * hourlyRate * 1.0);
  const holiday300ExemptPortion = Math.round(holiday300Hours * hourlyRate * 2.0);

  // EPCC (female-support-not-pit-exempt) — FIX ROOT CAUSE "trợ cấp phụ nữ bị miễn thuế
  // nhầm": đối chiếu ô E71 = SUM(E18:E26) của BangLuong_PPC.xlsx — dòng 19 "Trợ cấp phụ nữ
  // (150%)" KHÔNG có công thức nào ở cột E (miễn thuế), khác hẳn các dòng phụ cấp/tăng ca
  // đêm còn lại trong cùng vùng SUM (đều có công thức E = D hoặc phần vượt 100%). Tức công
  // ty vẫn TÍNH THUẾ ĐẦY ĐỦ khoản này — trước đây code cộng nhầm femaleSupportAmount vào
  // pitExemptAmount, làm thu nhập chịu thuế bị tính thấp hơn thực tế. Đã bỏ khỏi danh sách
  // miễn thuế bên dưới.
  //
  // EPCC (housing-language-not-pit-exempt-per-master-formula) — FIX ROOT CAUSE "mặc định
  // miễn thuế nhà ở + tiếng dựa trên suy luận từ 1 phiếu lương khác, sai với công thức
  // chính thức": file BangLuong_PPC.xlsx CÓ tính riêng ô E72 = ROUND((D34+D38)*E69,0)
  // ("Thu nhập miễn thuế khác - nhà ở+tiếng") nhưng công thức thu nhập tính thuế thực tế
  // E76 = MAX(0, D42-E75-E73-E74) — KHÔNG hề trừ E72 ở đây. Nói cách khác, ô E72 được tính
  // sẵn nhưng KHÔNG được áp dụng vào công thức thuế chính thức của công ty — nhà ở và tiếng
  // Hàn vẫn bị tính thuế TNCN đầy đủ. Bản sửa trước đó (đối chiếu ngược 1 phiếu lương khác,
  // không phải công thức gốc) suy luận nhầm 2 khoản này được miễn thuế. Đổi mặc định về
  // FALSE cho khớp công thức chính thức của công ty; vẫn giữ 2 cờ config để kế toán tự bật
  // lại nếu xác nhận có áp dụng khác trong thực tế.
  const pitExemptHousingSupport = config.pitExemptHousingSupport ?? false;
  const pitExemptLanguageSupport = config.pitExemptLanguageSupport ?? false;
  const housingExemptPortion = pitExemptHousingSupport ? housingSupport : 0;
  const languageExemptPortion = pitExemptLanguageSupport ? languageSupport : 0;

  // EPCC (pit-exempt-is-memo-only-not-subtracted) — FIX ROOT CAUSE "trừ nhầm phần miễn thuế
  // OT/ca đêm ra khỏi thu nhập chịu thuế, sai với công thức chính thức của công ty": đối
  // chiếu trực tiếp ô E76 = MAX(0, D42-E75-E73-E74) của BangLuong_PPC.xlsx — công thức này
  // CHỈ trừ (Tổng thu nhập − BH − giảm trừ bản thân − giảm trừ phụ thuộc), KHÔNG hề trừ E71
  // (=SUM(E18:E26), số miễn thuế OT/ca đêm theo NĐ145) dù ô E71 vẫn được tính sẵn trong file.
  // Tức E71 chỉ là số THAM KHẢO/MEMO, không được áp dụng vào công thức thuế thật của công ty
  // (giống hệt trường hợp E72 "nhà ở+tiếng" đã ghi chú ở EPCC housing-language-not-pit-exempt
  // bên trên). Người dùng đã xác nhận (2026-08-06): giữ đúng theo file gốc, KHÔNG áp dụng
  // miễn thuế NĐ145 vào công thức tính thuế TNCN thực tế. `pitExemptAmount` bên dưới vẫn được
  // giữ lại và trả về trong payslip CHỈ để hiển thị tham khảo (khớp vai trò của E71 trong
  // file) — không còn dùng để trừ vào `pitTaxableIncome` nữa.
  const pitExemptAmount =
    ot150ExemptPortion +
    sunday200ExemptPortion +
    holiday300ExemptPortion +
    nightShiftAmount +
    nightOt50Amount +
    nightOt60Amount +
    ot70Amount +
    holidayNightOt90Amount +
    housingExemptPortion +
    languageExemptPortion;

  // EPCC (personal-deduction-2026-law) — FIX ROOT CAUSE "vẫn dùng mức giảm trừ gia cảnh CŨ
  // đã hết hiệu lực": đối chiếu ô E73/E74 của BangLuong_PPC.xlsx — Luật Thuế TNCN 2025 (số
  // 109/2025/QH15) + NQ 110/2025/UBTVQH15, áp dụng từ kỳ tính thuế 2026: giảm trừ bản thân
  // 15.500.000đ/tháng (mức cũ 11.000.000đ), giảm trừ người phụ thuộc 6.200.000đ/người/tháng
  // (mức cũ 4.400.000đ/người). Vì hiện tại (08/2026) đã qua mốc hiệu lực, đổi mặc định sang
  // mức mới; config.personalDeductionAmount/dependentDeductionAmount vẫn ưu tiên nếu HR đã
  // cấu hình tay trong Cài Đặt.
  const personalDeductionAmount = config.personalDeductionAmount ?? 15_500_000;
  const dependentDeductionAmount = config.dependentDeductionAmount ?? 6_200_000;
  const numberOfDependents = attendanceRecord?.manualNumberOfDependents ?? employee.numberOfDependents ?? employee.dependentsCount ?? 0;
  const totalPersonalDeduction = personalDeductionAmount + numberOfDependents * dependentDeductionAmount;

  // ✅ Khớp đúng E76 = MAX(0, D42-E75-E73-E74): dùng thẳng totalIncome (= D42), KHÔNG trừ
  // pitExemptAmount (xem ghi chú EPCC pit-exempt-is-memo-only-not-subtracted ở trên).
  const insuranceDeductionForPit = bhxhDeduction + bhytDeduction + bhtnDeduction;
  const pitTaxableIncome = Math.max(0, totalIncome - insuranceDeductionForPit - totalPersonalDeduction);
  const pitAutoCalculated = calculateProgressivePIT(pitTaxableIncome);

  const personalTaxDeduction = attendanceRecord?.manualPersonalTax ?? pitAutoCalculated;
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
