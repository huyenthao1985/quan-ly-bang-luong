import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { INITIAL_EMPLOYEES, INITIAL_SALARY_CONFIG, SAMPLE_USERS } from '../data/initialData';
import {
  Employee,
  EmployeeAttendanceRecord,
  SalaryConfig,
  User,
  UserRole,
  Position,
  PayrollViewPermissions,
  buildDefaultPayrollViewPermissions,
} from '../types/payroll';
import { isSupabaseEnabled } from '../lib/supabase';
import {
  fetchEmployees,
  fetchAttendanceRecords,
  fetchSalaryConfig,
  upsertEmployee,
  upsertEmployees,
  deleteEmployeeFromDb,
  upsertAttendanceRecord,
  upsertSalaryConfig,
  fetchPayrollViewPermissions,
  upsertPayrollViewPermissions,
} from '../lib/supabaseHelpers';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface PayrollContextType {
  employees: Employee[];
  salaryConfig: SalaryConfig;
  // EPCC (payroll-view-permission-matrix) — ma trận phân quyền xem Bảng lương theo vị trí,
  // chỉ Admin được sửa (xem updatePayrollViewPermissions). viewerPosition là vị trí THẬT
  // của currentUser, suy ra từ Employee gắn với currentUser.employeeId — không phải chọn tay.
  payrollViewPermissions: PayrollViewPermissions;
  viewerPosition: Position | undefined;
  // EPCC (checkin-sets-viewer-identity) — id nhân viên vừa tự điểm danh gần nhất trên
  // thiết bị/trình duyệt này. Dùng làm fallback để suy ra viewerPosition khi currentUser
  // (role demo Admin/Leader/User) chưa gắn employeeId cụ thể — xem AttendanceTab.doSave().
  lastCheckedInEmployeeId: string | undefined;
  setLastCheckedInEmployeeId: (employeeId: string) => void;
  attendanceRecords: Record<string, EmployeeAttendanceRecord>; // key: `${employeeId}_${year}_${month}`
  currentUser: User;
  activeRole: UserRole;
  theme: 'light' | 'dark';
  selectedMonth: number;
  selectedYear: number;
  activeTab: string;
  toasts: ToastMessage[];
  isDbLoading: boolean; // true khi đang fetch data từ Supabase lần đầu

  // Actions
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  setActiveRole: (role: UserRole) => void;
  setSelectedMonth: (month: number) => void;
  setSelectedYear: (year: number) => void;
  setActiveTab: (tab: string) => void;

  // Employee CRUD
  addEmployee: (emp: Omit<Employee, 'id'> & { id?: string }) => void;
  updateEmployee: (emp: Employee) => void;
  deleteEmployee: (id: string) => void;
  seedSampleData: () => void;

  // Attendance
  updateAttendanceDay: (
    employeeId: string,
    dateStr: string,
    field: string,
    value: number | string | boolean
  ) => void;
  updateAttendanceManualOverrides: (
    employeeId: string,
    overrides: Partial<EmployeeAttendanceRecord>
  ) => void;
  quickFillAttendanceMonth: (employeeId?: string) => void;

  // Configs
  updateSalaryConfig: (newConfig: SalaryConfig) => void;
  updatePayrollViewPermissions: (next: PayrollViewPermissions) => void;

  // Toasts
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
}

const PayrollContext = createContext<PayrollContextType | undefined>(undefined);

