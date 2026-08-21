import React, { useEffect, useMemo, useState } from 'react';
import { PartyPopper, Sparkles, X } from 'lucide-react';
import { usePayroll } from '../context/PayrollContext';
import { Employee } from '../types/payroll';
import './BirthdayCelebration.css';

const CONFETTI_COLORS = ['#ffd77a', '#ff8bb0', '#7dfad0', '#7cc7ff', '#fdf6ec', '#f2a93c'];
const BALLOON_COLORS = ['#ff8bb0', '#7dfad0', '#7cc7ff', '#ffd77a', '#c9a6ff'];

// EPCC (birthday-overlay-cake-fireworks) — vị trí pháo hoa cố định (không
// random) quanh rìa thẻ, tránh che phần chữ ở giữa; mỗi điểm tự lặp vô hạn
// với delay/thời lượng khác nhau để các đợt nổ không đồng loạt, trông tự
// nhiên hơn 1 lần nổ rồi tắt.
const FIREWORK_SPOTS = [
  { top: '10%', left: '12%', color: '#ff8bb0', delay: 0, duration: 3.2 },
  { top: '14%', left: '86%', color: '#7dfad0', delay: 0.9, duration: 3.6 },
  { top: '40%', left: '6%', color: '#ffd77a', delay: 1.7, duration: 3.0 },
  { top: '42%', left: '93%', color: '#7cc7ff', delay: 2.3, duration: 3.4 },
  { top: '74%', left: '16%', color: '#c9a6ff', delay: 0.4, duration: 3.8 },
  { top: '72%', left: '84%', color: '#ff8bb0', delay: 1.3, duration: 3.1 },
];
const FIREWORK_RAY_ANGLES = Array.from({ length: 10 }, (_, i) => i * 36);

// EPCC (birthday-overlay-visual-refresh) — thay vì 1 câu chúc cố định, dùng
// một danh sách lời chúc đa dạng và chọn ngẫu nhiên NHƯNG ổn định theo từng
// nhân viên/ngày (seed = tên + ngày hôm nay), để lời chúc không đổi liên tục
// mỗi lần re-render nhưng vẫn khác nhau giữa các nhân viên trong cùng 1 ngày.
const WISH_TEMPLATES: ((name: string) => string)[] = [
  (name) => `Chúc ${name} tuổi mới thật nhiều sức khỏe, niềm vui và gặt hái thật nhiều thành công!`,
  (name) => `Sinh nhật vui vẻ ${name}! Mong bạn luôn giữ nụ cười tươi, an lành và hạnh phúc trong năm mới này.`,
  (name) => `Chúc ${name} một tuổi mới tràn đầy năng lượng, may mắn và những điều tốt đẹp đang chờ phía trước.`,
  (name) => `Happy Birthday ${name}! Chúc bạn luôn tự tin tỏa sáng và đạt được mọi điều mình mong ước.`,
  (name) => `Chúc mừng sinh nhật ${name} — cảm ơn bạn đã luôn là một phần quan trọng và đáng quý của đội ngũ!`,
  (name) => `Mong ${name} tuổi mới thật bình an, dồi dào sức khỏe, công việc thuận lợi và ngập tràn tiếng cười.`,
  (name) => `Chúc ${name} sinh nhật thật ấm áp, thêm một tuổi thêm một hành trình mới rực rỡ và thành công.`,
  (name) => `Gửi ${name} muôn vàn lời chúc tốt đẹp nhất — hạnh phúc, sức khỏe và luôn tràn đầy nhiệt huyết!`,
];

function pickWish(seedKey: string, name: string): string {
  let hash = 0;
  for (let i = 0; i < seedKey.length; i++) {
    hash = (hash * 31 + seedKey.charCodeAt(i)) >>> 0;
  }
  const template = WISH_TEMPLATES[hash % WISH_TEMPLATES.length];
  // EPCC (birthday-overlay-font-fix-resize) — chuẩn hoá NFC phòng trường hợp
  // fullName tới từ nguồn dữ liệu lưu ở dạng Unicode tổ hợp (NFD, chữ cái +
  // dấu thanh là 2 code point riêng), vốn là nguyên nhân gốc gây hiện tượng
  // "tốt" hiển thị tách rời thành "tô" + dấu cách + dấu sắc trong ảnh chụp.
  return template(name).normalize('NFC');
}

