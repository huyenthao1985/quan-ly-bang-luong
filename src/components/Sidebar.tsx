import React from 'react';
import { Sun, Moon, Shield, UserCheck, Users } from 'lucide-react';
import { usePayroll } from '../context/PayrollContext';
import { UserRole } from '../types/payroll';

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

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, theme, toggleTheme, activeRole, setActiveRole, currentUser } = usePayroll() as any;
  const RoleIcon = ROLE_META[activeRole as UserRole].icon;

  return (
    // FIX (always-expanded): bỏ hẳn class "collapsed" và nút thu gọn — theo
    // yêu cầu người dùng, Sidebar luôn ở trạng thái mở cố định, không còn
    // toggle nữa.
    <aside className="sidebar">
      {/* Lớp ghi đè màu thương hiệu — !important để thắng biến mặc định
          (--sidebar-bg-start/end) trong index.css */}
      <style>{`
        /* FIX (always-expanded): ép width cố định 260px, vô hiệu hoá hẳn
           trạng thái thu gọn (68px) — không còn nút toggle nên không cần
           lo class .collapsed nữa, nhưng ép !important cho chắc nếu còn
           chỗ nào khác lỡ set width 68px. */
        .sidebar { width: 260px !important; background: #0b1220 !important; }
        .app-content { margin-left: 260px !important; }
        .sidebar .sidebar-header {
          background: linear-gradient(90deg, #026466 0%, #026466 62%, #cfdc00 100%) !important;
          border-bottom: 1px solid rgba(0,0,0,0.15) !important;
          justify-content: center !important;
        }
        .sidebar .sidebar-item-index {
          background: rgb(220,216,0) !important;
          color: #1a1a1a !important;
        }
        .sidebar .sidebar-item.active .sidebar-item-index {
          background: rgb(220,216,0) !important;
          color: #1a1a1a !important;
        }
        .sidebar .sidebar-item-label {
          color: #000000 !important;
          font-size: 17.4px !important;
          font-weight: 700 !important;
          letter-spacing: 0.2px;
        }
        .sidebar .sidebar-item { border-left: none !important; }
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
        <div className="sidebar-logo" style={{ display: 'flex', flexDirection: 'row', alignItems: 'baseline', gap: '5px' }}>
          <span style={{ fontWeight: 800, fontSize: '19px', color: '#ffffff', whiteSpace: 'nowrap' }}>PPC</span>
          <span style={{ fontWeight: 800, fontSize: '19px', color: '#cfdc00', whiteSpace: 'nowrap' }}>TEAM</span>
        </div>
      </div>

      <ul className="sidebar-menu">
        {ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <li
              key={item.id}
              data-idx={item.index}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <div className="sidebar-item-index">{item.index}</div>
              <span className="sidebar-item-label">{item.label}</span>
              <div className="sidebar-item-dot" />
            </li>
          );
        })}
      </ul>

      {/* Chân Sidebar — chuyển nguyên 3 khối từ Header cũ sang: role
          switcher, user badge hiện tại, nút Sáng/Tối. */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.08)',
        padding: '12px',
        display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0,
      }}>
        {/* Role switcher */}
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
  );
};
