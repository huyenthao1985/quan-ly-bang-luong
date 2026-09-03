import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export const Header: React.FC = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const dayName = days[now.getDay()];
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');

  return (
    <header
      className="bg-[#003300] dark:bg-[#003300] text-white shadow-md sticky top-0 z-40 px-4 border-b border-[#002200] transition-colors flex items-center relative"
      style={{ backgroundColor: '#003300', height: '60px', boxSizing: 'border-box' }}
    >
      <div className="w-full px-2 sm:px-4 md:px-5 flex items-center justify-center relative">
        <h1 className="aurora-text text-[1.625rem] md:text-[1.95rem] font-bold tracking-tight uppercase font-sans">
          QUẢN LÝ BẢNG LƯƠNG
        </h1>

        {/* Real-time Clock on right */}
        <div className="hidden lg:flex items-center gap-2 absolute right-0 bg-black/30 backdrop-blur-sm border border-emerald-500/30 rounded-full px-3 py-1 text-xs text-emerald-300 shadow-inner">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <Clock className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-semibold text-white/90">{dayName}, {dd}/{mm}/{yyyy}</span>
          <span className="font-mono font-bold text-emerald-300 tracking-wider">{hh}:{min}:{ss}</span>
        </div>
      </div>
    </header>
  );
};
