/**
 * supabaseHelpers.ts
 * Mapper functions giữa TypeScript types (camelCase) và Supabase DB rows (snake_case).
 * CRUD helpers cho employees, attendance_records, salary_config.
 */

import { Employee, EmployeeAttendanceRecord, SalaryConfig, PayrollViewPermissions } from '../types/payroll';
import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────
// Mapper: Employee ↔ DB row
// ─────────────────────────────────────────────────────────────

export const employeeToDb = (emp: Employee) => ({
  id:                    emp.id,
  full_name:             emp.fullName,
  birth_date:            emp.birthDate,
  department:            emp.department,
  position:              emp.position,
  start_date:            emp.startDate,
  phone:                 emp.phone,
  is_female:             emp.isFemale,
  base_salary:           emp.baseSalary,
  dependents_count:      emp.dependentsCount,
  contract_type:         emp.contractType ?? null,
  email:                 emp.email ?? null,
  bank_account:          emp.bankAccount ?? null,
  bank_name:             emp.bankName ?? null,
  union_member:          emp.unionMember ?? false,
  insurance_base_salary: emp.insuranceBaseSalary ?? null,
  number_of_dependents:  emp.numberOfDependents ?? null,
  comp_leave_balance:    emp.compLeaveBalance ?? null,
});

export const dbToEmployee = (row: Record<string, unknown>): Employee => ({
  id:                    row.id as string,
  fullName:              row.full_name as string,
  birthDate:             row.birth_date as string,
  department:            row.department as string,
  position:              row.position as Employee['position'],
  startDate:             row.start_date as string,
  phone:                 row.phone as string,
  isFemale:              row.is_female as boolean,
  baseSalary:            Number(row.base_salary),
  dependentsCount:       Number(row.dependents_count),
  contractType:          row.contract_type as Employee['contractType'],
  email:                 (row.email as string) ?? undefined,
  bankAccount:           (row.bank_account as string) ?? undefined,
  bankName:              (row.bank_name as string) ?? undefined,
  unionMember:           (row.union_member as boolean) ?? false,
  insuranceBaseSalary:   row.insurance_base_salary != null ? Number(row.insurance_base_salary) : undefined,
  numberOfDependents:    row.number_of_dependents != null ? Number(row.number_of_dependents) : undefined,
  compLeaveBalance:      row.comp_leave_balance != null ? Number(row.comp_leave_balance) : undefined,
});

// ─────────────────────────────────────────────────────────────
// Mapper: EmployeeAttendanceRecord ↔ DB row
// Key format: {employeeId}_{year}_{month}
// ─────────────────────────────────────────────────────────────

export const attendanceToDb = (key: string, record: EmployeeAttendanceRecord) => ({
  id:                              key,
  employee_id:                     record.employeeId,
  month:                           record.month,
  year:                            record.year,
  month_standard_days:             record.monthStandardDays ?? null,
  daily_records:                   record.dailyRecords,
  manual_female_support_hours:     record.manualFemaleSupportHours ?? null,
  manual_transferred_annual_leave: record.manualTransferredAnnualLeave ?? null,
  manual_personal_tax:             record.manualPersonalTax ?? null,
  manual_insurance_arrears:        record.manualInsuranceArrears ?? null,
  manual_bonus_other:              record.manualBonusOther ?? null,
  manual_night_ot50_hours:         record.manualNightOt50Hours ?? null,
  manual_night_ot60_hours:         record.manualNightOt60Hours ?? null,
  manual_ot70_hours:               record.manualOt70Hours ?? null,
  manual_holiday_night_ot90_hours: record.manualHolidayNightOt90Hours ?? null,
  manual_min_wage_leave_days:      record.manualMinWageLeaveDays ?? null,
  manual_number_of_dependents:     record.manualNumberOfDependents ?? null,
  manual_document_fee:             record.manualDocumentFee ?? null,
  manual_other_allowance:          record.manualOtherAllowance ?? null,
  manual_referral_bonus:           record.manualReferralBonus ?? null,
  manual_other_addition:           record.manualOtherAddition ?? null,
  manual_other_deduction:          record.manualOtherDeduction ?? null,
  manual_unauthorized_absence_days: record.manualUnauthorizedAbsenceDays ?? null,
});

