import React, { useState } from 'react';
import { Settings as SettingsIcon, Wallet } from 'lucide-react';
import { SettingsTab } from './SettingsTab';
import { PayslipTab } from './PayslipTab';

// EPCC (merge-settings-payslip-menu) — hợp lý hoá theo yêu cầu người dùng:
// gộp 2 mục sidebar "CÀI ĐẶT" và "BẢNG LƯƠNG IM" thành 1 mục duy nhất
// "BẢNG LƯƠNG", bên trong chia 2 sheet con (Cài đặt / Bảng lương) chuyển
// đổi bằng toggle nội bộ, tái sử dụng nguyên vẹn 2 component cũ
// SettingsTab và PayslipTab không đổi logic bên trong.

type PayrollSubTab = 'settings' | 'payslip';

const SUB_TABS: { id: PayrollSubTab; label: string; icon: any }[] = [
  { id: 'settings', label: 'Cài đặt', icon: SettingsIcon },
  { id: 'payslip',  label: 'Bảng lương', icon: Wallet },
];

export const PayrollTab: React.FC = () => {
  const [subTab, setSubTab] = useState<PayrollSubTab>('settings');

  return (
    <div className="space-y-[2mm]">
      {/* ── Sheet toggle — cùng phong cách với thanh chuyển view của AttendanceTab ── */}
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
