import React from 'react';
import {
  Users,
  DollarSign,
  Clock,
  Briefcase,
  TrendingUp,
  Award,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { usePayroll } from '../../context/PayrollContext';
import { calculatePayslip, formatVND } from '../../utils/payrollCalculations';

export const DashboardTab: React.FC = () => {
  const { employees, attendanceRecords, salaryConfig, selectedMonth, selectedYear, setSelectedMonth, setSelectedYear } = usePayroll();

  // Compute metrics for selected month/year
  const totalEmployees = employees.length;
  const femaleEmployees = employees.filter((e) => e.isFemale).length;
  const maleEmployees = totalEmployees - femaleEmployees;

  // Calculate total payroll cost for selected month
  let totalPayrollCost = 0;
  let totalHcHours = 0;
  let totalOtHours = 0;

  const departmentDataMap: Record<string, { count: number; totalSalary: number }> = {};

  employees.forEach((emp) => {
    const key = `${emp.id}_${selectedYear}_${selectedMonth}`;
    const rec = attendanceRecords[key];
    const payslip = calculatePayslip(emp, rec, salaryConfig);

    totalPayrollCost += payslip.netSalary;
    totalHcHours += payslip.hcDays * 8;
    totalOtHours += payslip.ot150Hours + payslip.sunday200Hours + payslip.holiday300Hours;

    if (!departmentDataMap[emp.department]) {
      departmentDataMap[emp.department] = { count: 0, totalSalary: 0 };
    }
    departmentDataMap[emp.department].count += 1;
    departmentDataMap[emp.department].totalSalary += payslip.netSalary;
  });

  const departmentSalaryData = Object.keys(departmentDataMap).map((dept) => ({
    name: dept,
    soLuong: departmentDataMap[dept].count,
    tongLuong: departmentDataMap[dept].totalSalary,
  }));

  // Position distribution for Pie chart
  const positionMap: Record<string, number> = {};
  employees.forEach((emp) => {
    positionMap[emp.position] = (positionMap[emp.position] || 0) + 1;
  });

  const positionData = Object.keys(positionMap).map((pos) => ({
    name: pos,
    value: positionMap[pos],
  }));

  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'];

  // Monthly trend data
  const trendData = [
    { month: 'T03/26', hc: 1850, ot: 120, salary: 145000000 },
    { month: 'T04/26', hc: 1920, ot: 140, salary: 152000000 },
    { month: 'T05/26', hc: 1880, ot: 110, salary: 148000000 },
    { month: 'T06/26', hc: 1960, ot: 165, salary: 158000000 },
    { month: 'T07/26', hc: 1940, ot: 150, salary: 155000000 },
    { month: `T0${selectedMonth}/${selectedYear.toString().slice(2)}`, hc: totalHcHours || 1980, ot: totalOtHours || 180, salary: totalPayrollCost || 162000000 },
  ];

  return (
    <div className="flex flex-col gap-1.5" style={{ paddingBottom: '0.5mm' }}>
      {/* Top Banner & Date Selector */}
      <div className="bg-white dark:bg-slate-800 px-4 py-2.5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <LayoutDashboardIcon className="w-5 h-5 text-blue-600" />
            Báo Cáo Tổng Quan & Thống Kê KPI
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Theo dõi tình hình nhân sự, tổng chi phí lương và xu hướng tăng ca (HC vs OT)
          </p>
        </div>

        <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
          <Calendar className="w-4 h-4 text-blue-600" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Kỳ lương:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  Tháng {m}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              {[2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {/* Card 1: Tổng Nhân Viên */}
        <div className="bg-white dark:bg-slate-800 p-3.5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
              Tổng Nhân Viên
            </p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-0.5">
              {totalEmployees} <span className="text-xs font-normal text-slate-500">người</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Nam: <span className="font-semibold text-blue-600">{maleEmployees}</span> | Nữ: <span className="font-semibold text-pink-600">{femaleEmployees}</span>
            </p>
          </div>
          <div className="w-11 h-11 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Quỹ Lương Thực Lĩnh */}
        <div className="bg-white dark:bg-slate-800 p-3.5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
              Tổng Thực Lĩnh
            </p>
            <h3 className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              {formatVND(totalPayrollCost)}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tháng {selectedMonth}/{selectedYear}
            </p>
          </div>
          <div className="w-11 h-11 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Tổng Giờ HC */}
        <div className="bg-white dark:bg-slate-800 p-3.5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
              Tổng Giờ HC
            </p>
            <h3 className="text-2xl font-black text-blue-700 dark:text-blue-400 mt-0.5">
              {totalHcHours.toFixed(1)} <span className="text-xs font-normal text-slate-500">giờ</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              TB: {totalEmployees ? (totalHcHours / totalEmployees).toFixed(1) : 0}h/NV
            </p>
          </div>
          <div className="w-11 h-11 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Tổng Giờ Tăng Ca (OT) */}
        <div className="bg-white dark:bg-slate-800 p-3.5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
              Tổng Giờ Tăng Ca (OT)
            </p>
            <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
              {totalOtHours.toFixed(1)} <span className="text-xs font-normal text-slate-500">giờ</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Gồm OT 150%, CN 200%, Lễ 300%
            </p>
          </div>
          <div className="w-11 h-11 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {/* Chart 1: Quỹ lương theo phòng ban */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-blue-600" />
            Chi Phí Lương Theo Phòng Ban
          </h3>
          <div className="h-[314px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentSalaryData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={11} tickFormatter={(val) => `${(val / 1000000).toFixed(0)}M`} />
                <Tooltip
                  formatter={(value: any) => [formatVND(value as number), 'Tổng Thực Lĩnh']}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }}
                />
                <Bar dataKey="tongLuong" name="Tổng Lương" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Cơ cấu vị trí nhân sự */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-600" />
            Cơ Cấu Vị Trí Nhân Sự
          </h3>
          <div className="h-[314px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={positionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={105}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {positionData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Chart Row 2: Monthly Trends */}
      <div
        className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700"
        style={{ marginBottom: '0.5mm' }}
      >
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-purple-600" />
          Xu Hướng Tổng Giờ Làm Chuẩn (HC) vs Tăng Ca (OT) Các Tháng
        </h3>
        <div className="h-[336px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
              <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
              <YAxis yAxisId="left" stroke="#2563eb" fontSize={11} />
              <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" fontSize={11} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="hc" name="Giờ Hành Chính (HC)" stroke="#2563eb" strokeWidth={2.5} />
              <Line yAxisId="right" type="monotone" dataKey="ot" name="Giờ Tăng Ca (OT)" stroke="#f59e0b" strokeWidth={2.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

function LayoutDashboardIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  );
}
