import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { usePayroll } from '../context/PayrollContext';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = usePayroll();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-[999999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const icons = {
          success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
          error: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
          info: <Info className="w-5 h-5 text-sky-400 shrink-0" />,
        };

        const bgColors = {
          success: 'bg-slate-900/95 border-emerald-500 text-slate-100 shadow-[0_4px_20px_rgba(16,185,129,0.3)]',
          error: 'bg-slate-900/95 border-rose-500 text-slate-100 shadow-[0_4px_20px_rgba(244,63,94,0.3)]',
          info: 'bg-slate-900/95 border-sky-500 text-slate-100 shadow-[0_4px_20px_rgba(14,165,233,0.3)]',
        };

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between p-3.5 rounded-xl border text-xs font-semibold backdrop-blur-md transition-all animate-in slide-in-from-top-2 duration-200 ${bgColors[toast.type]}`}
          >
            <div className="flex items-center gap-2.5">
              {icons[toast.type]}
              <span className="leading-snug">{toast.message}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-white cursor-pointer ml-3 p-1 rounded-md hover:bg-slate-800 transition-colors shrink-0"
              aria-label="Đóng thông báo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