// EPCC (birthday-celebration-overlay) — birthDate lưu dạng "YYYY-MM-DD" (từ
// <input type="date"> trong EmployeeProfilesTab.tsx), KHÔNG phải "dd/mm/yyyy".
// Parse đúng theo format này để so khớp ngày/tháng sinh với hôm nay.
function isBirthdayToday(birthDate: string): boolean {
  const parts = birthDate.split('-');
  if (parts.length !== 3) return false;
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (Number.isNaN(month) || Number.isNaN(day)) return false;
  const now = new Date();
  return month === now.getMonth() + 1 && day === now.getDate();
}

function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

/**
 * Overlay chúc mừng sinh nhật, tự hiện khi có nhân viên trùng ngày sinh với
 * hôm nay. Lấy dữ liệu trực tiếp qua usePayroll() giống các tab khác, không
 * cần truyền props. Gắn 1 lần duy nhất trong AppShell (App.tsx) để hiển thị
 * bất kể đang ở tab nào.
 */
export const BirthdayCelebration: React.FC = () => {
  const { employees } = usePayroll();

  const todaysBirthdays = useMemo<Employee[]>(
    () => employees.filter((emp) => isBirthdayToday(emp.birthDate)),
    [employees]
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showWish, setShowWish] = useState(false);
  const [confetti, setConfetti] = useState<
    { id: number; left: number; color: string; delay: number; duration: number; round: boolean }[]
  >([]);
  const [balloons, setBalloons] = useState<
    { id: number; left: number; color: string; delay: number; duration: number; size: number }[]
  >([]);

  const todayKey = getTodayKey();
  // EPCC (birthday-celebration-overlay) — dùng sessionStorage (không phải
  // localStorage) cho flag "đã đóng hôm nay": đây là 1 cờ nhỏ, không phải
  // cache dữ liệu lớn, và tự dọn khi đóng trình duyệt thay vì tồn đọng
  // key theo từng ngày mãi mãi trong localStorage.
  const storageKey = `birthday-dismissed-${todayKey}`;

  useEffect(() => {
    if (todaysBirthdays.length === 0) return;
    try {
      if (sessionStorage.getItem(storageKey) === '1') setDismissed(true);
    } catch {
      /* sessionStorage có thể bị chặn — bỏ qua, overlay vẫn hoạt động */
    }
  }, [todaysBirthdays.length, storageKey]);

  useEffect(() => {
    if (todaysBirthdays.length === 0 || dismissed) return;
    setIsOpen(false);
    setShowWish(false);
    setConfetti([]);
    setBalloons(
      // bong bóng bay nền liên tục suốt thời gian mở thẻ, tách biệt với
      // confetti (chỉ nổ 1 lần khi lời chúc hiện ra)
      Array.from({ length: 10 }, (_, i) => ({
        id: i,
        left: 6 + Math.random() * 88,
        color: BALLOON_COLORS[i % BALLOON_COLORS.length],
        delay: Math.random() * 3,
        duration: 5 + Math.random() * 3,
        size: 0.75 + Math.random() * 0.5,
      }))
    );
    const openTimer = setTimeout(() => setIsOpen(true), 400);
    return () => clearTimeout(openTimer);
  }, [activeIndex, todaysBirthdays.length, dismissed]);

  useEffect(() => {
    if (!isOpen) return;
    const wishTimer = setTimeout(() => {
      setShowWish(true);
      setConfetti(
        Array.from({ length: 64 }, (_, i) => ({
          id: i,
          left: Math.random() * 100,
          color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
          delay: Math.random() * 0.5,
          duration: 2.2 + Math.random() * 1.6,
          round: Math.random() < 0.4,
        }))
      );
    }, 550);
    return () => clearTimeout(wishTimer);
  }, [isOpen]);

  if (todaysBirthdays.length === 0 || dismissed) return null;

  const current = todaysBirthdays[activeIndex];
  const hasMore = activeIndex < todaysBirthdays.length - 1;
  const wishText = pickWish(`${current.fullName}-${todayKey}`, current.fullName);

  const handleClose = () => {
    if (hasMore) {
      setActiveIndex((i) => i + 1);
      return;
    }
    setDismissed(true);
    try {
      sessionStorage.setItem(storageKey, '1');
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className="bday-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Chúc mừng sinh nhật ${current.fullName}`}
    >
      <div className={`bday-stage ${isOpen ? 'is-open' : ''}`}>
        <div className="bday-card-bg" />

        <div className="bday-sparkle-layer">
          {[
            { top: '14%', left: '10%', size: 14, delay: 0 },
            { top: '22%', left: '86%', size: 10, delay: 0.6 },
            { top: '68%', left: '8%', size: 12, delay: 1.1 },
            { top: '78%', left: '90%', size: 16, delay: 1.7 },
            { top: '10%', left: '50%', size: 10, delay: 2.2 },
          ].map((s, i) => (
            <Sparkles
              key={i}
              className="bday-sparkle"
              style={{ top: s.top, left: s.left, width: s.size, height: s.size, animationDelay: `${s.delay}s` }}
            />
          ))}
        </div>

        <div className="bday-balloon-layer">
          {balloons.map((b) => (
            <span
              key={b.id}
              className="bday-balloon"
              style={
                {
                  left: `${b.left}%`,
                  '--balloon-color': b.color,
                  transform: `scale(${b.size})`,
                  animationDelay: `${b.delay}s`,
                  animationDuration: `${b.duration}s`,
                  animationIterationCount: 'infinite',
                } as React.CSSProperties
              }
            />
          ))}
        </div>

        <div className={`bday-firework-layer ${showWish ? 'is-active' : ''}`}>
          {FIREWORK_SPOTS.map((fw, fi) => (
            <div
              key={fi}
              className="bday-firework"
              style={
                {
                  top: fw.top,
                  left: fw.left,
                  '--fw-color': fw.color,
                  '--fw-delay': `${fw.delay}s`,
                  '--fw-duration': `${fw.duration}s`,
                } as React.CSSProperties
              }
            >
              {FIREWORK_RAY_ANGLES.map((angle) => (
                <span key={angle} className="bday-fw-ray" style={{ transform: `rotate(${angle}deg)` }}>
                  <span className="bday-fw-spark" />
                </span>
              ))}
            </div>
          ))}
        </div>

        <div className="bday-shine-sweep" />

        <div className="bday-cake" aria-hidden="true">
          {/* EPCC (birthday-cake-reposition-restyle) — thay bánh 2 tầng đơn
              giản bằng bánh kem tròn 1 tầng theo phong cách ảnh tham chiếu:
              nền kem trắng ngà, viền hạt cườm ngọc, dải sao/chấm pastel,
              kẹo que trang trí quanh mép trên, chữ "HAPPY BIRTHDAY" và
              topper ngôi sao, kèm bóng bay 2 bên. */}
          <svg viewBox="0 0 200 176" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="bdayCakeCream" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fffdf5" />
                <stop offset="55%" stopColor="#fff3d9" />
                <stop offset="100%" stopColor="#ffe6b0" />
              </linearGradient>
              <linearGradient id="bdayBalloonRed" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ff9d9d" />
                <stop offset="100%" stopColor="#e8534f" />
              </linearGradient>
              <linearGradient id="bdayBalloonYellow" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ffe37a" />
                <stop offset="100%" stopColor="#f2b23c" />
              </linearGradient>
              <radialGradient id="bdayStarGrad" cx="50%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#fff6d0" />
                <stop offset="55%" stopColor="#ffd25c" />
                <stop offset="100%" stopColor="#f2a72c" />
              </radialGradient>
            </defs>

            {/* bóng đổ dưới bánh */}
            <ellipse cx="100" cy="164" rx="58" ry="7" fill="rgba(0,0,0,0.32)" />

            {/* bóng bay trái - đỏ */}
            <line x1="26" y1="58" x2="42" y2="96" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4" />
            <ellipse cx="24" cy="42" rx="15" ry="19" fill="url(#bdayBalloonRed)" />
            <ellipse cx="19" cy="35" rx="4.5" ry="6" fill="rgba(255,255,255,0.45)" />

            {/* bóng bay phải - vàng */}
            <line x1="176" y1="55" x2="160" y2="96" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4" />
            <ellipse cx="178" cy="40" rx="14" ry="18" fill="url(#bdayBalloonYellow)" />
            <ellipse cx="173" cy="33" rx="4" ry="5.5" fill="rgba(255,255,255,0.45)" />

            {/* thân bánh kem */}
            <rect x="38" y="96" width="124" height="54" rx="18" fill="url(#bdayCakeCream)" />
            <path
              d="M38 108 Q56 96 74 108 Q92 96 110 108 Q128 96 146 108 Q158 100 162 108"
              fill="none"
              stroke="#ffffff"
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.85"
            />

            {/* viền hạt cườm ngọc dưới đáy */}
            <g fill="#5fd6bd">
              <circle cx="46" cy="146" r="3.2" />
              <circle cx="60" cy="149" r="3.2" />
              <circle cx="74" cy="146" r="3.2" />
              <circle cx="88" cy="149" r="3.2" />
              <circle cx="100" cy="146" r="3.2" />
              <circle cx="112" cy="149" r="3.2" />
              <circle cx="126" cy="146" r="3.2" />
              <circle cx="140" cy="149" r="3.2" />
              <circle cx="154" cy="146" r="3.2" />
            </g>

            {/* dải sao/chấm pastel quanh thân */}
            <g>
              <circle cx="52" cy="122" r="3" fill="#ff8bb0" />
              <circle cx="68" cy="126" r="2.4" fill="#7cc7ff" />
              <circle cx="86" cy="121" r="3" fill="#ffd77a" />
              <circle cx="104" cy="126" r="2.4" fill="#c9a6ff" />
              <circle cx="122" cy="121" r="3" fill="#7dfad0" />
              <circle cx="140" cy="126" r="2.4" fill="#ff8bb0" />
              <circle cx="154" cy="121" r="3" fill="#ffd77a" />
            </g>

            {/* kẹo que trang trí quanh mép trên */}
            <g>
              <path d="M52 96 L58 78 L64 96 Z" fill="#ff8bb0" />
              <circle cx="58" cy="76" r="3" fill="#fff" />
              <path d="M92 96 L98 76 L104 96 Z" fill="#7cc7ff" />
              <circle cx="98" cy="74" r="3" fill="#fff" />
              <path d="M132 96 L138 78 L144 96 Z" fill="#7dfad0" />
              <circle cx="138" cy="76" r="3" fill="#fff" />
            </g>

            {/* chữ HAPPY BIRTHDAY */}
            <g fontFamily="'Fredoka', 'Segoe UI', sans-serif" fontWeight={700} fontSize="13" textAnchor="middle">
              <text x="100" y="46" fill="#f2792c">HAPPY</text>
              <text x="100" y="60" fill="#3aa0e0">BIRTHDAY</text>
            </g>

            {/* topper ngôi sao trên cùng */}
            <path
              d="M100 4 L103.4 13.4 L113 14 L105.4 20.2 L107.8 30 L100 24.4 L92.2 30 L94.6 20.2 L87 14 L96.6 13.4 Z"
              fill="url(#bdayStarGrad)"
            />
          </svg>
        </div>

        <div className="bday-content">
          <p className="bday-prompt">
            <Sparkles /> gửi lời chúc <Sparkles />
          </p>
          <h2 className="bday-headline">
            Chúc Mừng
            <br />
            Sinh Nhật
          </h2>
          <div className="bday-name">{current.fullName}</div>
          {(current.position || current.department) && (
            <div className="bday-meta">
              {[current.position, current.department].filter(Boolean).join(' · ')}
            </div>
          )}
          <svg className="bday-underline" viewBox="0 0 86 10" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M2 7 Q20 2 43 6 T84 4"
              stroke="#ffd77a"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
          </svg>

          <div className={`bday-wish ${showWish ? 'is-in' : ''}`}>✦ {wishText}</div>
        </div>

        <div className="bday-confetti-layer">
          {confetti.map((c) => (
            <span
              key={c.id}
              className={`bday-confetti ${c.round ? 'is-round' : ''}`}
              style={{
                left: `${c.left}%`,
                background: c.color,
                animationDelay: `${c.delay}s`,
                animationDuration: `${c.duration}s`,
              }}
            />
          ))}
        </div>

        <div className="bday-bars">
          <div className="bday-bar bday-bar-top" />
          <div className="bday-bar bday-bar-bot" />
        </div>
      </div>

      <div className="flex items-center gap-3.5">
        {todaysBirthdays.length > 1 && (
          <span className="text-xs text-white/70 tracking-wide">
            {activeIndex + 1}/{todaysBirthdays.length}
          </span>
        )}
        <button
          onClick={handleClose}
          className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-full shadow-sm cursor-pointer transition-colors"
        >
          {hasMore ? (
            <>
              <PartyPopper className="w-3.5 h-3.5" />
              Người tiếp theo
            </>
          ) : (
            <>
              <X className="w-3.5 h-3.5" />
              Đóng
            </>
          )}
        </button>
      </div>
    </div>
  );
};