export const dbToAttendance = (row: Record<string, unknown>): EmployeeAttendanceRecord => ({
  employeeId:                    row.employee_id as string,
  month:                         row.month as number,
  year:                          row.year as number,
  monthStandardDays:             row.month_standard_days != null ? Number(row.month_standard_days) : undefined,
  dailyRecords:                  (row.daily_records as EmployeeAttendanceRecord['dailyRecords']) ?? {},
  manualFemaleSupportHours:      row.manual_female_support_hours != null ? Number(row.manual_female_support_hours) : undefined,
  manualTransferredAnnualLeave:  row.manual_transferred_annual_leave != null ? Number(row.manual_transferred_annual_leave) : undefined,
  manualPersonalTax:             row.manual_personal_tax != null ? Number(row.manual_personal_tax) : undefined,
  manualInsuranceArrears:        row.manual_insurance_arrears != null ? Number(row.manual_insurance_arrears) : undefined,
  manualBonusOther:              row.manual_bonus_other != null ? Number(row.manual_bonus_other) : undefined,
  manualNightOt50Hours:          row.manual_night_ot50_hours != null ? Number(row.manual_night_ot50_hours) : undefined,
  manualNightOt60Hours:          row.manual_night_ot60_hours != null ? Number(row.manual_night_ot60_hours) : undefined,
  manualOt70Hours:               row.manual_ot70_hours != null ? Number(row.manual_ot70_hours) : undefined,
  manualHolidayNightOt90Hours:   row.manual_holiday_night_ot90_hours != null ? Number(row.manual_holiday_night_ot90_hours) : undefined,
  manualMinWageLeaveDays:        row.manual_min_wage_leave_days != null ? Number(row.manual_min_wage_leave_days) : undefined,
  manualNumberOfDependents:      row.manual_number_of_dependents != null ? Number(row.manual_number_of_dependents) : undefined,
  manualDocumentFee:             row.manual_document_fee != null ? Number(row.manual_document_fee) : undefined,
  manualOtherAllowance:          row.manual_other_allowance != null ? Number(row.manual_other_allowance) : undefined,
  manualReferralBonus:           row.manual_referral_bonus != null ? Number(row.manual_referral_bonus) : undefined,
  manualOtherAddition:           row.manual_other_addition != null ? Number(row.manual_other_addition) : undefined,
  manualOtherDeduction:          row.manual_other_deduction != null ? Number(row.manual_other_deduction) : undefined,
  manualUnauthorizedAbsenceDays: row.manual_unauthorized_absence_days != null ? Number(row.manual_unauthorized_absence_days) : undefined,
});

// ─────────────────────────────────────────────────────────────
// CRUD helpers
// ─────────────────────────────────────────────────────────────

/** Fetch tất cả nhân viên từ Supabase */
export async function fetchEmployees(): Promise<Employee[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('employees').select('*').order('full_name');
  if (error) { console.error('[Supabase] fetchEmployees:', error.message); return null; }
  return (data ?? []).map(dbToEmployee);
}

/** Upsert toàn bộ danh sách nhân viên */
export async function upsertEmployees(employees: Employee[]): Promise<void> {
  if (!supabase || employees.length === 0) return;
  const rows = employees.map(employeeToDb);
  const { error } = await supabase.from('employees').upsert(rows, { onConflict: 'id' });
  if (error) console.error('[Supabase] upsertEmployees:', error.message);
}

/** Upsert một nhân viên */
export async function upsertEmployee(emp: Employee): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('employees').upsert(employeeToDb(emp), { onConflict: 'id' });
  if (error) console.error('[Supabase] upsertEmployee:', error.message);
}

/** Xóa một nhân viên */
export async function deleteEmployeeFromDb(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('employees').delete().eq('id', id);
  if (error) console.error('[Supabase] deleteEmployee:', error.message);
}

/** Fetch tất cả attendance records */
export async function fetchAttendanceRecords(): Promise<Record<string, EmployeeAttendanceRecord> | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('attendance_records').select('*');
  if (error) { console.error('[Supabase] fetchAttendanceRecords:', error.message); return null; }
  const result: Record<string, EmployeeAttendanceRecord> = {};
  for (const row of data ?? []) {
    result[row.id as string] = dbToAttendance(row);
  }
  return result;
}

/** Upsert một attendance record */
export async function upsertAttendanceRecord(key: string, record: EmployeeAttendanceRecord): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('attendance_records').upsert(attendanceToDb(key, record), { onConflict: 'id' });
  if (error) console.error('[Supabase] upsertAttendanceRecord:', error.message);
}

/** Fetch salary config */
export async function fetchSalaryConfig(): Promise<SalaryConfig | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('salary_config').select('config').eq('id', 1).single();
  if (error) {
    if (error.code === 'PGRST116') return null; // No rows
    console.error('[Supabase] fetchSalaryConfig:', error.message);
    return null;
  }
  return data?.config as SalaryConfig ?? null;
}

/** Upsert salary config */
export async function upsertSalaryConfig(config: SalaryConfig): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('salary_config').upsert({ id: 1, config }, { onConflict: 'id' });
  if (error) console.error('[Supabase] upsertSalaryConfig:', error.message);
}

// EPCC (payroll-view-permission-matrix) — lưu ma trận phân quyền xem Bảng lương theo cùng
// pattern bảng "1 dòng duy nhất chứa JSON" như salary_config ở trên (id cố định = 1), chỉ
// khác tên bảng `payroll_view_permissions`. Cần tạo bảng này trong Supabase với cấu trúc:
// id (int, PK) | permissions (jsonb) — tương tự salary_config (id | config).

/** Fetch ma trận phân quyền xem Bảng lương */
export async function fetchPayrollViewPermissions(): Promise<PayrollViewPermissions | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('payroll_view_permissions').select('permissions').eq('id', 1).single();
  if (error) {
    if (error.code === 'PGRST116') return null; // No rows
    console.error('[Supabase] fetchPayrollViewPermissions:', error.message);
    return null;
  }
  return data?.permissions as PayrollViewPermissions ?? null;
}

/** Upsert ma trận phân quyền xem Bảng lương */
export async function upsertPayrollViewPermissions(permissions: PayrollViewPermissions): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('payroll_view_permissions').upsert({ id: 1, permissions }, { onConflict: 'id' });
  if (error) console.error('[Supabase] upsertPayrollViewPermissions:', error.message);
}
