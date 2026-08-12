import React from 'react';
import { createPortal } from 'react-dom';
import { Sun, Moon, Shield, UserCheck, Users, ChevronRight, ChevronLeft, LogOut } from 'lucide-react';
import { usePayroll } from '../context/PayrollContext';
import { UserRole } from '../types/payroll';
// EPCC (payroll-simple-role-gate) — canAccessTab/ROLE_LABEL đến từ đăng
// nhập THẬT (lib/auth.ts), khác UserRole('Admin'|'Leader'|'User') phía trên
// vốn là role giả lập — Sidebar dùng canAccessTab để ẨN mục "BẢNG LƯƠNG"
// khỏi menu nếu authRole không phải Manager (phòng vệ kép, cùng với gate
// chính ở MainContent trong App.tsx).
import { canAccessTab, ROLE_LABEL } from '../lib/auth';

// EPCC (move-controls-to-sidebar) — hợp lý hoá theo yêu cầu người dùng: 3
// khối "Quyền / User badge / Theme toggle" trước đây nằm ở Header (trùng
// lặp với chân Sidebar) đã CHUYỂN HẲN vào đây, lấy dữ liệu trực tiếp từ
// usePayroll() thay vì nhận qua props — Sidebar giờ tự chứa, App.tsx chỉ
// còn cần truyền collapsed/onToggleCollapse (2 state UI thuần, không thuộc
// domain nghiệp vụ nên vẫn hợp lý để App quản lý).

const ITEMS: { id: string; index: string; label: string }[] = [
  { id: 'dashboard',  index: '1', label: 'TỔNG QUAN' },
  { id: 'employees',  index: '2', label: 'HỒ SƠ NHÂN VIÊN' },
  { id: 'attendance', index: '3', label: 'NHẬP ĐIỂM DANH' },
  { id: 'settings',   index: '4', label: 'BẢNG LƯƠNG' },
];

const ROLE_META: Record<UserRole, { label: string; icon: any }> = {
  Admin: { label: 'Admin (Quản trị)', icon: Shield },
  Leader: { label: 'Leader (Trưởng nhóm)', icon: UserCheck },
  User: { label: 'User (Xem lương)', icon: Users },
};

