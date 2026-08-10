import React, { useState } from 'react';
import {
  Cloud,
  Github,
  Database,
  Globe,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Terminal,
  Server,
  Zap,
} from 'lucide-react';
import { usePayroll } from '../../context/PayrollContext';

export const IntegrationsTab: React.FC = () => {
  const { showToast } = usePayroll();
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, sectionName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionName);
    showToast(`Đã sao chép ${sectionName} vào khay nhớ tạm!`);
    setTimeout(() => setCopiedSection(null), 2500);
  };

  const supabaseSql = `-- SUPABASE DATABASE DDL SCHEMA FOR QUAN LY BANG LUONG

-- 1. Employees Table
CREATE TABLE IF NOT EXISTS public.employees (
  id VARCHAR(50) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  birth_date DATE,
  department VARCHAR(100),
  position VARCHAR(100),
  start_date DATE,
  phone VARCHAR(20),
  is_female BOOLEAN DEFAULT false,
  base_salary NUMERIC(15,2) DEFAULT 0,
  dependents_count INT DEFAULT 0,
  contract_type VARCHAR(50) DEFAULT 'Official',
  email VARCHAR(255),
  union_member BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Daily Attendance Table
CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id VARCHAR(50) REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  hc_hours NUMERIC(4,2) DEFAULT 8.0,
  ot_hours NUMERIC(4,2) DEFAULT 0,
  night_hours NUMERIC(4,2) DEFAULT 0,
  sunday_hours NUMERIC(4,2) DEFAULT 0,
  holiday_hours NUMERIC(4,2) DEFAULT 0,
  leave_paid_days NUMERIC(3,1) DEFAULT 0,
  leave_annual_days NUMERIC(3,1) DEFAULT 0,
  leave_unpaid_days NUMERIC(3,1) DEFAULT 0,
  female_support_hours NUMERIC(4,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(employee_id, work_date)
);

-- 3. Salary Config Table
CREATE TABLE IF NOT EXISTS public.salary_config (
  id INT PRIMARY KEY DEFAULT 1,
  standard_work_days INT DEFAULT 26,
  standard_hours_per_day INT DEFAULT 8,
  ot_rate NUMERIC(3,2) DEFAULT 1.5,
  night_rate NUMERIC(3,2) DEFAULT 0.3,
  bhxh_rate NUMERIC(4,3) DEFAULT 0.08,
  bhyt_rate NUMERIC(4,3) DEFAULT 0.015,
  bhtn_rate NUMERIC(4,3) DEFAULT 0.010,
  union_fee_flat NUMERIC(10,2) DEFAULT 31500,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

-- Allow Public Read/Write for Applet Demo
CREATE POLICY "Allow read for all users" ON public.employees FOR SELECT USING (true);
CREATE POLICY "Allow read for all logs" ON public.attendance_logs FOR SELECT USING (true);
`;

  const vercelJson = `{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/vite"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}`;

  const envExample = `# SUPABASE CONFIGURATION
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key-here"

# VERCEL / GITHUB CI
VERCEL_ORG_ID="your-org-id"
VERCEL_PROJECT_ID="your-project-id"
`;

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Cloud className="w-5 h-5 text-blue-600" />
            Cấu Hình Kết Nối Webapp: GitHub + Vercel + Supabase
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Hướng dẫn đồng bộ mã nguồn lên GitHub, tự động triển khai lên Vercel và kết nối cơ sở dữ liệu PostgreSQL trên Supabase.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
            <ShieldCheck className="w-3.5 h-3.5" />
            Sẵn sàng triển khai
          </span>
        </div>
      </div>

      {/* Integration Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: GitHub */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                <Github className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">GitHub Repository</h3>
                <span className="text-[11px] text-slate-500">Quản lý mã nguồn & CI/CD</span>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
              Kết nối repository GitHub để đồng bộ phiên bản code, nhận phản hồi Pull Requests và tự động kích hoạt pipeline build sản phẩm.
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded border border-slate-200 dark:border-slate-700 font-mono text-[11px] text-slate-700 dark:text-slate-300 space-y-1">
            <p className="font-bold text-slate-900 dark:text-white">Lệnh đẩy code lên GitHub:</p>
            <p className="text-blue-600 dark:text-blue-400">git init</p>
            <p className="text-blue-600 dark:text-blue-400">git add . & git commit -m "feat: payroll manager"</p>
            <p className="text-blue-600 dark:text-blue-400">git push -u origin main</p>
          </div>
        </div>

        {/* Card 2: Vercel */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-black text-white flex items-center justify-center font-black text-xl">
                ▲
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">Vercel Hosting</h3>
                <span className="text-[11px] text-slate-500">Frontend Cloud & Edge Server</span>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
              Deploy ứng dụng React + Vite cực nhanh với SSL tự động, CDN toàn cầu và xem trước thay đổi preview trên từng branch.
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded border border-slate-200 dark:border-slate-700 font-mono text-[11px] text-slate-700 dark:text-slate-300 space-y-1">
            <p className="font-bold text-slate-900 dark:text-white">Lệnh Deploy với Vercel CLI:</p>
            <p className="text-emerald-600 dark:text-emerald-400">npm i -g vercel</p>
            <p className="text-emerald-600 dark:text-emerald-400">vercel --prod</p>
          </div>
        </div>

        {/* Card 3: Supabase */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">Supabase Database</h3>
                <span className="text-[11px] text-slate-500">PostgreSQL Cloud & Auth</span>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
              Lưu trữ danh sách nhân viên, chấm công và các chỉ số lương bền vững trên đám mây với chuẩn Row Level Security (RLS).
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded border border-slate-200 dark:border-slate-700 font-mono text-[11px] text-slate-700 dark:text-slate-300 space-y-1">
            <p className="font-bold text-slate-900 dark:text-white">Trạng thái kết nối:</p>
            <p className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Sẵn sàng kết nối qua SQL Script
            </p>
          </div>
        </div>
      </div>

      {/* Code Blocks Section */}
      <div className="space-y-6">
        {/* Supabase DDL SQL */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold font-mono">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>supabase_schema.sql (PostgreSQL Table Definitions)</span>
            </div>
            <button
              onClick={() => copyToClipboard(supabaseSql, 'Kịch bản Supabase SQL')}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 px-3 py-1 rounded transition-all cursor-pointer"
            >
              {copiedSection === 'Kịch bản Supabase SQL' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Đã chép</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Sao chép SQL</span>
                </>
              )}
            </button>
          </div>
          <pre className="p-4 bg-slate-950 text-emerald-400 font-mono text-xs overflow-x-auto leading-relaxed max-h-72">
            {supabaseSql}
          </pre>
        </div>

        {/* Vercel config & Env example */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
              <span className="text-xs font-bold font-mono text-blue-400">vercel.json</span>
              <button
                onClick={() => copyToClipboard(vercelJson, 'Cấu hình vercel.json')}
                className="text-xs text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3 h-3" /> Chép
              </button>
            </div>
            <pre className="p-3 bg-slate-950 text-slate-200 font-mono text-xs overflow-x-auto">
              {vercelJson}
            </pre>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
              <span className="text-xs font-bold font-mono text-amber-400">.env.example</span>
              <button
                onClick={() => copyToClipboard(envExample, 'File .env.example')}
                className="text-xs text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3 h-3" /> Chép
              </button>
            </div>
            <pre className="p-3 bg-slate-950 text-slate-200 font-mono text-xs overflow-x-auto">
              {envExample}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
