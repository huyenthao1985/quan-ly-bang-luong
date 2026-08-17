import React, { useEffect, useRef, useState } from 'react';

/**
 * FlowerAnimation — port 1:1 sang React/TS từ script gốc do người dùng cung
 * cấp. Nguyên lý thật sự (khác hẳn cách "vẽ cánh hoa tĩnh" ban đầu):
 *
 *  1) Một canvas phụ ẩn ("ink", 400x400) được vẽ MỘT ĐOẠN CONG LISSAJOUS
 *     MỚI mỗi frame (moveTo -> quadraticCurveTo) và KHÔNG BAO GIỜ XOÁ, nên
 *     đường cong tự tích luỹ, phức tạp và dày dần theo thời gian.
 *  2) Canvas chính ("screen") được xoá mỗi frame về nền đen, sau đó
 *     drawImage() nội dung của "ink" 7 lần liên tiếp, mỗi lần xoay thêm
 *     2π/7 quanh tâm, dùng globalCompositeOperation = 'lighter' + shadowBlur
 *     tím để các bản sao chồng sáng lên nhau — chính kỹ thuật "stamp + xoay"
 *     này tạo ra hình hoa/mạng nhện (web-like flower), không phải các cánh
 *     hoa vẽ tay tĩnh.
 *
 * "Ink" tích luỹ liên tục nên hoa càng chạy càng dày — nhưng cứ mỗi
 * CYCLE_FRAMES (~30s ở 60fps, vì frame += .3 mỗi lần) thì cleanSlate() tự
 * động xoá "ink" + reset để bắt đầu lại một vòng nở hoa mới. Nửa đầu chu kỳ
 * nét vẽ màu tím, nửa sau chuyển sang cyan (COLOR_SWITCH_FRAME) để các
 * đường chồng chéo dày đặc ở cuối chu kỳ vẫn còn phân biệt được thay vì
 * nhoè thành một khối tím. Nút "Chạy lại" gọi cùng cơ chế cleanSlate().
 *
 * Kích thước: mặc định khung không ép tỉ lệ cố định nữa (aspectRatio=null)
 * và cao 70vh để hình to, kéo dài gần sát đáy màn hình. Có thể truyền
 * height khác (số px hoặc chuỗi CSS bất kỳ như 'calc(100vh - 260px)'),
 * hoặc bật `grow` để canvas tự giãn lấp đầy phần còn lại trong một
 * container cha dạng flex-column (vd bọc trang bằng
 * <div style={{display:'flex',flexDirection:'column',minHeight:'100vh'}}>).
 */

interface FlowerAnimationProps {
  /** Tỉ lệ khung hình dạng CSS aspect-ratio, mặc định '1 / 1' (khung vuông). Đặt null để dùng `height` cố định thay vì ép tỉ lệ. */
  aspectRatio?: string | null;
  /** Chiều cao canvas khi aspectRatio = null. Nhận số (px) hoặc chuỗi CSS bất kỳ, vd '70vh', 'calc(100vh - 260px)'. */
  height?: number | string;
  /** Hiện nút Tạm dừng / Chạy lại bên dưới khung */
  showControls?: boolean;
  className?: string;
  /**
   * Khi true, khung sẽ giãn lấp đầy phần không gian dọc còn lại thay vì giữ tỉ lệ vuông — dùng khi
   * component nằm trong một container cha có `display:'flex', flexDirection:'column'` và có chiều cao
   * xác định. Khi bật `grow`, cả `aspectRatio` lẫn `height` đều bị bỏ qua.
   */
  grow?: boolean;
  /** Chiều rộng tối đa của khung vuông (số px hoặc chuỗi CSS), để khung không tràn hết chiều ngang container. Mặc định 480px. */
  maxWidth?: number | string;
}

