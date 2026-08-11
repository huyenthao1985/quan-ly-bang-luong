import React from 'react';
import { PayrollProvider, usePayroll } from './context/PayrollContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DashboardTab } from './components/tabs/DashboardTab';
import { EmployeeProfilesTab } from './components/tabs/EmployeeProfilesTab';
import { AttendanceTab } from './components/tabs/AttendanceTab';
import { PayrollTab } from './components/tabs/PayrollTab';
import { ToastContainer } from './components/ToastContainer';

const MainContent: React.FC = () => {
  const { activeTab } = usePayroll();

  return (
    // FIX (footer-stick-bottom): thêm flex:1 — trước đây .app-content không
    // ép chiều cao nên khi nội dung tab ngắn hơn 1 màn hình, dòng chân trang
    // (footer) bị "lửng lơ" ngay sau nội dung thay vì dính sát đáy trang,
    // để lộ khoảng trống lớn phía dưới như ảnh chụp. flex:1 ở đây làm main
    // tự giãn hết phần không gian còn lại, đẩy footer xuống đúng đáy.
    // EPCC (header-content-gap-2mm) - FIX theo yêu cầu người dùng: khoảng
    // cách giữa thanh Header và card đầu tiên (vd "Tổng hợp HC/OT theo nhân
    // viên") đang dùng py-5 (20px trên + dưới) khiến top quá rộng so với
    // mong muốn. Tách riêng padding-top = 2mm (~8px) qua style inline (Tailwind
    // không có sẵn đơn vị mm), giữ nguyên padding-bottom = 20px (py-5 cũ) để
    // không ảnh hưởng khoảng cách với footer.
    <main
      className="max-w-7xl mx-auto px-4 pb-5 space-y-6"
      style={{ flex: 1, width: '100%', paddingTop: '2mm' }}
    >
      {activeTab === 'dashboard' && <DashboardTab />}
      {activeTab === 'employees' && <EmployeeProfilesTab />}
      {activeTab === 'attendance' && <AttendanceTab />}
      {activeTab === 'settings' && <PayrollTab />}
    </main>
  );
};

const AppShell: React.FC = () => {
  const { theme } = usePayroll();

  return (
    <div data-theme={theme} className="app-layout">
      <Sidebar />

      {/* FIX (footer-stick-bottom): .app-content giờ là flex-column cao tối
          thiểu 100vh — cùng với flex:1 trên <main> ở trên và marginTop:'auto'
          trên <footer> bên dưới, đây là kiểu "sticky footer" kinh điển: nội
          dung ngắn → footer tự đẩy xuống sát đáy; nội dung dài hơn 1 màn
          hình → footer vẫn nằm ngay sau nội dung như bình thường (không đè
          lên gì cả). */}
      <div className="app-content" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header />
        <MainContent />
        <ToastContainer />

        <footer
          className="border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400"
          style={{ marginTop: 'auto', paddingTop: '24px', paddingBottom: 'calc(1mm + 12px)' }}
        >
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p>QUẢN LÝ BẢNG LƯƠNG & CHẤM CÔNG IM © 2026</p>
            <p className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              Hỗ trợ phân quyền Admin / Leader / User | React & Tailwind CSS
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <PayrollProvider>
      <AppShell />
    </PayrollProvider>
  );
}
