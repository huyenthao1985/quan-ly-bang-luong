import React from 'react';

// FIX (center-title): tiêu đề "QUẢN LÝ BẢNG LƯƠNG" trước đây căn trái sát
// logo — đổi container sang justify-center để logo + chữ nằm giữa thanh
// header theo yêu cầu người dùng.
export const Header: React.FC = () => {
  return (
    <header className="bg-[#122842] dark:bg-[#0b1726] text-white shadow-md sticky top-0 z-40 px-4 py-3 border-b border-slate-700/50 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-3">
        <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center font-black text-lg tracking-wider text-white shadow-inner">
          P
        </div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight uppercase text-slate-100 font-sans">
          QUẢN LÝ BẢNG LƯƠNG
        </h1>
      </div>
    </header>
  );
};
