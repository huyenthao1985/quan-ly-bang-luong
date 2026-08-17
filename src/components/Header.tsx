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
// FIX (single-toggle-button): trước đây Header có riêng 1 nút hamburger (☰)
// để ẩn/hiện Sidebar, khiến người dùng thấy 2 nút toggle khác nhau ở 2 vị
// trí khác nhau tuỳ trạng thái Sidebar (hamburger trong Header khi mở, tab
// mũi tên vàng dính mép khi đóng) — gây cảm giác nút "nhảy chỗ". Theo yêu
// cầu người dùng, đã GỘP LÀM 1 nút duy nhất (xem Sidebar.tsx — nút mũi tên
// vàng luôn hiện, luôn ở đúng 1 vị trí cố định top-left, chỉ đổi hướng mũi
// tên theo trạng thái). Vì vậy xoá hẳn nút + icon Menu + prop onMenuClick ở
// đây, Header giờ không còn liên quan gì đến việc đóng/mở Sidebar nữa.
export const Header: React.FC = () => {
  return (
    <header
      className="bg-[#122842] dark:bg-[#0b1726] text-white shadow-md sticky top-0 z-40 px-4 border-b border-slate-700/50 transition-colors flex items-center relative"
      style={{ height: '60px', boxSizing: 'border-box' }}
    >
      <div className="max-w-7xl mx-auto w-full flex items-center justify-center gap-3">
        {/* EPCC (remove-p-badge) — theo yêu cầu người dùng: bỏ khối logo chữ
            "P" phía trước tiêu đề, header giờ chỉ còn lại tên app. */}
        {/* EPCC (aurora-title) — đổi màu tiêu đề từ solid text-slate-100 sang
            hiệu ứng gradient nhiều màu chạy (aurora), theo mẫu tham chiếu
            người dùng cung cấp. CSS class .aurora-text định nghĩa trong
            App.css (hoặc index.css). Cỡ chữ tăng thêm 30% so với bản gốc
            (text-xl/md:text-2xl → 1.625rem/1.95rem, tương đương +30%). */}
        <h1 className="aurora-text text-[1.625rem] md:text-[1.95rem] font-bold tracking-tight uppercase font-sans">
          QUẢN LÝ BẢNG LƯƠNG
        </h1>
      </div>
    </header>
  );
};
