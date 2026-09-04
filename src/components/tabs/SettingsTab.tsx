import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Settings, Save, Shield, Percent, DollarSign, Award, Receipt, Users } from 'lucide-react';
import { usePayroll } from '../../context/PayrollContext';
import { Position, PositionAllowanceConfig, SalaryConfig } from '../../types/payroll';
import { formatVND, calculatePayslip } from '../../utils/payrollCalculations';
import { FormattedNumberInput } from '../ui/FormattedNumberInput';
import { getAllowedPositionsForUser } from '../../lib/auth';

export const SettingsTab: React.FC = () => {
  const {
    salaryConfig,
    updateSalaryConfig,
    payrollViewPermissions,
    updatePayrollViewPermissions,
    viewerPosition,
    activeRole,
    showToast,
    employees,
    updateEmployee,
    attendanceRecords,
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
    updateAttendanceManualOverrides,
    selectedEmployeeId,
    setSelectedEmployeeId,
    authRole,
    authProfile,
  } = usePayroll();

  const [config, setConfig] = useState<SalaryConfig>({ ...salaryConfig });

  // EPCC (payroll-view-permission-matrix) — state cục bộ cho ma trận phân quyền xem Bảng
  // lương, chỉ thực sự lưu khi bấm "Lưu tất cả cấu hình" (gộp vào handleSave bên dưới),
  // theo đúng tinh thần "1 nút Lưu duy nhất" đã áp dụng cho cả config lẫn manual overrides.
  const [permMatrix, setPermMatrix] = useState(payrollViewPermissions);

  // EPCC (account-scope-filter) — Lọc vị trí và nhân viên cho phép:
  const isSuperAdmin = authRole === 'admin';
  const canEdit = isSuperAdmin || authRole === 'editor' || activeRole !== 'User';

  // Tự động đồng bộ state khi context tải xong từ Supabase/localStorage
  useEffect(() => {
    setConfig({ ...salaryConfig });
  }, [salaryConfig]);

  useEffect(() => {
    setPermMatrix(payrollViewPermissions);
  }, [payrollViewPermissions]);

  const em = (authProfile?.email || '').toLowerCase();
  const un = (authProfile?.username || '').toLowerCase();
  const isVP = em.includes('vp') || un === 'vp';
  const isKHO = em.includes('kho') || un === 'kho';

  // Lấy mã NV liên kết (từ profile hoặc email ảo mã NV)
  const linkedEmployeeId = authProfile?.employee_id ||
    (em.endsWith('@imvina.com') ? em.replace('@imvina.com', '') : null) ||
    (em.endsWith('@noemail.local') && !isVP && !isKHO ? em.replace('@noemail.local', '') : null);

  let visibleEmployees = employees;
  if (isSuperAdmin) {
    visibleEmployees = employees;
  } else if (isVP) {
    visibleEmployees = employees.filter((emp) => ['Manager', 'Senior Staff', 'Staff'].includes(emp.position));
  } else if (isKHO) {
    visibleEmployees = employees.filter((emp) => ['Leader', 'Staff', 'OP'].includes(emp.position));
  } else if (linkedEmployeeId) {
    const myEmps = employees.filter((emp) => emp.id.toLowerCase() === linkedEmployeeId.toLowerCase());
    visibleEmployees = myEmps.length > 0 ? myEmps : employees;
  } else if (authProfile?.employee_id) {
    visibleEmployees = employees.filter((emp) => emp.id === authProfile.employee_id);
  }

  // Tự động chuyển selectedEmployeeId về nhân viên đang đăng nhập nếu là tài khoản cá nhân
  useEffect(() => {
    if (!isSuperAdmin && !isVP && !isKHO && linkedEmployeeId) {
      const match = employees.find((e) => e.id.toLowerCase() === linkedEmployeeId.toLowerCase());
      if (match) setSelectedEmployeeId(match.id);
    } else if (visibleEmployees.length > 0 && !visibleEmployees.find((e) => e.id === selectedEmployeeId)) {
      setSelectedEmployeeId(visibleEmployees[0].id);
    }
  }, [linkedEmployeeId, isSuperAdmin, isVP, isKHO, visibleEmployees, selectedEmployeeId, setSelectedEmployeeId, employees]);

  const positions: Position[] = isSuperAdmin
    ? ['S. Manager', 'Manager', 'Senior Staff', 'Leader', 'Staff', 'OP']
    : isVP
    ? ['Manager', 'Senior Staff', 'Staff']
    : isKHO
    ? ['Leader', 'Staff', 'OP']
    : (visibleEmployees[0] ? [visibleEmployees[0].position] : ['Staff']);

  const visibleAllowancePositions: Position[] = positions;

  // EPCC (move-manual-inputs-to-settings) — mục "Nhập Tay Bổ Sung Theo Nhân Viên/Tháng":
  const manualEmpId = selectedEmployeeId || (visibleEmployees[0]?.id ?? employees[0]?.id ?? '');
  const setManualEmpId = setSelectedEmployeeId;
  const manualEmp = visibleEmployees.find((e) => e.id === manualEmpId) || visibleEmployees[0] || employees[0];
  const manualAttendanceKey = `${manualEmp.id}_${selectedYear}_${selectedMonth}`;
  const manualAttendanceRecord = attendanceRecords[manualAttendanceKey];
  const manualPayslip = manualEmp
    ? calculatePayslip(manualEmp, manualAttendanceRecord, salaryConfig)
    : null;

  const [positionFilter, setPositionFilter] = useState<Position | ''>(manualEmp?.position || '');

  useEffect(() => {
    const emp = visibleEmployees.find((e) => e.id === manualEmpId) || visibleEmployees[0] || employees[0];
    if (emp) {
      setPositionFilter(emp.position);
    }
  }, [manualEmpId, visibleEmployees, employees]);

  const selectedEmpPosition: Position | undefined = positionFilter || undefined;

  const filteredAllowancePositions: Position[] = selectedEmpPosition
    ? visibleAllowancePositions.filter((p) => p === selectedEmpPosition)
    : visibleAllowancePositions;

  const [manualFemaleHours, setManualFemaleHours] = useState<number>(
    manualAttendanceRecord?.manualFemaleSupportHours ?? manualPayslip?.femaleSupportHours ?? 0
  );
  const [manualTransferredLeave, setManualTransferredLeave] = useState<number>(
    manualAttendanceRecord?.manualTransferredAnnualLeave ?? 0
  );
  const [manualTax, setManualTax] = useState<string>(
    manualAttendanceRecord?.manualPersonalTax != null ? String(manualAttendanceRecord.manualPersonalTax) : ''
  );
  const [manualArrears, setManualArrears] = useState<number>(
    manualAttendanceRecord?.manualInsuranceArrears ?? 0
  );
  const [manualOtherDeduction, setManualOtherDeduction] = useState<number>(
    manualAttendanceRecord?.manualOtherDeduction ?? 0
  );
  const [manualUnauthorizedAbsence, setManualUnauthorizedAbsence] = useState<number>(
    manualAttendanceRecord?.manualUnauthorizedAbsenceDays ?? 0
  );
  const [manualDependents, setManualDependents] = useState<number>(
    manualAttendanceRecord?.manualNumberOfDependents ?? manualEmp?.numberOfDependents ?? manualEmp?.dependentsCount ?? 0
  );

  // Nạp lại giá trị ô nhập khi đổi nhân viên/tháng/năm đang chọn ở mục này, tránh hiện giá
  // trị của nhân viên/tháng trước đó còn sót trong state cục bộ.
  useEffect(() => {
    setManualFemaleHours(manualAttendanceRecord?.manualFemaleSupportHours ?? manualPayslip?.femaleSupportHours ?? 0);
    setManualTransferredLeave(manualAttendanceRecord?.manualTransferredAnnualLeave ?? 0);
    setManualTax(manualAttendanceRecord?.manualPersonalTax != null ? String(manualAttendanceRecord.manualPersonalTax) : '');
    setManualArrears(manualAttendanceRecord?.manualInsuranceArrears ?? 0);
    setManualOtherDeduction(manualAttendanceRecord?.manualOtherDeduction ?? 0);
    setManualUnauthorizedAbsence(manualAttendanceRecord?.manualUnauthorizedAbsenceDays ?? 0);
    setManualDependents(manualAttendanceRecord?.manualNumberOfDependents ?? manualEmp?.numberOfDependents ?? manualEmp?.dependentsCount ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualEmpId, selectedMonth, selectedYear, manualEmp]);

  // Tính toán phiếu lương live cho NV đang chọn theo các thông số nhập tay hiện thời
  const currentAttendanceForCalc = useMemo(() => ({
    ...(manualAttendanceRecord || {
      employeeId: manualEmpId,
      month: selectedMonth,
      year: selectedYear,
      dailyRecords: {},
    }),
    manualNumberOfDependents: manualDependents,
    manualPersonalTax: manualTax.trim() === '' ? undefined : Number(manualTax),
    manualInsuranceArrears: manualArrears,
    manualOtherDeduction: manualOtherDeduction,
    manualFemaleSupportHours: manualFemaleHours,
    manualTransferredAnnualLeave: manualTransferredLeave,
    manualUnauthorizedAbsenceDays: manualUnauthorizedAbsence,
  }), [manualAttendanceRecord, manualEmpId, selectedMonth, selectedYear, manualDependents, manualTax, manualArrears, manualOtherDeduction, manualFemaleHours, manualTransferredLeave, manualUnauthorizedAbsence]);

  const currentManualPayslip = useMemo(() => {
    if (!manualEmp) return null;
    return calculatePayslip(manualEmp, currentAttendanceForCalc, config);
  }, [manualEmp, currentAttendanceForCalc, config]);

  const handleResetTaxToAuto = () => {
    setManualTax('');
    updateAttendanceManualOverrides(manualEmpId, {
      manualPersonalTax: undefined,
    });
    showToast('Đã chuyển Thuế TNCN về chế độ tự tính!');
  };

  // Định dạng số có dấu phẩy phân cách hàng nghìn (vd 500000 -> "500,000")
  // dùng cho các ô nhập phụ cấp theo vị trí, dễ đọc hơn số thuần.
  const fmtNum = (n: number) => (n || 0).toLocaleString('en-US');
  const parseNum = (s: string) => Number(s.replace(/[^0-9]/g, '')) || 0;

  // EPCC (payroll-view-permission-matrix) — chỉ Admin được tick
  const togglePermission = (viewerPos: Position, targetPos: Position) => {
    if (!isSuperAdmin && activeRole !== 'Admin') {
      showToast('Chỉ Admin mới có quyền phân quyền xem Bảng lương!', 'error');
      return;
    }
    setPermMatrix((prev) => {
      const current = prev[viewerPos] || [];
      const nextForViewer = current.includes(targetPos)
        ? current.filter((p) => p !== targetPos)
        : [...current, targetPos];
      return { ...prev, [viewerPos]: nextForViewer };
    });
  };

  // EPCC (single-save-button) — Lưu tất cả cấu hình & các khoản nhập tay theo nhân viên
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      showToast('Chỉ Quản trị viên hoặc Leader mới có quyền cập nhật cấu hình!', 'error');
      return;
    }
    updateSalaryConfig(config);
    updatePayrollViewPermissions(permMatrix);
    updateAttendanceManualOverrides(manualEmpId, {
      manualFemaleSupportHours: manualFemaleHours,
      manualTransferredAnnualLeave: manualTransferredLeave,
      manualPersonalTax: manualTax.trim() === '' ? undefined : Number(manualTax),
      manualInsuranceArrears: manualArrears,
      manualOtherDeduction: manualOtherDeduction,
      manualUnauthorizedAbsenceDays: manualUnauthorizedAbsence,
      manualNumberOfDependents: manualDependents,
    });
    if (manualEmp && updateEmployee) {
      updateEmployee({
        ...manualEmp,
        numberOfDependents: manualDependents,
        dependentsCount: manualDependents,
      });
    }
    showToast('Đã lưu thành công tất cả cấu hình & số người phụ thuộc!', 'success');
  };

  // Ref luôn giữ config mới nhất để commitAllowance không bị stale closure
  const configRef = useRef(config);
  useEffect(() => { configRef.current = config; }, [config]);

  const handlePositionAllowanceChange = (
    pos: Position,
    field: keyof Omit<PositionAllowanceConfig, 'position'>,
    value: number
  ) => {
    setConfig((prev) => {
      const currentPosConfig = prev.positionAllowances[pos] || {
        position: pos,
        responsibilityAllowance: 0,
        cleanRoomAllowance: 0,
        developmentAllowance: 0,
        seniorityAllowance: 0,
        skillAllowance: 0,
        languageSupport: 0,
        diligenceBonus: 0,
        transportSupport: 0,
        housingSupport: 0,
        positionTitleAllowance: 0,
      };

      const next = {
        ...prev,
        positionAllowances: {
          ...prev.positionAllowances,
          [pos]: {
            ...currentPosConfig,
            [field]: value,
          },
        },
      };
      // Cập nhật ref ngay trong setter để commitAllowance (onBlur) đọc được giá trị mới
      configRef.current = next;
      return next;
    });
  };

  // Lưu ngay khi rời ô (blur) hoặc nhấn Enter hoặc bấm nút Lưu
  const commitAllowance = () => {
    if (!canEdit) return;
    updateSalaryConfig(configRef.current);
    showToast('Đã lưu thành công cấu hình phụ cấp theo vị trí!', 'success');
  };

  const handleClearAllowances = () => {
    if (!canEdit) return;
    const emptyAllowances: Record<Position, PositionAllowanceConfig> = {
      'S. Manager': { position: 'S. Manager', responsibilityAllowance: 0, cleanRoomAllowance: 0, positionTitleAllowance: 0, developmentAllowance: 0, seniorityAllowance: 0, skillAllowance: 0, languageSupport: 0, diligenceBonus: 0, transportSupport: 0, housingSupport: 0 },
      'Manager': { position: 'Manager', responsibilityAllowance: 0, cleanRoomAllowance: 0, positionTitleAllowance: 0, developmentAllowance: 0, seniorityAllowance: 0, skillAllowance: 0, languageSupport: 0, diligenceBonus: 0, transportSupport: 0, housingSupport: 0 },
      'Senior Staff': { position: 'Senior Staff', responsibilityAllowance: 0, cleanRoomAllowance: 0, positionTitleAllowance: 0, developmentAllowance: 0, seniorityAllowance: 0, skillAllowance: 0, languageSupport: 0, diligenceBonus: 0, transportSupport: 0, housingSupport: 0 },
      'Leader': { position: 'Leader', responsibilityAllowance: 0, cleanRoomAllowance: 0, positionTitleAllowance: 0, developmentAllowance: 0, seniorityAllowance: 0, skillAllowance: 0, languageSupport: 0, diligenceBonus: 0, transportSupport: 0, housingSupport: 0 },
      'Staff': { position: 'Staff', responsibilityAllowance: 0, cleanRoomAllowance: 0, positionTitleAllowance: 0, developmentAllowance: 0, seniorityAllowance: 0, skillAllowance: 0, languageSupport: 0, diligenceBonus: 0, transportSupport: 0, housingSupport: 0 },
      'OP': { position: 'OP', responsibilityAllowance: 0, cleanRoomAllowance: 0, positionTitleAllowance: 0, developmentAllowance: 0, seniorityAllowance: 0, skillAllowance: 0, languageSupport: 0, diligenceBonus: 0, transportSupport: 0, housingSupport: 0 },
    };
    const nextConfig = { ...config, positionAllowances: emptyAllowances };
    setConfig(nextConfig);
    configRef.current = nextConfig;
    updateSalaryConfig(nextConfig);
    showToast('Đã xóa toàn bộ phụ cấp mặc định! Bạn có thể tự điền 1 lần rồi lưu lại.');
  };

  return (
    <div className="space-y-[2mm]">

      <form onSubmit={handleSave} className="space-y-[2mm]">
        {/* EPCC (unify-settings-cards-into-one) — FIX ROOT CAUSE "3 card (header, nhập tay bổ
            sung, tham số hệ thống) đứng tách rời, mắt phải nhảy qua nhiều khung viền khác nhau
            gây rối UX": theo yêu cầu, gộp cả 3 vào MỘT card duy nhất, phân tách bằng
            `divide-y` (đường kẻ ngang mảnh) thay vì viền/bóng riêng từng khối — vẫn giữ nguyên
            100% logic/field, chỉ đổi cách trình bày. */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700 overflow-hidden">
          {/* Section 1: Header + nút lưu tất cả */}
          <div className="px-4 py-2.5 bg-slate-50/70 dark:bg-slate-900/40 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Settings className="w-4 h-4 text-blue-600" />
              Cấu Hình Tham Số Tính Lương, Phụ Cấp & Khấu Trừ
            </h2>

          {canEdit && (
            <button
              type="submit"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-1.5 rounded-lg shadow-sm transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Lưu tất cả cấu hình</span>
            </button>
          )}
        </div>

        {/* Section 2: Chọn Nhân viên / Vị trí / Tháng / Năm — gộp thành 1 hàng gọn theo yêu cầu */}
        <div className="px-4 py-2 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs items-center">
            <div className="flex items-center gap-1.5">
              <label className="text-slate-700 dark:text-slate-300 font-bold shrink-0 text-[11px]">Nhân viên:</label>
              {!isSuperAdmin && !isVP && !isKHO ? (
                <div className="w-full px-2 py-1 text-[11px] bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 rounded text-emerald-800 dark:text-emerald-200 font-bold flex items-center gap-1 truncate">
                  <span>🔒</span>
                  <span className="truncate">{manualEmp.id} - {manualEmp.fullName}</span>
                </div>
              ) : (
                <select
                  value={manualEmpId}
                  onChange={(e) => {
                    setManualEmpId(e.target.value);
                    const selected = visibleEmployees.find((emp) => emp.id === e.target.value);
                    if (selected) {
                      setPositionFilter(selected.position);
                    }
                  }}
                  className="w-full px-1.5 py-1 text-[11px] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 font-bold cursor-pointer"
                >
                  {visibleEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.id} - {emp.fullName} ({emp.position})</option>
                  ))}
                </select>
              )}
            </div>

            {/* EPCC (position-selector-next-to-employee) — cột chọn vị trí ngay cạnh Nhân
                viên: mặc định đồng bộ theo vị trí của NV đang chọn, nhưng có thể tự chọn
                vị trí khác để lọc bảng phụ cấp bên dưới mà không cần đổi nhân viên. */}
            <div className="flex items-center gap-1.5">
              <label className="text-slate-700 dark:text-slate-300 font-bold shrink-0 text-[11px]">Vị trí:</label>
              {!isSuperAdmin && !isVP && !isKHO ? (
                <div className="w-full px-2 py-1 text-[11px] bg-purple-50 dark:bg-purple-950/50 border border-purple-300 dark:border-purple-700 rounded text-purple-800 dark:text-purple-200 font-bold">
                  {manualEmp.position}
                </div>
              ) : (
                <select
                  value={positionFilter}
                  onChange={(e) => setPositionFilter(e.target.value as Position | '')}
                  className="w-full px-1.5 py-1 text-[11px] bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 rounded text-purple-700 dark:text-purple-300 font-bold cursor-pointer"
                >
                  <option value="">Tất cả</option>
                  {positions.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <label className="text-slate-700 dark:text-slate-300 font-bold shrink-0 text-[11px]">Tháng:</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full px-1.5 py-1 text-[11px] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 font-bold cursor-pointer"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>Tháng {m}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-slate-700 dark:text-slate-300 font-bold shrink-0 text-[11px]">Năm:</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full px-1.5 py-1 text-[11px] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 font-bold cursor-pointer"
              >
                {[selectedYear - 1, selectedYear, selectedYear + 1].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Tham số hệ thống — 2 cột chia đường kẻ dọc */}
        <div className="px-4 py-2.5 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-700">
          {/* Left: Định mức công chuẩn & hệ số OT + Nhập tay bổ sung */}
          <div className="space-y-0.5 md:pr-6">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <Percent className="w-3.5 h-3.5 text-blue-600" />
              Định Mức Công Chuẩn &amp; Hệ Số Tăng Ca (OT)
            </h3>
            {([
              { label: 'Số ngày công chuẩn/tháng', value: config.standardWorkDaysPerMonth, step: 1,
                onChange: (v: number) => setConfig({ ...config, standardWorkDaysPerMonth: v }) },
              { label: 'Số giờ làm chuẩn/ngày', value: config.standardHoursPerDay, step: 1,
                onChange: (v: number) => setConfig({ ...config, standardHoursPerDay: v }) },
              { label: 'Hệ số OT ngày thường (%)', value: config.otRate * 100, step: 0.1,
                onChange: (v: number) => setConfig({ ...config, otRate: v / 100 }) },
              { label: 'Hệ số ca đêm (%)', value: config.nightShiftRate * 100, step: 0.1,
                onChange: (v: number) => setConfig({ ...config, nightShiftRate: v / 100 }) },
              { label: 'Hệ số Chủ Nhật (%)', value: config.sundayRate * 100, step: 0.1,
                onChange: (v: number) => setConfig({ ...config, sundayRate: v / 100 }) },
              { label: 'Hệ số Ngày Lễ (%)', value: config.holidayRate * 100, step: 0.1,
                onChange: (v: number) => setConfig({ ...config, holidayRate: v / 100 }) },
              { label: 'Trợ cấp phụ nữ (%)', value: config.femaleSupportRate * 100, step: 0.1,
                onChange: (v: number) => setConfig({ ...config, femaleSupportRate: v / 100 }) },
              { label: 'Tăng ca đêm ngày thường (%)', value: (config.nightOt50Rate ?? 0.5) * 100, step: 0.1,
                onChange: (v: number) => setConfig({ ...config, nightOt50Rate: v / 100 }) },
              { label: 'Tăng ca đêm thông ca (%)', value: (config.nightOt60Rate ?? 0.6) * 100, step: 0.1,
                onChange: (v: number) => setConfig({ ...config, nightOt60Rate: v / 100 }) },
              { label: 'Tăng ca 70% night (%)', value: (config.ot70Rate ?? 0.7) * 100, step: 0.1,
                onChange: (v: number) => setConfig({ ...config, ot70Rate: v / 100 }) },
              { label: 'Tăng ca đêm ngày lễ (%)', value: (config.holidayNightOt90Rate ?? 0.9) * 100, step: 0.1,
                onChange: (v: number) => setConfig({ ...config, holidayNightOt90Rate: v / 100 }) },
            ] as { label: string; value: number; step: number; onChange: (v: number) => void }[]).map(({ label, value, step, onChange }) => (
              <div key={label} className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                <span className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">{label}</span>
                <input
                  type="number"
                  step={step}
                  value={value}
                  onChange={(e) => onChange(Number(e.target.value))}
                  className="w-24 text-right px-1 py-0.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 font-bold"
                />
              </div>
            ))}

            {/* Nhập tay chấm công & phép theo NV/Tháng — nối liền dưới hệ số OT, gỡ tiêu đề dư thừa theo yêu cầu */}
            <div className="pt-1.5 mt-1 border-t border-slate-200 dark:border-slate-700 space-y-0.5">
              <div className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-100 dark:border-slate-700/50">
                <span className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
                  Trợ cấp phụ nữ (giờ) {!manualEmp?.isFemale && <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">(Nam: 0h)</span>}
                </span>
                <input
                  type="number"
                  step="0.5"
                  disabled={!manualEmp?.isFemale}
                  value={manualEmp?.isFemale ? manualFemaleHours : 0}
                  onChange={(e) => manualEmp?.isFemale && setManualFemaleHours(Number(e.target.value))}
                  className={`w-24 text-right px-1 py-0.5 text-xs border border-slate-300 dark:border-slate-700 rounded font-bold ${
                    !manualEmp?.isFemale ? 'bg-slate-200/60 dark:bg-slate-800 text-slate-400 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200'
                  }`}
                />
              </div>

              <div className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-100 dark:border-slate-700/50">
                <span className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">Phép tồn chuyển</span>
                <input
                  type="number"
                  step="1"
                  value={manualTransferredLeave}
                  onChange={(e) => setManualTransferredLeave(Number(e.target.value))}
                  className="w-24 text-right px-1 py-0.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 font-bold"
                />
              </div>

              <div className="flex items-center justify-between gap-2 py-0.5">
                <span className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">Số ngày nghỉ không phép</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="1"
                    min={0}
                    value={manualUnauthorizedAbsence}
                    onChange={(e) => setManualUnauthorizedAbsence(Number(e.target.value))}
                    className="w-24 text-right px-1 py-0.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 font-bold"
                  />
                  {manualUnauthorizedAbsence > 0 && (
                    <span className="text-[9px] text-rose-600 dark:text-rose-400 font-semibold shrink-0">(Cắt chuyên cần)</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Bảo hiểm + Thuế TNCN + Khấu trừ nhập tay */}
          <div className="space-y-0.5 md:pl-6 pt-3 md:pt-0">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              Tỷ Lệ Khấu Trừ Bảo Hiểm &amp; Đoàn Phí
            </h3>

            {([
              { label: 'Trích BHXH người lao động (%)', value: config.bhxhRate * 100, step: 0.1,
                onChange: (v: number) => setConfig({ ...config, bhxhRate: v / 100 }) },
              { label: 'Trích BHYT người lao động (%)', value: config.bhytRate * 100, step: 0.1,
                onChange: (v: number) => setConfig({ ...config, bhytRate: v / 100 }) },
              { label: 'Trích BHTN người lao động (%)', value: config.bhtnRate * 100, step: 0.1,
                onChange: (v: number) => setConfig({ ...config, bhtnRate: v / 100 }) },
              { label: `Đoàn phí Công đoàn (VNĐ) = ${formatVND(config.unionFeeFlat)}`, value: config.unionFeeFlat, isVnd: true,
                onChange: (v: number) => setConfig({ ...config, unionFeeFlat: v }) },
            ] as { label: string; value: number; onChange: (v: number) => void; isVnd?: boolean }[]).map(({ label, value, onChange, isVnd }) => (
              <div key={label} className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                <span className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">{label}</span>
                {isVnd ? (
                  <FormattedNumberInput
                    value={value}
                    onChange={onChange}
                    className="w-24 text-right px-1 py-0.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 font-bold"
                  />
                ) : (
                  <input
                    type="number"
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="w-24 text-right px-1 py-0.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 font-bold"
                  />
                )}
              </div>
            ))}

            {/* Thuế TNCN */}
            <div className="pt-2 mt-1 border-t border-slate-200 dark:border-slate-700">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <Receipt className="w-3 h-3 text-amber-600" />
                Thuế TNCN (Biểu thuế lũy tiến từng phần)
              </h4>

              {/* Dòng Số người phụ thuộc trừ thuế */}
              <div className="flex items-center justify-between gap-2 py-1.5 px-2 mb-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/80 rounded-lg shadow-sm">
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-amber-950 dark:text-amber-200 leading-tight flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    Số người phụ thuộc trừ thuế ({manualEmp?.fullName || manualEmpId})
                  </span>
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">
                    Mức giảm trừ NPT: {manualDependents} × {formatVND(config.dependentDeductionAmount ?? 4_400_000)} = <strong className="text-amber-900 dark:text-amber-200">{formatVND(manualDependents * (config.dependentDeductionAmount ?? 4_400_000))}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={manualDependents}
                    onChange={(e) => {
                      const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                      setManualDependents(val);
                      updateAttendanceManualOverrides(manualEmpId, { manualNumberOfDependents: val });
                      if (manualEmp && updateEmployee) {
                        updateEmployee({ ...manualEmp, numberOfDependents: val, dependentsCount: val });
                      }
                    }}
                    className="w-16 text-center px-1 py-1 text-xs bg-white dark:bg-slate-900 border-2 border-amber-400 dark:border-amber-600 rounded-md text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">người</span>
                </div>
              </div>

              {([
                { label: `Giảm trừ bản thân (VNĐ) = ${formatVND(config.personalDeductionAmount ?? 15_500_000)}`,
                  value: config.personalDeductionAmount ?? 15_500_000,
                  onChange: (v: number) => setConfig({ ...config, personalDeductionAmount: v }) },
                { label: `Giảm trừ người phụ thuộc (VNĐ) = ${formatVND(config.dependentDeductionAmount ?? 6_200_000)}`,
                  value: config.dependentDeductionAmount ?? 6_200_000,
                  onChange: (v: number) => setConfig({ ...config, dependentDeductionAmount: v }) },
              ] as { label: string; value: number; onChange: (v: number) => void }[]).map(({ label, value, onChange }) => (
                <div key={label} className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                  <span className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">{label}</span>
                  <FormattedNumberInput
                    value={value}
                    onChange={onChange}
                    className="w-24 text-right px-1 py-0.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 font-bold"
                  />
                </div>
              ))}

              {/* Banner liên kết công thức giảm trừ gia cảnh & thuế tự tính */}
              <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-900/60 rounded-md border border-slate-200 dark:border-slate-700 text-[10.5px] text-slate-600 dark:text-slate-300 space-y-1">
                <div className="flex justify-between items-center">
                  <span>Tổng giảm trừ gia cảnh ({manualEmp?.fullName || manualEmpId}):</span>
                  <strong className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                    {formatVND((config.personalDeductionAmount ?? 15_500_000) + manualDependents * (config.dependentDeductionAmount ?? 6_200_000))}
                  </strong>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-[10px] text-slate-500 dark:text-slate-400">
                  <span>Công thức liên kết:</span>
                  <span>{formatVND(config.personalDeductionAmount ?? 15_500_000)} + ({manualDependents} × {formatVND(config.dependentDeductionAmount ?? 6_200_000)})</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                <label className="flex items-center gap-1.5 text-[11px] text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    id="pitExemptHousing"
                    type="checkbox"
                    checked={config.pitExemptHousingSupport === true}
                    onChange={(e) => setConfig({ ...config, pitExemptHousingSupport: e.target.checked })}
                    className="w-3.5 h-3.5 accent-blue-600"
                  />
                  Miễn thuế Hỗ trợ nhà ở
                </label>
                <label className="flex items-center gap-1.5 text-[11px] text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    id="pitExemptLanguage"
                    type="checkbox"
                    checked={config.pitExemptLanguageSupport === true}
                    onChange={(e) => setConfig({ ...config, pitExemptLanguageSupport: e.target.checked })}
                    className="w-3.5 h-3.5 accent-blue-600"
                  />
                  Miễn thuế Hỗ trợ tiếng
                </label>
              </div>
            </div>

            {/* Khấu trừ nhập tay theo NV/Tháng */}
            <div className="pt-2 mt-1 border-t border-slate-200 dark:border-slate-700 space-y-0.5">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <Receipt className="w-3.5 h-3.5 text-rose-600" />
                Khấu Trừ Nhập Tay (NV Đang Chọn)
              </h4>

              <div className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-100 dark:border-slate-700/50">
                <span className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">Thuế TNCN (để trống = tự tính)</span>
                <div className="flex items-center gap-1">
                  <FormattedNumberInput
                    value={manualTax ? Number(manualTax) : 0}
                    onChange={(v) => setManualTax(v === 0 ? '' : String(v))}
                    placeholder={currentManualPayslip ? formatVND(currentManualPayslip.pitAutoCalculated) : ''}
                    className="w-24 text-right px-1 py-0.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 font-bold"
                  />
                  {manualAttendanceRecord?.manualPersonalTax != null && (
                    <button
                      type="button"
                      onClick={handleResetTaxToAuto}
                      className="shrink-0 px-1 py-0.5 text-[9px] font-semibold text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-700 rounded hover:bg-sky-50 dark:hover:bg-sky-950/40"
                    >
                      Tự động
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-100 dark:border-slate-700/50">
                <span className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">Truy thu BHYT</span>
                <FormattedNumberInput
                  value={manualArrears}
                  onChange={(v) => setManualArrears(v)}
                  className="w-24 text-right px-1 py-0.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 font-bold"
                />
              </div>

              <div className="flex items-center justify-between gap-2 py-0.5">
                <span className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">Trừ khác</span>
                <FormattedNumberInput
                  value={manualOtherDeduction}
                  onChange={(v) => setManualOtherDeduction(v)}
                  className="w-24 text-right px-1 py-0.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 font-bold"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Position Allowances Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-x-auto p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Award className="w-4 h-4 text-purple-600" />
            {selectedEmpPosition
              ? <>Cấu Hình Phụ Cấp Theo Vị Trí / Chức Danh — Đang xem: {selectedEmpPosition}</>
              : <>Cấu Hình Phụ Cấp Theo Vị Trí / Chức Danh (S. Manager, Manager, Senior Staff, Leader, Staff, OP)</>}
          </h3>
          {canEdit && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={commitAllowance}
                className="shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu cấu hình phụ cấp</span>
              </button>
            </div>
          )}
        </div>

        {/* EPCC (allowance-table-view-permission) — nhắc rõ vì sao bảng bị thu hẹp, tránh
            hiểu lầm là bug mất dữ liệu khi Leader/User chỉ thấy 1-2 dòng thay vì đủ 6. */}
        {!isSuperAdmin && activeRole !== 'Admin' && (
          <div className="mb-3 text-xs rounded-lg p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300">
            {viewerPosition
              ? <>Chỉ hiện phụ cấp của các vị trí bạn được phân quyền xem (vị trí của bạn: <strong>{viewerPosition}</strong>). Admin có thể mở rộng quyền này ở mục "Phân quyền xem Bảng lương theo vị trí" bên dưới.</>
              : <>Chưa xác định được vị trí của bạn (vào tab Điểm danh, chọn tên mình và Lưu điểm danh 1 lần trên thiết bị này) nên bảng phụ cấp đang không hiện vị trí nào.</>}
          </div>
        )}

        {/* EPCC (allowance-table-filter-by-selected-employee) — thêm 1 lớp lọc nữa theo
            nhân viên đang chọn ở mục "Nhân viên" phía trên: dù được phân quyền xem nhiều vị
            trí, bảng vẫn chỉ hiện đúng 1 dòng khớp vị trí của nhân viên đó. */}
        {selectedEmpPosition && filteredAllowancePositions.length === 0 && (
          <div className="mb-3 text-xs rounded-lg p-2 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300">
            Nhân viên <strong>{manualEmp?.fullName}</strong> thuộc vị trí <strong>{selectedEmpPosition}</strong> nhưng bạn chưa được phân quyền xem phụ cấp của vị trí này.
          </div>
        )}

        <table className="w-full text-xs text-left border-collapse table-fixed">
          <thead className="bg-[#122842] text-white uppercase text-[11.5px] font-bold">
            <tr>
              <th className="py-1 px-1.5 border-r border-slate-700/60 w-20 leading-tight whitespace-normal break-words">Vị trí</th>
              <th className="py-1 px-1.5 border-r border-slate-700/60 w-20 leading-tight whitespace-normal break-words">PC Trách nhiệm</th>
              <th className="py-1 px-1.5 border-r border-slate-700/60 w-20 leading-tight whitespace-normal break-words">PC Phòng sạch</th>
              <th className="py-1 px-1.5 border-r border-slate-700/60 w-20 leading-tight whitespace-normal break-words">Chức vụ</th>
              <th className="py-1 px-1.5 border-r border-slate-700/60 w-20 leading-tight whitespace-normal break-words">PC Phát triển</th>
              <th className="py-1 px-1.5 border-r border-slate-700/60 w-20 leading-tight whitespace-normal break-words">PC Thâm niên</th>
              <th className="py-1 px-1.5 border-r border-slate-700/60 w-20 leading-tight whitespace-normal break-words">PC Kỹ năng</th>
              <th className="py-1 px-1.5 border-r border-slate-700/60 w-20 leading-tight whitespace-normal break-words">Hỗ trợ tiếng</th>
              <th className="py-1 px-1.5 border-r border-slate-700/60 w-20 leading-tight whitespace-normal break-words">Thưởng chuyên cần</th>
              <th className="py-1 px-1.5 border-r border-slate-700/60 w-20 leading-tight whitespace-normal break-words">Hỗ trợ giao thông</th>
              <th className="py-1 px-1.5 w-20 leading-tight whitespace-normal break-words">Hỗ trợ nhà ở</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 font-medium">
            {filteredAllowancePositions.map((pos) => {
              const posConfig = config.positionAllowances[pos] || {
                position: pos,
                responsibilityAllowance: 0,
                cleanRoomAllowance: 0,
                developmentAllowance: 0,
                seniorityAllowance: 0,
                skillAllowance: 0,
                languageSupport: 0,
                diligenceBonus: 0,
                transportSupport: 0,
                housingSupport: 0,
                positionTitleAllowance: 0,
              };

              return (
                <tr key={pos} className="hover:bg-blue-50/50 dark:hover:bg-slate-700/50">
                  <td className="py-1 px-1.5 font-bold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-900/50 text-[11px] truncate border-r border-slate-200 dark:border-slate-700">
                    {pos}
                  </td>
                  <td className="py-1 px-1 border-r border-slate-200 dark:border-slate-700">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={fmtNum(posConfig.responsibilityAllowance)}
                      onChange={(e) => handlePositionAllowanceChange(pos, 'responsibilityAllowance', parseNum(e.target.value))}
                      onBlur={commitAllowance}
                      onKeyDown={(e) => e.key === 'Enter' && commitAllowance()}
                      className="w-full px-1 py-1 text-center text-[11px] bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    />
                  </td>
                  <td className="py-1 px-1 border-r border-slate-200 dark:border-slate-700">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={fmtNum(posConfig.cleanRoomAllowance)}
                      onChange={(e) => handlePositionAllowanceChange(pos, 'cleanRoomAllowance', parseNum(e.target.value))}
                      onBlur={commitAllowance}
                      onKeyDown={(e) => e.key === 'Enter' && commitAllowance()}
                      className="w-full px-1 py-1 text-center text-[11px] bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    />
                  </td>
                  <td className="py-1 px-1 border-r border-slate-200 dark:border-slate-700">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={fmtNum(posConfig.positionTitleAllowance ?? 0)}
                      onChange={(e) => handlePositionAllowanceChange(pos, 'positionTitleAllowance', parseNum(e.target.value))}
                      onBlur={commitAllowance}
                      onKeyDown={(e) => e.key === 'Enter' && commitAllowance()}
                      className="w-full px-1 py-1 text-center text-[11px] bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    />
                  </td>
                  <td className="py-1 px-1 border-r border-slate-200 dark:border-slate-700">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={fmtNum(posConfig.developmentAllowance)}
                      onChange={(e) => handlePositionAllowanceChange(pos, 'developmentAllowance', parseNum(e.target.value))}
                      onBlur={commitAllowance}
                      onKeyDown={(e) => e.key === 'Enter' && commitAllowance()}
                      className="w-full px-1 py-1 text-center text-[11px] bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    />
                  </td>
                  <td className="py-1 px-1 border-r border-slate-200 dark:border-slate-700">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={fmtNum(posConfig.seniorityAllowance ?? 0)}
                      onChange={(e) => handlePositionAllowanceChange(pos, 'seniorityAllowance', parseNum(e.target.value))}
                      onBlur={commitAllowance}
                      onKeyDown={(e) => e.key === 'Enter' && commitAllowance()}
                      className="w-full px-1 py-1 text-center text-[11px] bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    />
                  </td>
                  <td className="py-1 px-1 border-r border-slate-200 dark:border-slate-700">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={fmtNum(posConfig.skillAllowance ?? 0)}
                      onChange={(e) => handlePositionAllowanceChange(pos, 'skillAllowance', parseNum(e.target.value))}
                      onBlur={commitAllowance}
                      onKeyDown={(e) => e.key === 'Enter' && commitAllowance()}
                      className="w-full px-1 py-1 text-center text-[11px] bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    />
                  </td>
                  <td className="py-1 px-1 border-r border-slate-200 dark:border-slate-700">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={fmtNum(posConfig.languageSupport ?? 0)}
                      onChange={(e) => handlePositionAllowanceChange(pos, 'languageSupport', parseNum(e.target.value))}
                      onBlur={commitAllowance}
                      onKeyDown={(e) => e.key === 'Enter' && commitAllowance()}
                      className="w-full px-1 py-1 text-center text-[11px] bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    />
                  </td>
                  <td className="py-1 px-1 border-r border-slate-200 dark:border-slate-700">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={fmtNum(posConfig.diligenceBonus)}
                      onChange={(e) => handlePositionAllowanceChange(pos, 'diligenceBonus', parseNum(e.target.value))}
                      onBlur={commitAllowance}
                      onKeyDown={(e) => e.key === 'Enter' && commitAllowance()}
                      className="w-full px-1 py-1 text-center text-[11px] bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    />
                  </td>
                  <td className="py-1 px-1 border-r border-slate-200 dark:border-slate-700">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={fmtNum(posConfig.transportSupport)}
                      onChange={(e) => handlePositionAllowanceChange(pos, 'transportSupport', parseNum(e.target.value))}
                      onBlur={commitAllowance}
                      onKeyDown={(e) => e.key === 'Enter' && commitAllowance()}
                      className="w-full px-1 py-1 text-center text-[11px] bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    />
                  </td>
                  <td className="py-1 px-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={fmtNum(posConfig.housingSupport)}
                      onChange={(e) => handlePositionAllowanceChange(pos, 'housingSupport', parseNum(e.target.value))}
                      onBlur={commitAllowance}
                      onKeyDown={(e) => e.key === 'Enter' && commitAllowance()}
                      className="w-full px-1 py-1 text-center text-[11px] bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </form>
  </div>
  );
};
