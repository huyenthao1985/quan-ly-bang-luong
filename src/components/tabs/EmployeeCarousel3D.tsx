import React, { useMemo } from 'react';
import { Employee, Position } from '../../types/payroll';
import './EmployeeCarousel3D.css';

// Màu theo cấp bậc — dùng lại tinh thần Navy + Vàng của sidebar/topbar hiện có,
// thêm 2 tông phụ (xanh dương, ngọc) để phân biệt các cấp bậc thấp hơn.
const POSITION_STYLE: Record<Position, { stripe: string; avatarBg: string }> = {
  'S. Manager': { stripe: '#fbbf24', avatarBg: '#fbbf24' },
  'Manager': { stripe: '#fbbf24', avatarBg: '#fde68a' },
  'Senior Staff': { stripe: '#38bdf8', avatarBg: '#7dd3fc' },
  'Leader': { stripe: '#38bdf8', avatarBg: '#bae6fd' },
  'Staff': { stripe: '#2dd4bf', avatarBg: '#99f6e4' },
  'OP': { stripe: '#94a3b8', avatarBg: '#e2e8f0' },
};

const getInitials = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts[parts.length - 1]?.[0] ?? '';
  return (first + last).toUpperCase();
};

interface EmployeeCarousel3DProps {
  employees: Employee[];
  /** Số thẻ tối đa hiển thị trong vòng xoay (mặc định 8, đủ đẹp mắt và không quá tải DOM) */
  maxCards?: number;
}

export const EmployeeCarousel3D: React.FC<EmployeeCarousel3DProps> = ({
  employees,
  maxCards = 8,
}) => {
  const cards = useMemo(() => employees.slice(0, maxCards), [employees, maxCards]);
  const n = cards.length;

  // Bán kính hình học: card_width / (2 * tan(PI / n)) — giữ các thẻ không đè lên nhau
  // khi xoay quanh trục Y
  const radius = useMemo(() => {
    const cardWidth = 230;
    if (n < 2) return 0;
    return Math.round(cardWidth / 2 / Math.tan(Math.PI / n));
  }, [n]);

  if (n === 0) {
    return null;
  }

  return (
    <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 py-[0.5mm] px-2 overflow-hidden flex-1 min-h-[360px] flex items-center justify-center mb-[0.5mm]">
      {/* Tiêu đề góc trái màn hình */}
      <div className="absolute top-2 left-3.5 z-10 text-left pointer-events-none">
        <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 tracking-wide flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
          ĐỘI NGŨ PPC TEAM
        </h3>
        <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          {n} nhân viên tiêu biểu · di chuột vào để dừng vòng xoay
        </p>
      </div>

      <div className="ec3d-scene" style={{ '--radius': `${radius}px` } as React.CSSProperties}>
        <div className="ec3d-track" style={{ '--n': n } as React.CSSProperties}>
          {cards.map((emp, i) => {
            const style = POSITION_STYLE[emp.position] ?? POSITION_STYLE.OP;
            return (
              <div
                key={emp.id}
                className="ec3d-card"
                style={{ '--i': i } as React.CSSProperties}
                tabIndex={0}
                aria-label={`${emp.fullName} - ${emp.position} - ${emp.department}`}
              >
                <div className="ec3d-card__stripe" style={{ background: style.stripe }} />
                <div className="ec3d-card__body">
                  <div
                    className="ec3d-card__avatar"
                    style={{ background: style.avatarBg }}
                  >
                    {getInitials(emp.fullName)}
                  </div>
                  <div className="ec3d-card__name">{emp.fullName}</div>
                  <span className="ec3d-card__role">{emp.position}</span>
                  <div className="ec3d-card__dept">{emp.department}</div>
                </div>
                <div className="ec3d-card__id">#{emp.id}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