export const PayrollProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // ─── Local state (khởi tạo từ localStorage trước, sau đó đồng bộ với Supabase) ───
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem('payroll_employees');
    const raw: Employee[] = saved ? JSON.parse(saved) : INITIAL_EMPLOYEES;
    return raw.filter(e => e.id !== '33010452' && e.id !== '33010453' && e.id !== '330104531');
  });

  const [salaryConfig, setSalaryConfig] = useState<SalaryConfig>(() => {
    const saved = localStorage.getItem('payroll_config');
    return saved ? JSON.parse(saved) : INITIAL_SALARY_CONFIG;
  });

  // EPCC (payroll-view-permission-matrix) — state ma trận phân quyền xem Bảng lương, theo
  // đúng pattern khởi tạo từ localStorage như salaryConfig ở trên.
  const [payrollViewPermissions, setPayrollViewPermissions] = useState<PayrollViewPermissions>(() => {
    const saved = localStorage.getItem('payroll_view_permissions');
    return saved ? JSON.parse(saved) : buildDefaultPayrollViewPermissions();
  });

  // EPCC (checkin-sets-viewer-identity) — nhớ nhân viên vừa tự điểm danh gần nhất TRÊN
  // THIẾT BỊ NÀY (localStorage, không phải Supabase — đây là danh tính "ai đang cầm máy
  // này", không phải dữ liệu chung của công ty). Dùng làm fallback cho viewerPosition khi
  // chưa có hệ thống đăng nhập thật theo từng nhân viên.
  const [lastCheckedInEmployeeId, setLastCheckedInEmployeeIdState] = useState<string | undefined>(() => {
    return localStorage.getItem('payroll_last_checkin_employee_id') || undefined;
  });

  const setLastCheckedInEmployeeId = (employeeId: string) => {
    setLastCheckedInEmployeeIdState(employeeId);
    localStorage.setItem('payroll_last_checkin_employee_id', employeeId);
  };

  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, EmployeeAttendanceRecord>>(() => {
    const saved = localStorage.getItem('payroll_attendance');
    const raw: Record<string, EmployeeAttendanceRecord> = saved ? JSON.parse(saved) : {};
    const cleaned: Record<string, EmployeeAttendanceRecord> = {};
    for (const [key, val] of Object.entries(raw)) {
      if (!key.startsWith('33010452') && !key.startsWith('33010453')) {
        cleaned[key] = val;
      }
    }
    return cleaned;
  });

  const [activeRole, setActiveRole] = useState<UserRole>('Admin');
  const [currentUser, setCurrentUser] = useState<User>(SAMPLE_USERS[0]);

  // EPCC (checkin-sets-viewer-identity) — vị trí THẬT của người đang dùng app: ưu tiên
  // hồ sơ gắn với currentUser.employeeId (nếu Admin đã cấu hình User/Leader mẫu có sẵn
  // employeeId cụ thể); nếu chưa có, fallback sang employeeId của người VỪA TỰ ĐIỂM DANH
  // gần nhất trên thiết bị này (lastCheckedInEmployeeId, set ở AttendanceTab.doSave()) —
  // theo đúng yêu cầu "điểm danh xong thì mặc định ở vị trí đó".
  const viewerEmployeeId = currentUser.employeeId || lastCheckedInEmployeeId;
  const viewerPosition = employees.find((e) => e.id === viewerEmployeeId)?.position;

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('payroll_theme');
    return (saved as 'light' | 'dark') || 'light';
  });

  const [selectedMonth, setSelectedMonth] = useState<number>(8);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [activeTab, setActiveTab] = useState<string>('employees');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  /**
   * isDbLoaded: true sau khi fetch Supabase hoàn tất (hoặc Supabase disabled).
   * Ngăn các sync effects ghi dữ liệu cũ (localStorage) lên Supabase trước khi load xong.
   */
  const [isDbLoaded, setIsDbLoaded] = useState(!isSupabaseEnabled);
  const [isDbLoading, setIsDbLoading] = useState(isSupabaseEnabled);

  // Ref để track thay đổi attendance đơn lẻ (tránh upsert toàn bộ mỗi lần)
  const changedAttendanceKeys = useRef<Set<string>>(new Set());

  // ─── Phase 1: Fetch dữ liệu từ Supabase khi mount ───────────────────────────
  useEffect(() => {
    if (!isSupabaseEnabled) return;

    const loadFromSupabase = async () => {
      setIsDbLoading(true);
      try {
        const [remoteEmployees, remoteAttendance, remoteConfig, remotePermissions] = await Promise.all([
          fetchEmployees(),
          fetchAttendanceRecords(),
          fetchSalaryConfig(),
          fetchPayrollViewPermissions(),
        ]);

        // Employees: nếu Supabase trống → seed từ localStorage (migration lần đầu)
        if (remoteEmployees !== null) {
          if (remoteEmployees.length === 0) {
            // Supabase chưa có dữ liệu — migrate từ localStorage
            const localData = employees.filter(e =>
              e.id !== '33010452' && e.id !== '33010453' && e.id !== '330104531'
            );
            await upsertEmployees(localData);
            console.info('[Supabase] Đã migrate employees từ localStorage lên cloud.');
          } else {
            setEmployees(remoteEmployees.filter(e =>
              e.id !== '33010452' && e.id !== '33010453' && e.id !== '330104531'
            ));
          }
        }

        // Attendance: nếu Supabase trống → migrate từ localStorage
        if (remoteAttendance !== null) {
          if (Object.keys(remoteAttendance).length === 0 && Object.keys(attendanceRecords).length > 0) {
            for (const [key, record] of Object.entries(attendanceRecords) as [string, EmployeeAttendanceRecord][]) {
              await upsertAttendanceRecord(key, record);
            }
            console.info('[Supabase] Đã migrate attendance từ localStorage lên cloud.');
          } else if (Object.keys(remoteAttendance).length > 0) {
            setAttendanceRecords(remoteAttendance);
          }
        }

        // Salary config: nếu Supabase trống → migrate từ localStorage
        if (remoteConfig !== null) {
          setSalaryConfig(remoteConfig);
        } else {
          await upsertSalaryConfig(salaryConfig);
          console.info('[Supabase] Đã migrate salaryConfig từ localStorage lên cloud.');
        }

        // EPCC (payroll-view-permission-matrix) — phân quyền xem Bảng lương: nếu Supabase
        // trống → migrate từ localStorage, theo đúng pattern salaryConfig ở trên.
        if (remotePermissions !== null) {
          setPayrollViewPermissions(remotePermissions);
        } else {
          await upsertPayrollViewPermissions(payrollViewPermissions);
          console.info('[Supabase] Đã migrate payrollViewPermissions từ localStorage lên cloud.');
        }
      } catch (err) {
        console.error('[Supabase] Lỗi khi load dữ liệu, dùng localStorage fallback:', err);
      } finally {
        setIsDbLoaded(true);
        setIsDbLoading(false);
      }
    };

    loadFromSupabase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Chỉ chạy một lần khi mount

  // ─── Phase 2: Sync state → localStorage (luôn chạy) ────────────────────────
  useEffect(() => {
    localStorage.setItem('payroll_employees', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('payroll_config', JSON.stringify(salaryConfig));
  }, [salaryConfig]);

  useEffect(() => {
    localStorage.setItem('payroll_view_permissions', JSON.stringify(payrollViewPermissions));
  }, [payrollViewPermissions]);

  useEffect(() => {
    localStorage.setItem('payroll_attendance', JSON.stringify(attendanceRecords));
  }, [attendanceRecords]);

  useEffect(() => {
    localStorage.setItem('payroll_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    const matchedUser = SAMPLE_USERS.find((u) => u.role === activeRole) || SAMPLE_USERS[0];
    setCurrentUser(matchedUser);
  }, [activeRole]);

  // ─── Phase 3: Sync state → Supabase (chỉ sau khi đã load xong) ─────────────
  useEffect(() => {
    if (!isDbLoaded || !isSupabaseEnabled) return;
    upsertSalaryConfig(salaryConfig);
  }, [salaryConfig, isDbLoaded]);

  useEffect(() => {
    if (!isDbLoaded || !isSupabaseEnabled) return;
    upsertPayrollViewPermissions(payrollViewPermissions);
  }, [payrollViewPermissions, isDbLoaded]);

  // Sync attendance theo key đã thay đổi (hiệu quả hơn upsert toàn bộ)
  useEffect(() => {
    if (!isDbLoaded || !isSupabaseEnabled) return;
    const keys = [...changedAttendanceKeys.current];
    if (keys.length === 0) return;
    changedAttendanceKeys.current.clear();

    for (const key of keys) {
      if (attendanceRecords[key]) {
        upsertAttendanceRecord(key, attendanceRecords[key]);
      }
    }
  }, [attendanceRecords, isDbLoaded]);

  // ─── Toast helpers ───────────────────────────────────────────────────────────
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // ─── Employee CRUD ───────────────────────────────────────────────────────────
  const addEmployee = (newEmp: Omit<Employee, 'id'> & { id?: string }) => {
    const id = newEmp.id || Math.floor(10000000 + Math.random() * 90000000).toString();
    const fullEmp: Employee = { ...newEmp, id };
    setEmployees((prev) => [fullEmp, ...prev]);
    if (isDbLoaded) upsertEmployee(fullEmp);
    showToast(`Đã thêm nhân viên ${fullEmp.fullName} (${fullEmp.id}) thành công!`);
  };

  const updateEmployee = (updated: Employee) => {
    setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    if (isDbLoaded) upsertEmployee(updated);
    showToast(`Đã cập nhật thông tin nhân viên ${updated.fullName}`);
  };

  const deleteEmployee = (id: string) => {
    const target = employees.find((e) => e.id === id);
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    if (isDbLoaded) deleteEmployeeFromDb(id);
    showToast(`Đã xóa nhân viên ${target?.fullName || id}`, 'info');
  };

  const seedSampleData = () => {
    setEmployees(INITIAL_EMPLOYEES);
    setSalaryConfig(INITIAL_SALARY_CONFIG);
    localStorage.removeItem('payroll_attendance');
    setAttendanceRecords({});
    if (isDbLoaded && isSupabaseEnabled) {
      upsertEmployees(INITIAL_EMPLOYEES);
      upsertSalaryConfig(INITIAL_SALARY_CONFIG);
    }
    showToast('Đã nạp dữ liệu mẫu ban đầu thành công!', 'success');
  };

  // ─── Attendance management ───────────────────────────────────────────────────
  const updateAttendanceDay = (
    employeeId: string,
    dateStr: string,
    field: string,
    value: number | string | boolean
  ) => {
    const key = `${employeeId}_${selectedYear}_${selectedMonth}`;
    changedAttendanceKeys.current.add(key);

    setAttendanceRecords((prev) => {
      const existingRecord = prev[key] || {
        employeeId,
        month: selectedMonth,
        year: selectedYear,
        dailyRecords: {},
      };

      const existingDay = existingRecord.dailyRecords[dateStr] || {
        date: dateStr,
        hcHours: 0,
        otHours: 0,
        nightHours: 0,
        sundayHours: 0,
        holidayHours: 0,
        leavePaidDays: 0,
        leaveAnnualDays: 0,
        leaveUnpaidDays: 0,
        femaleSupportHours: 0,
      };

      const updatedDay = {
        ...existingDay,
        [field]: value,
      };

      return {
        ...prev,
        [key]: {
          ...existingRecord,
          dailyRecords: {
            ...existingRecord.dailyRecords,
            [dateStr]: updatedDay,
          },
        },
      };
    });
  };

  const updateAttendanceManualOverrides = (
    employeeId: string,
    overrides: Partial<EmployeeAttendanceRecord>
  ) => {
    const key = `${employeeId}_${selectedYear}_${selectedMonth}`;
    changedAttendanceKeys.current.add(key);

    setAttendanceRecords((prev) => {
      const existingRecord = prev[key] || {
        employeeId,
        month: selectedMonth,
        year: selectedYear,
        dailyRecords: {},
      };

      return {
        ...prev,
        [key]: {
          ...existingRecord,
          ...overrides,
        },
      };
    });
    showToast('Đã lưu các chỉ số nhập tay bổ sung bảng lương!');
  };

  const quickFillAttendanceMonth = (targetEmpId?: string) => {
    const empsToFill = targetEmpId
      ? employees.filter((e) => e.id === targetEmpId)
      : employees;

    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

    setAttendanceRecords((prev) => {
      const nextRecords = { ...prev };

      empsToFill.forEach((emp) => {
        const key = `${emp.id}_${selectedYear}_${selectedMonth}`;
        changedAttendanceKeys.current.add(key);
        const dailyRecords: Record<string, unknown> = {};

        for (let day = 1; day <= daysInMonth; day++) {
          const dayFormatted = day < 10 ? `0${day}` : `${day}`;
          const dateObj = new Date(selectedYear, selectedMonth - 1, day);
          const dayOfWeek = dateObj.getDay();

          const dateStr = `${selectedYear}-${selectedMonth < 10 ? '0' + selectedMonth : selectedMonth}-${dayFormatted}`;

          if (dayOfWeek === 0) {
            const isOT = day === 10 || day === 24;
            dailyRecords[dateStr] = {
              date: dateStr,
              hcHours: 0,
              otHours: 0,
              sundayHours: isOT ? 4 : 0,
              nightHours: 0,
              holidayHours: 0,
              leavePaidDays: 0,
              leaveAnnualDays: 0,
              leaveUnpaidDays: 0,
              femaleSupportHours: 0,
              isManual: true,
              checkIn: isOT ? '08:00' : undefined,
              checkOut: isOT ? '12:00' : undefined,
            };
          } else if (dayOfWeek === 6) {
            dailyRecords[dateStr] = {
              date: dateStr,
              hcHours: 8,
              otHours: day === 15 ? 2 : 0,
              nightHours: 0,
              sundayHours: 0,
              holidayHours: 0,
              leavePaidDays: 0,
              leaveAnnualDays: 0,
              leaveUnpaidDays: 0,
              femaleSupportHours: 0,
              isManual: true,
              checkIn: '07:30',
              checkOut: day === 15 ? '19:00' : '17:00',
            };
          } else {
            const isOTWeekday = day % 3 === 0;
            const isNightDay = emp.position === 'OP' && day === 12;
            dailyRecords[dateStr] = {
              date: dateStr,
              hcHours: 8,
              otHours: isOTWeekday ? 2 : 0,
              nightHours: isNightDay ? 4 : 0,
              sundayHours: 0,
              holidayHours: 0,
              leavePaidDays: 0,
              leaveAnnualDays: day === 5 ? 1 : 0,
              leaveUnpaidDays: 0,
              femaleSupportHours: emp.isFemale && day % 7 === 1 ? 1 : 0,
              isManual: true,
              checkIn: isNightDay ? '20:00' : '07:30',
              checkOut: isNightDay ? '05:00' : (isOTWeekday ? '19:00' : '17:00'),
            };
          }
        }

        nextRecords[key] = {
          employeeId: emp.id,
          month: selectedMonth,
          year: selectedYear,
          dailyRecords: dailyRecords as EmployeeAttendanceRecord['dailyRecords'],
        };
      });

      return nextRecords;
    });

    showToast(`Đã tự động điền chấm công chuẩn cho tháng ${selectedMonth}/${selectedYear}!`);
  };

  const updateSalaryConfig = (newConfig: SalaryConfig) => {
    setSalaryConfig(newConfig);
    showToast('Đã lưu cấu hình phụ cấp và các tham số tính lương!');
  };

  // EPCC (payroll-view-permission-matrix) — lưu ma trận phân quyền xem Bảng lương theo vị trí
  const updatePayrollViewPermissions = (next: PayrollViewPermissions) => {
    setPayrollViewPermissions(next);
    showToast('Đã lưu phân quyền xem Bảng lương theo vị trí!');
  };

  return (
    <PayrollContext.Provider
      value={{
        employees,
        salaryConfig,
        payrollViewPermissions,
        viewerPosition,
        lastCheckedInEmployeeId,
        setLastCheckedInEmployeeId,
        attendanceRecords,
        currentUser,
        activeRole,
        theme,
        selectedMonth,
        selectedYear,
        activeTab,
        toasts,
        isDbLoading,

        setTheme,
        toggleTheme,
        setActiveRole,
        setSelectedMonth,
        setSelectedYear,
        setActiveTab,

        addEmployee,
        updateEmployee,
        deleteEmployee,
        seedSampleData,

        updateAttendanceDay,
        updateAttendanceManualOverrides,
        quickFillAttendanceMonth,

        updateSalaryConfig,
        updatePayrollViewPermissions,

        showToast,
        removeToast,
      }}
    >
      {children}
    </PayrollContext.Provider>
  );
};

export const usePayroll = () => {
  const context = useContext(PayrollContext);
  if (!context) {
    throw new Error('usePayroll must be used within a PayrollProvider');
  }
  return context;
};
