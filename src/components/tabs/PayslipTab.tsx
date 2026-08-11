import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Printer, Download, CheckCircle2 } from 'lucide-react';
import { usePayroll } from '../../context/PayrollContext';
import { calculatePayslip, formatVND } from '../../utils/payrollCalculations';
import { FormattedNumberInput } from '../ui/FormattedNumberInput';

export const PayslipTab: React.FC = () => {
  const {
    employees,
    attendanceRecords,
    salaryConfig,
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
    updateEmployee,
    showToast,
    activeRole,
    currentUser,
    payrollViewPermissions,
    viewerPosition,
  } = usePayroll();

  const [selectedEmpId, setSelectedEmpId] = useState<string>(employees[0]?.id || '11704029');
  const printRef = useRef<HTMLDivElement>(null);

  // EPCC (payroll-view-permission-matrix) — FIX: dropdown "Nhân viên" trước đây show TẤT
  // CẢ nhân viên không lọc gì (ai cũng xem được lương bất kỳ ai). Giờ lọc theo hồ sơ nhân
  // viên gắn với currentUser (viewerPosition, suy ra từ currentUser.employeeId trong
  // PayrollContext) đối chiếu ma trận payrollViewPermissions; Admin luôn xem được toàn bộ,
  // không giới hạn.
  const allowedPositions = activeRole === 'Admin'
    ? undefined
    : (viewerPosition ? (payrollViewPermissions[viewerPosition] || [viewerPosition]) : []);

  const visibleEmployees = allowedPositions
    ? employees.filter((emp) => allowedPositions.includes(emp.position))
    : employees;

  // Nếu nhân viên đang chọn bị lọc mất quyền xem (vd đổi activeRole để test), tự chuyển
  // về nhân viên đầu tiên hợp lệ trong danh sách được phép xem.
  useEffect(() => {
    if (visibleEmployees.length > 0 && !visibleEmployees.find((e) => e.id === selectedEmpId)) {
      setSelectedEmpId(visibleEmployees[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRole, viewerPosition]);

  const selectedEmp = employees.find((e) => e.id === selectedEmpId) || employees[0];

  const attendanceKey = `${selectedEmpId}_${selectedYear}_${selectedMonth}`;
  const attendanceRecord = attendanceRecords[attendanceKey];

  const payslip = calculatePayslip(selectedEmp, attendanceRecord, salaryConfig);

  // EPCC (move-manual-inputs-to-settings) — FIX ROOT CAUSE "khu vực 'Nhập tay bổ sung' chiếm
  // chỗ trên phiếu lương nhưng ít dùng": theo yêu cầu, đã CHUYỂN toàn bộ state/handler nhập
  // tay bổ sung (Trợ cấp phụ nữ, Phép tồn chuyển, Thuế TNCN, Truy thu BHYT, Trừ khác, Số
  // ngày nghỉ không phép) sang `SettingsTab.tsx` (mục "Nhập Tay Bổ Sung Theo Nhân Viên /
  // Tháng"). PayslipTab giờ CHỈ ĐỌC (read-only) các giá trị này qua `attendanceRecord`/
  // `payslip` — không còn state cục bộ hay nút Lưu tại đây nữa.

  const handleBaseSalaryChange = (newBaseSalary: number) => {
    updateEmployee({
      ...selectedEmp,
      baseSalary: newBaseSalary,
    });
  };

  // EPCC (insurance-base-salary-input) — thêm ô "Lương cơ bản mới" (insuranceBaseSalary),
  // trước đây chỉ có "Lương CB" (baseSalary) cũ nên không sửa được mức đóng BHXH/OT khi
  // công ty tăng lương giữa kỳ.
  const handleInsuranceBaseSalaryChange = (newInsuranceBaseSalary: number) => {
    updateEmployee({
      ...selectedEmp,
      insuranceBaseSalary: newInsuranceBaseSalary,
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-2">
      {/* EPCC (checkin-sets-viewer-identity) — cảnh báo nếu chưa xác định được vị trí:
          currentUser chưa gắn employeeId TRONG SAMPLE_USERS và trên thiết bị này cũng
          chưa ai từng tự điểm danh ở AttendanceTab (lastCheckedInEmployeeId trống). */}
      {activeRole !== 'Admin' && !viewerPosition && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-xs rounded-lg p-2">
          Chưa xác định được vị trí của tài khoản "{currentUser.name}" để áp dụng phân quyền
          xem Bảng lương. Hãy vào tab Điểm danh, chọn đúng tên mình và bấm "Lưu điểm danh" ít
          nhất 1 lần trên thiết bị này — hệ thống sẽ tự ghi nhớ vị trí từ hồ sơ nhân viên đó.
        </div>
      )}

      {/* Xác nhận đang xem với tư cách ai, để minh bạch lý do danh sách bị lọc */}
      {activeRole !== 'Admin' && viewerPosition && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs rounded-lg p-2">
          Đang xem với tư cách vị trí <strong>{viewerPosition}</strong> (theo hồ sơ nhân viên
          gần nhất đã điểm danh trên thiết bị này) — chỉ thấy bảng lương của các vị trí được
          phân quyền cho <strong>{viewerPosition}</strong> trong Cài đặt.
        </div>
      )}

      {/* Top Filter Bar matching screenshot 3 */}
      <div className="bg-white dark:bg-slate-800 p-2 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-2">
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
            Nhân viên
          </label>
          <select
            value={selectedEmpId}
            onChange={(e) => setSelectedEmpId(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 min-w-[260px] cursor-pointer"
          >
            {visibleEmployees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.id} - {emp.fullName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
            Tháng
          </label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                Tháng {m}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
            Năm
          </label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            {[2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-medium px-3.5 py-1.5 rounded shadow-sm transition-all cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>In bảng lương</span>
          </button>
        </div>
      </div>

      {/* Warning box if allowance config is zero or missing - Exact matching screenshot 3! */}
      {(!payslip.hasAllowanceConfig || payslip.baseSalary === 0) && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200 p-1.5 rounded-lg text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            ⚠️ Vị trí "{selectedEmp.position}" chưa có cấu hình phụ cấp hoặc Lương CB đang để 0, các khoản phụ cấp đang tạm để 0
          </span>
        </div>
      )}

      <div
        ref={printRef}
        className="bg-white dark:bg-slate-900 rounded-lg shadow-md border-2 border-slate-800 dark:border-slate-700 overflow-hidden print:p-0 print:border-none"
      >
        <div className="bg-[#122842] text-white p-1.5 text-center border-b border-slate-800">
          <h2 className="text-sm font-black tracking-wider uppercase">
            BẢNG LƯƠNG IM
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 text-xs border-b border-slate-800 divide-y md:divide-y-0 md:divide-x divide-slate-800 bg-slate-50 dark:bg-slate-800/80 font-semibold text-slate-800 dark:text-slate-200">
          <div className="p-1.5 flex items-center">
            Họ và tên: <span className="font-bold text-slate-900 dark:text-white ml-1.5">{selectedEmp.fullName}</span>
          </div>
          <div className="p-1.5 flex items-center">
            Ngày sinh: <span className="font-normal text-slate-700 dark:text-slate-300 ml-1.5">{selectedEmp.birthDate}</span>
          </div>
          <div className="p-1.5 flex items-center">
            NGÀY BẮT ĐẦU: <span className="font-bold text-slate-900 dark:text-white ml-1.5">{selectedEmp.startDate}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 text-xs border-b border-slate-800 divide-y md:divide-y-0 md:divide-x divide-slate-800 bg-slate-50 dark:bg-slate-800/80 font-semibold text-slate-800 dark:text-slate-200">
          <div className="p-1.5 flex items-center">
            Công đoàn: <span className="font-normal text-slate-600 dark:text-slate-300 ml-1.5">{selectedEmp.unionMember !== false ? 'Đoàn viên' : 'Không'}</span>
          </div>
          <div className="p-1.5 flex items-center gap-2">
            <span>Lương CB cũ:</span>
            <FormattedNumberInput
              value={selectedEmp.baseSalary || 0}
              onChange={(v) => handleBaseSalaryChange(v)}
              className="w-28 px-2 py-0.5 bg-white dark:bg-slate-900 border border-blue-400 rounded text-slate-900 dark:text-slate-100 font-bold focus:outline-none text-right"
            />
          </div>
          <div className="p-1.5 flex items-center gap-2">
            <span>Lương CB mới:</span>
            <FormattedNumberInput
              value={selectedEmp.insuranceBaseSalary || 0}
              onChange={(v) => handleInsuranceBaseSalaryChange(v)}
              placeholder="= Lương CB cũ nếu để trống"
              className="w-32 px-2 py-0.5 bg-white dark:bg-slate-900 border border-emerald-400 rounded text-slate-900 dark:text-slate-100 font-bold focus:outline-none text-right"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x-2 divide-slate-800 text-xs">
          <div className="lg:col-span-7">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold border-b border-slate-800 text-[11px]">
                <tr>
                  <th className="py-1 px-2 border-r border-slate-800 text-center w-8">#</th>
                  <th className="py-1 px-3 border-r border-slate-800">A. Các khoản thu nhập</th>
                  <th className="py-1 px-2 border-r border-slate-800 text-center w-24">Số ngày/giờ</th>
                  <th className="py-1 px-3 text-right w-28">Số tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">1</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">Số ngày làm HC</td>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800 font-medium bg-amber-50/60 dark:bg-amber-950/20">{payslip.hcDays} ngày</td>
                  <td className="py-0.5 px-3 text-right font-medium">{formatVND(payslip.hcAmount)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">2</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">Nghỉ hưởng lương 100%</td>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800 font-medium bg-amber-50/60 dark:bg-amber-950/20">{payslip.leavePaidDays} ngày</td>
                  <td className="py-0.5 px-3 text-right font-medium">{formatVND(payslip.leavePaidAmount)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">3</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">Nghỉ phép năm</td>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800 font-medium bg-amber-50/60 dark:bg-amber-950/20">{payslip.leaveAnnualDays} ngày</td>
                  <td className="py-0.5 px-3 text-right font-medium">{formatVND(payslip.leaveAnnualAmount)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">4</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">Phép tồn chuyển tháng sau</td>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800 font-medium">{payslip.transferredAnnualLeaveDays} ngày</td>
                  <td className="py-0.5 px-3 text-right font-medium text-slate-400">—</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">5</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">Nghỉ hưởng lương tối thiểu</td>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800 font-medium bg-amber-50/60 dark:bg-amber-950/20">{payslip.minWageLeaveDays} ngày</td>
                  <td className="py-0.5 px-3 text-right font-medium">{formatVND(payslip.minWageLeaveAmount)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">6</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">PC ca đêm 30%</td>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800 font-medium bg-amber-50/60 dark:bg-amber-950/20">{payslip.nightShiftHours}h</td>
                  <td className="py-0.5 px-3 text-right font-medium">{formatVND(payslip.nightShiftAmount)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">7</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">Trợ cấp phụ nữ 150%</td>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800 font-medium bg-amber-50/60 dark:bg-amber-950/20">{payslip.femaleSupportHours}h</td>
                  <td className="py-0.5 px-3 text-right font-medium">{formatVND(payslip.femaleSupportAmount)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">8</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">Làm thêm giờ/OT 150%</td>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800 font-medium bg-amber-50/60 dark:bg-amber-950/20">{payslip.ot150Hours}h</td>
                  <td className="py-0.5 px-3 text-right font-medium">{formatVND(payslip.ot150Amount)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">9</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">Làm thêm giờ/OT 200%</td>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800 font-medium bg-amber-50/60 dark:bg-amber-950/20">{payslip.sunday200Hours}h</td>
                  <td className="py-0.5 px-3 text-right font-medium">{formatVND(payslip.sunday200Amount)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">10</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">Tăng ca đêm ngày thường 50%</td>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800 font-medium bg-amber-50/60 dark:bg-amber-950/20">{payslip.nightOt50Hours}h</td>
                  <td className="py-0.5 px-3 text-right font-medium">{formatVND(payslip.nightOt50Amount)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">11</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">Tăng ca đêm thông ca 60%</td>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800 font-medium bg-amber-50/60 dark:bg-amber-950/20">{payslip.nightOt60Hours}h</td>
                  <td className="py-0.5 px-3 text-right font-medium">{formatVND(payslip.nightOt60Amount)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">12</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">Tăng ca 70% (đêm)</td>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800 font-medium bg-amber-50/60 dark:bg-amber-950/20">{payslip.ot70Hours}h</td>
                  <td className="py-0.5 px-3 text-right font-medium">{formatVND(payslip.ot70Amount)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">13</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">Tăng ca ngày lễ 300%</td>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800 font-medium bg-amber-50/60 dark:bg-amber-950/20">{payslip.holiday300Hours}h</td>
                  <td className="py-0.5 px-3 text-right font-medium">{formatVND(payslip.holiday300Amount)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">14</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">Tăng ca đêm ngày lễ 90%</td>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800 font-medium bg-amber-50/60 dark:bg-amber-950/20">{payslip.holidayNightOt90Hours}h</td>
                  <td className="py-0.5 px-3 text-right font-medium">{formatVND(payslip.holidayNightOt90Amount)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">15</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">Chức vụ</td>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800"></td>
                  <td className="py-0.5 px-3 text-right font-medium">{formatVND(payslip.positionTitleAllowance)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">16</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">PC trách nhiệm</td>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800"></td>
                  <td className="py-0.5 px-3 text-right font-medium">{formatVND(payslip.responsibilityAllowance)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">17</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">PC phòng sạch</td>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800"></td>
                  <td className="py-0.5 px-3 text-right font-medium">{formatVND(payslip.cleanRoomAllowance)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">18</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">Phụ cấp phát triển</td>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800"></td>
                  <td className="py-0.5 px-3 text-right font-medium">{formatVND(payslip.developmentAllowance)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">19</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">Phụ cấp kỹ năng</td>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800"></td>
                  <td className="py-0.5 px-3 text-right font-medium">{formatVND(payslip.skillAllowance || 0)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">20</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">
                    Thưởng chuyên cần
                    {payslip.diligenceBonusCut && (
                      <span className="ml-1 text-[10px] text-rose-600 dark:text-rose-400 font-normal">
                        (đã cắt vì nghỉ không phép {payslip.unauthorizedAbsenceDays} ngày)
                      </span>
                    )}
                  </td>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800"></td>
                  <td className="py-0.5 px-3 text-right font-medium">{formatVND(payslip.diligenceBonus)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">21</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">Hỗ trợ giao thông</td>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800"></td>
                  <td className="py-0.5 px-3 text-right font-medium">{formatVND(payslip.transportSupport)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">22</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">Hỗ trợ nhà ở</td>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800"></td>
                  <td className="py-0.5 px-3 text-right font-medium">{formatVND(payslip.housingSupport)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">23</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">Hồ sơ</td>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800"></td>
                  <td className="py-0.5 px-3 text-right font-medium">{formatVND(payslip.documentFee)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">24</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">Thưởng khác</td>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800"></td>
                  <td className="py-0.5 px-3 text-right font-medium">{formatVND(payslip.otherBonus)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">25</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">PC thâm niên</td>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800"></td>
                  <td className="py-0.5 px-3 text-right font-medium">{formatVND(payslip.seniorityAllowance || 0)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">26</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">Phụ cấp tiếng</td>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800"></td>
                  <td className="py-0.5 px-3 text-right font-medium">{formatVND(payslip.languageSupport || 0)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">27</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">Bù khác</td>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800"></td>
                  <td className="py-0.5 px-3 text-right font-medium">{formatVND(payslip.otherAllowance)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">28</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">Thưởng giới thiệu</td>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800"></td>
                  <td className="py-0.5 px-3 text-right font-medium">{formatVND(payslip.referralBonus)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">29</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">Cộng khác</td>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800"></td>
                  <td className="py-0.5 px-3 text-right font-medium">{formatVND(payslip.otherAddition)}</td>
                </tr>
                <tr className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 font-bold border-t border-slate-800">
                  <td colSpan={2} className="py-1 px-3 border-r border-slate-800">Tổng thu nhập:</td>
                  <td colSpan={2} className="py-1 px-3 text-right text-sm">{formatVND(payslip.totalIncome)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="lg:col-span-5 flex flex-col justify-between">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold border-b border-slate-800 text-[11px]">
                <tr>
                  <th className="py-1 px-2 border-r border-slate-800 text-center w-8">#</th>
                  <th className="py-1 px-3 border-r border-slate-800">B. Các khoản khấu trừ</th>
                  <th className="py-1 px-3 text-right w-28">Số tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">a</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">BHXH (8%)</td>
                  <td className="py-0.5 px-3 text-right font-medium bg-amber-50/60 dark:bg-amber-950/20">{formatVND(payslip.bhxhDeduction)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">b</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">BHYT (1,5%)</td>
                  <td className="py-0.5 px-3 text-right font-medium bg-amber-50/60 dark:bg-amber-950/20">{formatVND(payslip.bhytDeduction)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">c</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">BHTN (1%)</td>
                  <td className="py-0.5 px-3 text-right font-medium bg-amber-50/60 dark:bg-amber-950/20">{formatVND(payslip.bhtnDeduction)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">d</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">Đoàn phí CĐ</td>
                  <td className="py-0.5 px-3 text-right font-medium">{formatVND(payslip.unionFeeDeduction)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">e</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">
                    Thuế TNCN
                    {attendanceRecord?.manualPersonalTax == null && (
                      <span className="ml-1 text-[10px] text-sky-600 dark:text-sky-400 font-normal">(tự tính)</span>
                    )}
                  </td>
                  <td className="py-0.5 px-3 text-right font-medium bg-amber-50/60 dark:bg-amber-950/20">{formatVND(payslip.personalTaxDeduction)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">f</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">Truy thu BHYT</td>
                  <td className="py-0.5 px-3 text-right font-medium bg-amber-50/60 dark:bg-amber-950/20">{formatVND(payslip.insuranceArrearsDeduction)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">g</td>
                  <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">Trừ khác</td>
                  <td className="py-0.5 px-3 text-right font-medium bg-amber-50/60 dark:bg-amber-950/20">{formatVND(payslip.otherDeduction)}</td>
                </tr>

                {Array.from({ length: 22 }).map((_, idx) => (
                  <tr key={`empty-${idx}`}>
                    <td className="py-0.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">&nbsp;</td>
                    <td className="py-0.5 px-3 border-r border-slate-300 dark:border-slate-800">&nbsp;</td>
                    <td className="py-0.5 px-3 text-right font-medium">&nbsp;</td>
                  </tr>
                ))}

                <tr className="bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-300 font-bold border-t border-slate-800">
                  <td colSpan={2} className="py-1 px-3 border-r border-slate-800">TỔNG KHẤU TRỪ:</td>
                  <td className="py-1 px-3 text-right text-sm">{formatVND(payslip.totalDeduction)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* LARGE BOTTOM THỰC LĨNH BANNER MATCHING SCREENSHOT 3 */}
        <div className="bg-slate-100 dark:bg-slate-800 p-2 border-t-2 border-slate-800 flex items-center justify-center gap-4 text-center">
          <span className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">
            THỰC LĨNH:
          </span>
          <span className="text-2xl font-black text-slate-900 dark:text-white">
            {formatVND(payslip.netSalary)}
          </span>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 dark:text-slate-500 italic px-1">
        Các khoản nhập tay bổ sung (Trợ cấp phụ nữ, Thuế TNCN, Truy thu BHYT, Số ngày nghỉ không phép...) nay được chỉnh ở mục "Cài đặt".
      </p>
    </div>
  );
};
