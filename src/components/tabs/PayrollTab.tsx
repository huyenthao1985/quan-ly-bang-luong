import React, { useState } from 'react';
import { Settings as SettingsIcon, Wallet } from 'lucide-react';
import { SettingsTab } from './SettingsTab';
import { PayslipTab } from './PayslipTab';
import { PayrollAuthGate } from './PayrollAuthGate';
import { usePayroll } from '../../context/PayrollContext';

type PayrollSubTab = 'settings' | 'payslip';

const SUB_TABS: { id: PayrollSubTab; label: string; icon: any }[] = [
  { id: 'settings', label: 'Cài đặt', icon: SettingsIcon },
  { id: 'payslip',  label: 'Bảng lương', icon: Wallet },
];

export const PayrollTab: React.FC = () => {
  const { authRole, authProfile } = usePayroll();

  // Kiểm tra quyền quản trị: Manager (admin) hoặc tài khoản ngoại lệ VP / KHO
  const isManager = authRole === 'admin' ||
    authProfile?.email?.toLowerCase().includes('vp') ||
    authProfile?.email?.toLowerCase().includes('kho') ||
    authProfile?.username?.toLowerCase() === 'vp' ||
    authProfile?.username?.toLowerCase() === 'kho';

  const [subTab, setSubTab] = useState<PayrollSubTab>(isManager ? 'settings' : 'payslip');

  // Nếu chưa có phiên đăng nhập
  if (!authProfile) {
    return <PayrollAuthGate />;
  }

  // Với nhân viên thông thường (Staff/OP), chỉ hiển thị Bảng lương cá nhân của chính họ
  if (!isManager) {
    return (
      <div className="space-y-[2mm]">
        <PayslipTab />
      </div>
    );
  }

  return (
    <div className="space-y-[2mm]">
      {/* ── Sheet toggle cho Manager/VP/KHO ── */}
      <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-3">
        <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
          {SUB_TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setSubTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[0.9rem] font-semibold transition-all ${subTab === id ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50'}`}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'settings' && <SettingsTab />}
      {subTab === 'payslip' && <PayslipTab />}
    </div>
  );
};

