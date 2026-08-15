import React from 'react';
import { PayrollProvider, usePayroll } from './context/PayrollContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DashboardTab } from './components/tabs/DashboardTab';
import { EmployeeProfilesTab } from './components/tabs/EmployeeProfilesTab';
import { AttendanceTab } from './components/tabs/AttendanceTab';
import { PayrollTab } from './components/tabs/PayrollTab';
import { ToastContainer } from './components/ToastContainer';
// EPCC (payroll-simple-role-gate) — theo yêu cầu người dùng: thêm đăng nhập
// thật cho app Bảng lương (tái tạo lại LoginGate + dùng chung client
// Supabase hiện có), phân quyền đơn giản 3 role (Staff/OP/Manager), chỉ
// Manager xem được mục "BẢNG LƯƠNG" (tab 'settings', mục số 4 trong
// Sidebar). Value DB vẫn 'user'/'editor'/'admin' — xem lib/auth.ts.
import { useAuthGate, canAccessTab } from './lib/auth';
import { LoginGate } from './components/LoginGate';
import { AccessDenied } from './components/AccessDenied';

const MainContent: React.FC = () => {
  const { activeTab, authRole, authProfile } = usePayroll();

  return (
    <main
      className="max-w-7xl mx-auto px-4 pb-5 space-y-6"
      style={{ flex: 1, width: '100%', paddingTop: '2mm' }}
    >
      {activeTab === 'dashboard' && <DashboardTab />}
      {activeTab === 'employees' && <EmployeeProfilesTab />}
      {activeTab === 'attendance' && <AttendanceTab />}
      {activeTab === 'settings' && (
        // EPCC (payroll-simple-role-gate) — mục "BẢNG LƯƠNG" chỉ Manager
        // (authRole === 'admin') mới xem được, CỘNG THÊM ngoại lệ cá nhân
        // cho tài khoản VP (xem TAB_ACCESS_EXCEPTIONS trong lib/auth.ts) —
        // role khác/không thuộc diện ngoại lệ sẽ thấy AccessDenied thay vì
        // nội dung bảng lương, dù có gõ trực tiếp activeTab='settings'.
        canAccessTab('settings', authRole, authProfile?.email, authProfile?.username)
          ? <PayrollTab />
          : <AccessDenied lang="vi" />
      )}
    </main>
  );
};

const AppShell: React.FC = () => {
  const { theme } = usePayroll();
  const [sidebarOpen, setSidebarOpen] = React.useState(
    () => typeof window !== 'undefined' && window.innerWidth > 768
  );

  return (
    <div data-theme={theme} className="app-layout">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onOpen={() => setSidebarOpen(true)}
      />

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
              Hỗ trợ phân quyền Staff / OP / Manager | React & Tailwind CSS
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};

// EPCC (payroll-simple-role-gate) — màn hình chờ hiển thị khi user đã đăng
// nhập thành công nhưng CHƯA được Manager phân quyền (profile.role === null).
// Không cho vào app chính, tránh render PayrollProvider với authProfile.role
// = null (canAccessTab đã tự return false cho role null, nhưng chặn sớm ở
// đây cho trải nghiệm rõ ràng hơn: "đang chờ duyệt" thay vì thấy dashboard
// trống trơn không hiểu vì sao thiếu quyền).
const PendingApproval: React.FC<{ onSignOut: () => void }> = ({ onSignOut }) => (
  <div style={{
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '20px', background: '#0b1220',
  }}>
    <div style={{
      background: '#fff', borderRadius: '16px', padding: '36px', maxWidth: '420px',
      width: '100%', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
    }}>
      <div style={{ fontSize: '40px', marginBottom: '12px' }}>⏳</div>
      <h2 style={{ fontSize: '19px', fontWeight: 700, marginBottom: '8px' }}>Đang chờ phân quyền</h2>
      <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px' }}>
        Tài khoản của bạn đã đăng nhập thành công nhưng chưa được Manager cấp quyền
        (Staff / OP / Manager). Vui lòng liên hệ Manager để được phân quyền.
      </p>
      <button
        onClick={onSignOut}
        style={{ padding: '8px 18px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'transparent', cursor: 'pointer' }}
      >Đăng xuất</button>
    </div>
  </div>
);

const AuthErrorScreen: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <div style={{
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '20px', background: '#0b1220',
  }}>
    <div style={{
      background: '#fff', borderRadius: '16px', padding: '36px', maxWidth: '420px',
      width: '100%', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
    }}>
      <h2 style={{ fontSize: '19px', fontWeight: 700, marginBottom: '8px' }}>Không thể đăng nhập</h2>
      <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px' }}>
        Đăng nhập mất quá nhiều thời gian. Vui lòng kiểm tra kết nối mạng và thử lại.
      </p>
      <button
        onClick={onRetry}
        style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#6366f1', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
      >Thử lại</button>
    </div>
  </div>
);

export default function App() {
  // EPCC (payroll-simple-role-gate) — cổng đăng nhập cho TOÀN app: chưa
  // đăng nhập → LoginGate; đăng nhập rồi nhưng chưa có role → PendingApproval;
  // đủ điều kiện → mới render PayrollProvider + AppShell như cũ. Đặt
  // useAuthGate() ở NGOÀI PayrollProvider vì auth độc lập với domain lương/
  // chấm công (PayrollProvider chỉ nên nhận authProfile đã hợp lệ).
  const { loading, session, profile, signOut, authTimedOut } = useAuthGate();
  const [lang, setLang] = React.useState<'vi' | 'en' | 'ko'>('vi');

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1220' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#cfdc00', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (authTimedOut) {
    return <AuthErrorScreen onRetry={() => window.location.reload()} />;
  }

  if (!session) {
    return <LoginGate lang={lang} setLang={setLang} theme="light" />;
  }

  if (!profile || !profile.role) {
    return <PendingApproval onSignOut={signOut} />;
  }

  return (
    <PayrollProvider authProfile={profile} onSignOut={signOut}>
      <AppShell />
    </PayrollProvider>
  );
}
