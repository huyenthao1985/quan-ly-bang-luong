import React from 'react';

// FIX (center-title): tiêu đề "QUẢN LÝ BẢNG LƯƠNG" trước đây căn trái sát
// logo — đổi container sang justify-center để logo + chữ nằm giữa thanh
// header theo yêu cầu người dùng.
// FIX (header-height-match-sidebar): trước đây header chỉ dùng py-3 (padding
// co giãn theo nội dung) nên cao hơn khối "PPC TEAM" bên Sidebar — bên đó
// .sidebar-header có height:60px cố định (index.css). Ép header này cũng
// height:60px + boxSizing:'border-box' (giống hệt .sidebar-header) để 2 khối
// bằng chiều cao nhau như trong ảnh yêu cầu, bỏ py-3 (padding dọc) để không
// cộng dồn thêm chiều cao ngoài 60px đã ép.
export const Header: React.FC = () => {
  return (
    <header
      className="bg-[#122842] dark:bg-[#0b1726] text-white shadow-md sticky top-0 z-40 px-4 border-b border-slate-700/50 transition-colors flex items-center"
      style={{ height: '60px', boxSizing: 'border-box' }}
    >
      <div className="max-w-7xl mx-auto w-full flex items-center justify-center gap-3">
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
