import React, { useState } from 'react';
import { Settings as SettingsIcon, Wallet, LogOut, ShieldCheck, Users } from 'lucide-react';
import { SettingsTab } from './SettingsTab';
import { PayslipTab } from './PayslipTab';
import { AccountsTab } from './AccountsTab';
import { PayrollAuthGate } from './PayrollAuthGate';
import { usePayroll } from '../../context/PayrollContext';

type PayrollSubTab = 'settings' | 'payslip' | 'accounts';

export const PayrollTab: React.FC = () => {
  const { authRole, authProfile, employees, selectedEmployeeId, setSelectedEmployeeId } = usePayroll();
  const [unlockedEmpId, setUnlockedEmpId] = useState<string | null>(null);

  // Quyền quản trị tối cao của Admin (Manager/S. Manager)
  const isSuperAdmin = authRole === 'admin';
  const [subTab, setSubTab] = useState<PayrollSubTab>(isSuperAdmin ? 'settings' : 'payslip');

  const subTabs = [
    { id: 'settings' as PayrollSubTab, label: 'Cài đặt', icon: SettingsIcon },
    { id: 'payslip' as PayrollSubTab, label: 'Bảng lương', icon: Wallet },
    ...(isSuperAdmin ? [{ id: 'accounts' as PayrollSubTab, label: 'Quản lý tài khoản', icon: Users }] : []),
  ];

  // Với Admin (S. Manager), có toàn quyền quản trị ngay lập tức
  if (isSuperAdmin) {
    return (
      <div className="space-y-[2mm]">
        {/* ── Sheet toggle cho Admin ── */}
        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-3">
          <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
            {subTabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSubTab(id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 text-[0.9rem] font-semibold transition-all cursor-pointer ${
                  subTab === id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {subTab === 'settings' && <SettingsTab />}
        {subTab === 'payslip' && <PayslipTab />}
        {subTab === 'accounts' && <AccountsTab />}
      </div>
    );
  }

  // Nếu chưa đăng nhập lớp thứ 2 xem Bảng lương
  const activeEmpId = unlockedEmpId || (authProfile?.employee_id ? authProfile.employee_id : null);

  React.useEffect(() => {
    if (activeEmpId && selectedEmployeeId !== activeEmpId) {
      setSelectedEmployeeId(activeEmpId);
    }
  }, [activeEmpId, selectedEmployeeId, setSelectedEmployeeId]);

  if (!activeEmpId) {
    return (
      <PayrollAuthGate
        onSuccess={(empId) => {
          setUnlockedEmpId(empId);
          setSelectedEmployeeId(empId);
        }}
      />
    );
  }

  const currentEmp = employees.find((e) => e.id.toLowerCase() === activeEmpId.toLowerCase());

  return (
    <div className="space-y-[2mm]">
      {/* ── Banner thông tin nhân viên đang xem bảng lương ── */}
      <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>{currentEmp?.fullName || activeEmpId}</span>
              <span className="text-[10px] px-2 py-0.5 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded font-semibold">
                {currentEmp?.position || 'Nhân viên'}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Mã nhân viên: <strong className="text-slate-700 dark:text-slate-300">{activeEmpId}</strong> (Phiếu lương bảo mật)
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setUnlockedEmpId(null);
          }}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-300 text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Đổi người xem / Đăng xuất</span>
        </button>
      </div>

      {/* ── Sheet toggle cho Cài đặt / Bảng lương ── */}
      <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-3">
        <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
          {subTabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSubTab(id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-[0.9rem] font-semibold transition-all cursor-pointer ${
                subTab === id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {subTab === 'settings' && <SettingsTab />}
      {subTab === 'payslip' && <PayslipTab />}
      {subTab === 'accounts' && <AccountsTab />}
    </div>
  );
};
