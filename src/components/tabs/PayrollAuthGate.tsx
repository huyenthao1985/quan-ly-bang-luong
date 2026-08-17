import React, { useState, useEffect } from 'react';
import { Lock, KeyRound, User, Eye, EyeOff, ShieldCheck, LogOut, CheckCircle2, AlertCircle, UserPlus, LogIn } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { EmployeeDirectoryEntry, fetchEmployeeDirectory, signUpEmployee, buildEmployeeEmail } from '../../lib/auth';
import { usePayroll } from '../../context/PayrollContext';
import { FlowerAnimation } from './FlowerAnimation';

interface PayrollAuthGateProps {
  onSuccess?: (employeeId: string) => void;
}

export const PayrollAuthGate: React.FC<PayrollAuthGateProps> = ({ onSuccess }) => {
  const { employees, setSelectedEmployeeId, authProfile, authRole } = usePayroll();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [directory, setDirectory] = useState<EmployeeDirectoryEntry[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    fetchEmployeeDirectory().then((list) => {
      setDirectory(list);
      if (list.length > 0 && !selectedEmpId) {
        setSelectedEmpId(list[0].id);
      }
    });
  }, []);

  const selectedEmp = directory.find((e) => e.id === selectedEmpId) || directory[0];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError('Chưa kết nối cơ sở dữ liệu Supabase.');
      return;
    }
    if (!selectedEmp) {
      setError('Vui lòng chọn họ tên nhân viên.');
      return;
    }
    if (!password) {
      setError('Vui lòng nhập mật khẩu.');
      return;
    }

    setError('');
    setNotice('');
    setLoading(true);

    const cleanId = selectedEmp.id.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const candidates = [
      `${cleanId}@imvina.com`,
      `${cleanId}@noemail.local`,
    ];

    let loginSuccess = false;
    let lastErrorMsg = '';

    for (const cand of candidates) {
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: cand,
        password,
      });

      if (!signErr) {
        loginSuccess = true;
        break;
      } else {
        lastErrorMsg = signErr.message;
      }
    }

    setLoading(false);

    if (loginSuccess) {
      setSelectedEmployeeId(selectedEmp.id);
      if (onSuccess) {
        onSuccess(selectedEmp.id);
      }
    } else {
      if (lastErrorMsg.toLowerCase().includes('invalid login credentials')) {
        setError('Mật khẩu không chính xác hoặc tài khoản chưa được đăng ký/phê duyệt.');
      } else {
        setError(lastErrorMsg || 'Đăng nhập thất bại.');
      }
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError('Chưa kết nối cơ sở dữ liệu Supabase.');
      return;
    }
    if (!selectedEmp) {
      setError('Vui lòng chọn họ tên nhân viên.');
      return;
    }
    if (!password || password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Xác nhận mật khẩu không khớp.');
      return;
    }

    setError('');
    setNotice('');
    setLoading(true);

    const { error: regErr } = await signUpEmployee(
      selectedEmp.id,
      selectedEmp.full_name,
      selectedEmp.position,
      password
    );

    setLoading(false);

    if (regErr) {
      setError(regErr);
    } else {
      setNotice(`Đăng ký thành công cho ${selectedEmp.full_name}! Vui lòng thông báo Admin phê duyệt để xem bảng lương.`);
      setPassword('');
      setConfirmPassword('');
      setTimeout(() => setMode('login'), 2000);
    }
  };

  return (
    <>
    <div className="max-w-md mx-auto my-6 p-6 bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 dark:border-slate-700/60 transition-all">
      {/* Header */}
      <div className="text-center mb-5">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
          {mode === 'login' ? 'Đăng Nhập Xem Bảng Lương' : 'Đăng Ký Tài Khoản Xem Lương'}
        </h2>
      </div>

      {/* Thông báo lỗi / thành công */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{notice}</span>
        </div>
      )}

      <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-4">
        {/* Chọn Họ tên nhân viên */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Họ tên nhân viên
          </label>
          <div className="relative">
            <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
            >
              {directory.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} — {emp.position} ({emp.id})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Mật khẩu */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Mật khẩu
          </label>
          <div className="relative">
            <KeyRound className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu"
              className="w-full pl-9 pr-9 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Xác nhận mật khẩu khi Đăng ký */}
        {mode === 'register' && (
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Xác nhận mật khẩu
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu"
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Nút Submit — 3D */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '11px 16px',
            background: 'linear-gradient(180deg, #5b8dee 0%, #3b5fc0 100%)',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 700,
            borderRadius: '10px',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 6px 0 #2240a0, 0 8px 16px rgba(59,95,192,0.45)',
            transform: 'translateY(0)',
            transition: 'transform 0.08s ease, box-shadow 0.08s ease',
            opacity: loading ? 0.65 : 1,
            letterSpacing: '0.02em',
          }}
          onMouseDown={(e) => {
            if (!loading) {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(4px)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 0 #2240a0, 0 4px 8px rgba(59,95,192,0.35)';
            }
          }}
          onMouseUp={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 0 #2240a0, 0 8px 16px rgba(59,95,192,0.45)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 0 #2240a0, 0 8px 16px rgba(59,95,192,0.45)';
          }}
        >
          {mode === 'login' ? (
            <>
              <LogIn className="w-4 h-4" />
              <span>{loading ? 'Đang xác thực…' : 'Đăng nhập xem lương'}</span>
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4" />
              <span>{loading ? 'Đang gửi đăng ký…' : 'Đăng ký tài khoản'}</span>
            </>
          )}
        </button>
      </form>

      {/* Chuyển đổi giữa Đăng nhập / Đăng ký */}
      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 text-center">
        {mode === 'login' ? (
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Chưa có tài khoản xem lương?{' '}
            <button
              type="button"
              onClick={() => { setMode('register'); setError(''); setNotice(''); }}
              className="text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
            >
              Đăng ký ngay
            </button>
          </p>
        ) : (
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Đã có tài khoản?{' '}
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); setNotice(''); }}
              className="text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
            >
              Quay lại đăng nhập
            </button>
          </p>
        )}
      </div>
    </div>

    {/* Hiệu ứng hoa xoay neon tím — lấp khoảng trống nền tối bên dưới thẻ đăng nhập */}
    <div className="max-w-md mx-auto">
      <FlowerAnimation />
    </div>
    </>
  );
};