// FIX (toggle-all-screens): theo yêu cầu người dùng, Sidebar giờ ẩn/hiện
// được ở CẢ điện thoại lẫn laptop (trước đây chỉ mobile mới có drawer, còn
// desktop luôn cố định mở — nay bỏ hẳn ràng buộc "always-expanded" trên
// desktop). Đổi tên prop mobileOpen/onCloseMobile → open/onClose cho đúng
// bản chất tổng quát. Sidebar giờ luôn ở dạng overlay position:fixed, trượt
// ẩn/hiện bằng transform, có backdrop mờ, áp dụng đồng nhất ở mọi kích
// thước màn hình — không còn phân biệt qua @media (max-width) nữa.
interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
  onOpen?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ open = false, onClose, onOpen }) => {
  const {
    activeTab, setActiveTab, theme, toggleTheme, activeRole, setActiveRole, currentUser,
    authRole, signOutAuth,
  } = usePayroll() as any;
  const RoleIcon = ROLE_META[activeRole as UserRole].icon;
  const [reopenHover, setReopenHover] = React.useState(false);

  // EPCC (payroll-simple-role-gate) — ẩn hẳn mục "BẢNG LƯƠNG" (id 'settings')
  // khỏi menu nếu role thật (authRole) không phải Manager, để không hiện
  // 1 mục bấm vào rồi mới báo "không có quyền" — mất công user bấm nhầm.
  const visibleItems = ITEMS.filter((item) => canAccessTab(item.id, authRole));

  // FIX (keep-sidebar-state-on-select): trước đây chọn menu xong tự gọi
  // onClose?.() để đóng Sidebar lại (hành vi off-canvas). Theo yêu cầu
  // người dùng, việc đóng/mở Sidebar giờ CHỈ do nút mũi tên vàng (toggle
  // button) điều khiển — chọn 1 mục trong menu không còn tự động đóng
  // Sidebar nữa, trạng thái mở/đóng được giữ nguyên xuyên suốt.
  const handleSelectTab = (id: string) => {
    setActiveTab(id);
  };

  return (
    <>
      {/* FIX (push-not-overlay): trước đây có lớp backdrop mờ đen phủ toàn
          màn hình khi Sidebar mở — trên laptop điều đó khiến Sidebar ĐÈ lên
          nội dung (chữ "Danh sách nhân viên...", footer, cột bảng bị cắt/che
          như ảnh người dùng gửi) vì .app-content vẫn margin-left:0. Bỏ hẳn
          backdrop, thay bằng cơ chế ĐẨY: khi Sidebar mở, .app-content được
          margin-left = đúng bề rộng Sidebar (xem CSS "sidebar.open +
          .app-content" bên dưới) để nội dung tự lùi sang phải, không còn bị
          che chữ nữa, dù xem trên điện thoại hay laptop. */}

      {/* FIX (single-toggle-button): theo yêu cầu người dùng, trước đây có
          2 nút khác nhau ở 2 vị trí khác nhau tuỳ trạng thái — hamburger
          (☰) trong Header khi Sidebar mở, và tab mũi tên vàng dính mép khi
          Sidebar đóng — gây cảm giác nút "nhảy chỗ". Giờ GỘP LÀM 1 nút duy
          nhất, luôn render tại đúng 1 vị trí cố định (top:0, left:0, cùng
          kích thước, cùng màu vàng) cho cả 2 trạng thái, chỉ đổi HƯỚNG mũi
          tên để báo hành động: ChevronRight (trỏ phải) khi đang đóng = "bấm
          để mở", ChevronLeft (trỏ trái) khi đang mở = "bấm để đóng". Vẫn
          giữ nguyên cơ chế portal + inline style + z-index cực cao đã fix
          ở bước trước (không phụ thuộc CSS ngoài, không bị ancestor
          transform/overflow làm mất/lệch vị trí). Header không còn nút
          hamburang riêng nữa (đã xoá trong Header.tsx). */}
      {createPortal(
        <button
          type="button"
          onClick={() => (open ? onClose?.() : onOpen?.())}
          onMouseEnter={() => setReopenHover(true)}
          onMouseLeave={() => setReopenHover(false)}
          aria-label={open ? 'Đóng Sidebar' : 'Mở Sidebar'}
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            width: reopenHover ? 28 : 24,
            height: 60,
            background: 'rgb(220,216,0)',
            border: 'none',
            borderRadius: '0 10px 10px 0',
            boxShadow: '2px 0 8px rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 2147483000,
            padding: 0,
            transition: 'width 0.15s ease',
          }}
        >
          {open
            ? <ChevronLeft size={18} color="#0b1220" />
            : <ChevronRight size={18} color="#0b1220" />}
        </button>,
        document.body
      )}


      <aside className={`sidebar${open ? ' open' : ''}`}>
      {/* Lớp ghi đè màu thương hiệu — !important để thắng biến mặc định
          (--sidebar-bg-start/end) trong index.css */}
      <style>{`
        /* Nút mũi tên mở lại Sidebar giờ dùng inline style + createPortal
           render thẳng vào document.body (xem JSX phía trên component) —
           không còn CSS class ở đây, tránh bị các rule !important khác
           trong index.css ghi đè khiến nút "biến mất". */
        /* FIX (push-not-overlay): Sidebar vẫn position:fixed + trượt bằng
           transform (để có hiệu ứng mượt), nhưng .app-content giờ đẩy theo
           đúng bề rộng Sidebar khi mở, không còn bị đè/che chữ nữa. Áp dụng
           đồng nhất mọi kích thước màn hình. */
        .sidebar {
          position: fixed !important;
          top: 0;
          left: 0;
          height: 100vh;
          width: 210px !important;
          background: #0b1220 !important;
          transform: translateX(calc(-100% - 4px));
          transition: transform 0.25s ease;
          z-index: 1000;
          box-shadow: 4px 0 24px rgba(0,0,0,0.45);
        }
        .sidebar.open {
          transform: translateX(0) !important;
        }
        .app-content {
          margin-left: 0 !important;
          transition: margin-left 0.25s ease;
        }
        .sidebar.open + .app-content {
          margin-left: 210px !important;
        }
        .sidebar .sidebar-header {
          background: linear-gradient(90deg, #026466 0%, #026466 62%, #cfdc00 100%) !important;
          border-bottom: 1px solid rgba(0,0,0,0.15) !important;
          justify-content: center !important;
          padding: 0 6px !important;
        }
        .sidebar .sidebar-item-index {
          background: rgb(220,216,0) !important;
          color: #1a1a1a !important;
          width: 24px !important;
          height: 24px !important;
          min-width: 24px !important;
          font-size: 12px !important;
        }
        .sidebar .sidebar-item.active .sidebar-item-index {
          background: rgb(220,216,0) !important;
          color: #1a1a1a !important;
        }
        .sidebar .sidebar-item-label {
          color: #000000 !important;
          font-size: 15px !important;
          font-weight: 700 !important;
          letter-spacing: 0.1px;
          white-space: normal !important;
          line-height: 1.2 !important;
        }
        .sidebar .sidebar-item {
          border-left: none !important;
          padding: 10px 8px !important;
          gap: 8px !important;
        }
        .sidebar .sidebar-item[data-idx="1"] { background: #008489 !important; }
        .sidebar .sidebar-item[data-idx="2"] { background: #009298 !important; }
        .sidebar .sidebar-item[data-idx="3"] { background: #00A6AD !important; }
        .sidebar .sidebar-item[data-idx="4"] { background: #00B2BF !important; }
        .sidebar .sidebar-item[data-idx="5"] { background: #00BFCC !important; }
        .sidebar .sidebar-item.active {
          outline: 2px solid #ffffff !important;
          outline-offset: -2px;
          box-shadow: 0 0 0 2px rgba(32,178,170,0.55), 0 2px 6px rgba(0,0,0,0.25) !important;
        }
      `}</style>

      <div className="sidebar-header">
        <div className="sidebar-logo" style={{ display: 'flex', flexDirection: 'row', alignItems: 'baseline', gap: '4px' }}>
          <span style={{ fontWeight: 800, fontSize: '15px', color: '#ffffff', whiteSpace: 'nowrap' }}>PPC</span>
          <span style={{ fontWeight: 800, fontSize: '15px', color: '#cfdc00', whiteSpace: 'nowrap' }}>TEAM</span>
        </div>
      </div>

      <ul className="sidebar-menu">
        {visibleItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <li
              key={item.id}
              data-idx={item.index}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => handleSelectTab(item.id)}
            >
              <div className="sidebar-item-index">{item.index}</div>
              <span className="sidebar-item-label">{item.label}</span>
            </li>
          );
        })}
      </ul>

      {/* Chân Sidebar — chuyển nguyên 3 khối từ Header cũ sang: role
          switcher, user badge hiện tại, nút Sáng/Tối. FIX
          (bottom-no-divider): theo yêu cầu người dùng, khối này quay lại
          nằm sát đáy Sidebar (menu .sidebar-menu giữ flex:1 mặc định để tự
          giãn, đẩy khối này xuống đáy) và bỏ hẳn đường kẻ phân cách
          (borderTop) phía trên nó. */}
      <div style={{
        padding: '12px',
        display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0,
      }}>
        {/* EPCC (payroll-simple-role-gate) — badge role THẬT (Staff/OP/
            Manager, từ profiles.role) + nút đăng xuất. Đặt trên khối "Role
            switcher" giả lập cũ bên dưới — 2 khối này ĐỘC LẬP nhau, không
            gộp: khối cũ vẫn là công cụ demo/test, khối mới là quyền thật. */}
        {authRole && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'rgba(207,220,0,0.14)', border: '1px solid rgba(207,220,0,0.3)',
            borderRadius: '10px', padding: '6px 8px',
          }}>
            <Shield size={14} color="#cfdc00" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff', flex: 1 }}>
              {ROLE_LABEL[authRole as keyof typeof ROLE_LABEL]?.vi ?? authRole}
            </span>
            <button
              onClick={signOutAuth}
              title="Đăng xuất"
              aria-label="Đăng xuất"
              style={{
                border: 'none', background: 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', padding: '2px',
              }}
            >
              <LogOut size={14} color="#cfe8e6" />
            </button>
          </div>
        )}

        {/* Role switcher (giả lập, dùng nội bộ — KHÔNG phải quyền đăng nhập thật) */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '10px', padding: '6px 8px',
        }}>
          <RoleIcon size={14} color="#cfe8e6" style={{ flexShrink: 0 }} />
          <select
              value={activeRole}
              onChange={(e) => setActiveRole(e.target.value as UserRole)}
              style={{
                background: 'transparent', color: '#ffffff', fontSize: '12px',
                fontWeight: 600, border: 'none', outline: 'none', cursor: 'pointer', flex: 1, minWidth: 0,
              }}
            >
              <option value="Admin" style={{ background: '#0b1220', color: '#fff' }}>Admin (Quản trị)</option>
              <option value="Leader" style={{ background: '#0b1220', color: '#fff' }}>Leader (Trưởng nhóm)</option>
              <option value="User" style={{ background: '#0b1220', color: '#fff' }}>User (Xem lương)</option>
          </select>
        </div>

        {/* User badge hiện tại */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '10px', padding: '6px 8px',
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399', flexShrink: 0 }} />
          <span style={{
            fontSize: '12px', fontWeight: 500, color: '#e2e8f0',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {currentUser?.name}
          </span>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          style={{
            height: '32px', border: 'none', background: 'rgba(255,255,255,0.14)',
            borderRadius: '999px', cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '6px', color: '#fff', fontSize: '12px', fontWeight: 500,
          }}
          title="Đổi giao diện Sáng / Tối"
        >
          {theme === 'dark' ? <Sun size={14} color="#fbbf24" /> : <Moon size={14} color="#cbd5e1" />}
          {theme === 'dark' ? 'Sáng' : 'Tối'}
        </button>
      </div>
    </aside>
    </>
  );
};