const PETALS = 7;
const INK_SIZE = 400;
const CENTER = 200;
/** 1 chu kỳ nở hoa hoàn chỉnh ~30s ở 60fps (frame += .3 mỗi lần vẽ => 540 frame). */
const CYCLE_FRAMES = 540;
/** Mốc chuyển màu nét vẽ, đúng giữa chu kỳ. */
const COLOR_SWITCH_FRAME = 270;
const COLOR_PHASE_1 = '#8800ff';
const COLOR_PHASE_2 = '#00cfff';

export const FlowerAnimation: React.FC<FlowerAnimationProps> = ({
  aspectRatio = '1 / 1',
  height = 480,
  showControls = true,
  className = '',
  grow = false,
  maxWidth = 480,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inkRef = useRef<HTMLCanvasElement | null>(null);
  const penRef = useRef<CanvasRenderingContext2D | null>(null);
  const screenRef = useRef<CanvasRenderingContext2D | null>(null);

  const frameRef = useRef(0);
  const requestIdRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);
  const drawRef = useRef<(() => void) | null>(null);
  const cleanSlateRef = useRef<(() => void) | null>(null);

  const [running, setRunning] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const screen = canvas.getContext('2d');
    if (!screen) return;
    screenRef.current = screen;

    // Canvas phụ ẩn — nơi đường cong Lissajous tích luỹ, không bao giờ xoá
    const ink = document.createElement('canvas');
    ink.width = INK_SIZE;
    ink.height = INK_SIZE;
    const pen = ink.getContext('2d');
    if (!pen) return;
    pen.strokeStyle = COLOR_PHASE_1;
    pen.globalAlpha = 0.32;
    pen.lineWidth = 0.5;
    inkRef.current = ink;
    penRef.current = pen;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height: h } = canvas.getBoundingClientRect();
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(h * dpr);
      screen.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // eslint-disable-next-line prefer-const -- draw gọi lại chính nó qua rAF nên cần khai báo trước
    let draw: () => void;

    /** Xoá "ink" đã tích luỹ + reset bộ đếm frame, rồi tiếp tục vòng lặp vẽ (dùng cho auto-loop và nút "Chạy lại"). */
    const cleanSlate = () => {
      frameRef.current = 0;
      pen.clearRect(0, 0, ink.width, ink.height);
      if (!stoppedRef.current) {
        requestIdRef.current = window.requestAnimationFrame(draw);
      }
    };
    cleanSlateRef.current = cleanSlate;

    draw = () => {
      if (stoppedRef.current) return;

      // 1) Vẽ thêm một đoạn cong Lissajous lên "ink" (tích luỹ, không xoá)
      frameRef.current += 0.3;
      // Nửa đầu chu kỳ: tím. Nửa sau: cyan — để các đường chồng chéo dày vẫn phân biệt được.
      pen.strokeStyle = frameRef.current < COLOR_SWITCH_FRAME ? COLOR_PHASE_1 : COLOR_PHASE_2;
      const t = (frameRef.current * Math.PI) / 180;
      const rx = 150 * Math.abs(Math.cos(t)) + 50;
      const ry = 150 * Math.abs(Math.sin(t)) + 50;
      const x = CENTER + rx * Math.sin(3 * t + Math.PI / 2);
      const y = CENTER + ry * Math.sin(4 * t + Math.PI / 2);
      const x1 = CENTER + rx * Math.sin(3 * t + Math.PI);
      const y1 = CENTER - ry * Math.sin(4 * t + Math.PI);
      const x2 = CENTER + rx * Math.sin(3 * t);
      const y2 = CENTER - ry * Math.sin(4 * t);

      pen.beginPath();
      pen.moveTo(x, y);
      pen.quadraticCurveTo(x1, y1, x2, y2);
      pen.stroke();

      // 2) Vẽ lại "screen": nền đen + 7 bản sao "ink" xoay quanh tâm, cộng sáng
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      screen.clearRect(0, 0, w, h);
      screen.fillStyle = '#000';
      screen.fillRect(0, 0, w, h);
      screen.save();
      screen.translate(w / 2, h / 2);
      // 0.75 là tỉ lệ scale dùng trong video gốc
      const scale = (Math.min(w, h) / INK_SIZE) * 0.4875; // 65% kích thước gốc (0.75 × 0.65)
      screen.scale(scale, scale);
      screen.globalCompositeOperation = 'lighter';
      screen.shadowColor = '#8615de';
      screen.shadowBlur = 5;
      for (let i = 0; i < PETALS; i++) {
        screen.drawImage(ink, -CENTER, -INK_SIZE);
        screen.rotate((2 * Math.PI) / PETALS);
      }
      screen.restore();

      // 3) Hết 1 chu kỳ nở hoa (~30s) thì tự xoá và bắt đầu lại từ đầu
      if (frameRef.current >= CYCLE_FRAMES) {
        cleanSlate();
      } else {
        requestIdRef.current = window.requestAnimationFrame(draw);
      }
    };

    drawRef.current = draw;

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    requestIdRef.current = window.requestAnimationFrame(draw);

    return () => {
      ro.disconnect();
      if (requestIdRef.current !== null) {
        window.cancelAnimationFrame(requestIdRef.current);
        requestIdRef.current = null;
      }
    };
  }, []);

  const handleToggle = () => {
    setRunning((prev) => {
      const next = !prev;
      stoppedRef.current = !next;
      if (next) {
        // resume: chỉ khởi động lại rAF nếu chưa có vòng lặp nào đang chạy
        if (drawRef.current && requestIdRef.current === null) {
          requestIdRef.current = window.requestAnimationFrame(drawRef.current);
        }
      } else if (requestIdRef.current !== null) {
        window.cancelAnimationFrame(requestIdRef.current);
        requestIdRef.current = null;
      }
      return next;
    });
  };

  const handleRestart = () => {
    // Dùng chung cơ chế cleanSlate() với auto-loop 30s trong draw()
    cleanSlateRef.current?.();
    // Nếu đang tạm dừng, cleanSlate() không tự resume rAF — xoá luôn canvas
    // hiển thị ở đây để nút "Chạy lại" vẫn phản hồi ngay lập tức.
    if (stoppedRef.current) {
      const canvas = canvasRef.current;
      const screen = screenRef.current;
      if (canvas && screen) {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        screen.clearRect(0, 0, w, h);
        screen.fillStyle = '#000';
        screen.fillRect(0, 0, w, h);
      }
    }
  };

  return (
    <div
      className={`w-full ${className}`}
      style={grow ? { display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 } : undefined}
    >
      <div
        className="w-full overflow-hidden"
        aria-label="Hoạt ảnh hoa neon tím"
        style={{
          aspectRatio: grow ? undefined : aspectRatio ?? undefined,
          height: grow
            ? undefined
            : aspectRatio
            ? undefined
            : typeof height === 'number'
            ? `${height}px`
            : height,
          maxWidth: grow ? undefined : typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
          margin: grow ? undefined : '0 auto',
          flex: grow ? '1 1 auto' : undefined,
          minHeight: grow ? 0 : undefined,
          border: '2px solid #e9e9e9',
          borderRadius: '2px',
          background: '#000',
          boxShadow: '0 0 0 1px #4a4a4a, 0 12px 40px #0008',
        }}
      >
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      </div>

      {showControls && (
        <div className="flex justify-center gap-2.5 mt-4">
          <button
            type="button"
            onClick={handleToggle}
            style={btnStyle}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#30144c')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#171125')}
          >
            {running ? 'Tạm dừng' : 'Tiếp tục'}
          </button>
          <button
            type="button"
            onClick={handleRestart}
            style={btnStyle}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#30144c')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#171125')}
          >
            Chạy lại
          </button>
        </div>
      )}
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  border: '1px solid #7839be',
  borderRadius: '999px',
  background: '#171125',
  color: '#fff',
  padding: '9px 17px',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: '12px',
  transition: 'background 0.15s ease',
};
