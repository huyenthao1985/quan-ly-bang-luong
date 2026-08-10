import React from 'react';
import {
  Users,
  CalendarCheck,
  Settings,
  FileSpreadsheet,
  BarChart3,
  LayoutDashboard,
  Cloud,
} from 'lucide-react';
import { usePayroll } from '../context/PayrollContext';

export const TabNavigation: React.FC = () => {
  const { activeTab, setActiveTab } = usePayroll();

  const tabs = [
    { id: 'dashboard', label: 'Tổng Quan', icon: LayoutDashboard },
    { id: 'employees', label: 'Hồ Sơ NV', icon: Users },
    { id: 'attendance', label: 'Nhập Điểm Danh', icon: CalendarCheck },
    { id: 'settings', label: 'Cài Đặt', icon: Settings },
    { id: 'payslip', label: 'Bảng Lương IM', icon: FileSpreadsheet },
    { id: 'reports', label: 'Báo Cáo', icon: BarChart3 },
    { id: 'integrations', label: 'Kết Nối Cloud', icon: Cloud },
  ];

  return (
    <div className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 pt-3 pb-2 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded font-medium text-sm transition-all duration-150 whitespace-nowrap cursor-pointer shadow-xs ${
                isActive
                  ? 'bg-[#1e3a5f] text-white dark:bg-blue-600 dark:text-white shadow-sm ring-1 ring-[#1e3a5f]/20 font-semibold'
                  : 'bg-slate-200/80 hover:bg-slate-300 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
