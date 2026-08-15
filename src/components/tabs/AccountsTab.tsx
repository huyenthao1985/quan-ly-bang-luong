import React, { useState, useEffect } from 'react';
import { Users, UserCheck, KeyRound, RefreshCw, CheckCircle, UserX, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { usePayroll } from '../../context/PayrollContext';
import { Profile, UserRole, deriveRoleFromPosition, ROLE_LABEL } from '../../lib/auth';

export const AccountsTab: React.FC = () => {
  const { employees, showToast } = usePayroll();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [userTab, setUserTab] = useState<'pending' | 'all'>('pending');
  const [resetTargetId, setResetTargetId] = useState<string | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [showResetPass, setShowResetPass] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  const loadProfiles = async () => {
    if (!supabase) return;
    setLoadingProfiles(true);
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (!error && data) {
      setProfiles(data as Profile[]);
    }
    setLoadingProfiles(false);
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const pendingUsers = profiles.filter((p) => !p.role);

  const handleApproveUser = async (profile: Profile, chosenRole?: UserRole) => {
    if (!supabase) return;
    setApprovingId(profile.id);
    const emp = employees.find((e) => e.id === profile.employee_id);
    const targetRole: UserRole = chosenRole || (emp ? deriveRoleFromPosition(emp.position) : 'user');

    let success = false;
    try {
      const { error: rpcErr } = await supabase.rpc('admin_assign_role', {
        target_id: profile.id,
        new_role: targetRole,
      });
      if (!rpcErr) {
        success = true;
      }
    } catch (e) {
      console.warn('RPC admin_assign_role failed, fallback to direct update', e);
    }

    if (!success) {
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ role: targetRole })
        .eq('id', profile.id);
      if (!updateErr) success = true;
    }

    setApprovingId(null);
    if (success) {
      showToast(`Đã duyệt tài khoản cho ${profile.full_name} (${ROLE_LABEL[targetRole]?.vi ?? targetRole}) thành công!`);
      loadProfiles();
    } else {
      showToast(`Không thể duyệt tài khoản. Vui lòng kiểm tra quyền Admin.`, 'error');
    }
  };

  const handleRejectUser = async (profile: Profile) => {
    if (!supabase) return;
    if (!window.confirm(`Bạn có chắc muốn xóa/từ chối yêu cầu của ${profile.full_name}?`)) return;
    await supabase.from('profiles').delete().eq('id', profile.id);
    showToast(`Đã xóa yêu cầu của ${profile.full_name}`);
    loadProfiles();
  };

  const handleResetPassword = async (targetId: string, newPass: string) => {
    if (!supabase) return;
    if (!newPass || newPass.length < 6) {
      showToast('Mật khẩu mới phải có ít nhất 6 ký tự!', 'error');
      return;
    }
    setResetBusy(true);
    let success = false;
    let errorMsg = '';

    try {
      const { error } = await supabase.rpc('admin_reset_password', {
        target_id: targetId,
        new_password: newPass,
      });
      if (!error) {
        success = true;
      } else {
        errorMsg = error.message;
      }
    } catch (e: any) {
      errorMsg = e?.message || 'Lỗi kết nối';
    }

    setResetBusy(false);
    if (success) {
      showToast('Đã đặt lại mật khẩu mới cho nhân viên thành công!');
      setResetTargetId(null);
      setNewPasswordInput('');
    } else {
      showToast(`Không thể đặt lại mật khẩu: ${errorMsg}`, 'error');
    }
  };

  return (
    <div className="space-y-[2mm]">
      <div className="p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
        {/* Header & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                Quản Lý Tài Khoản &amp; Đặt Lại Mật Khẩu
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Phê duyệt quyền truy cập và hỗ trợ cấp lại mật khẩu cho nhân viên
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-900 text-xs">
              <button
                type="button"
                onClick={() => setUserTab('pending')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                  userTab === 'pending'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>Chờ duyệt</span>
                {pendingUsers.length > 0 && (
                  <span className="px-1.5 py-0.2 text-[10px] bg-red-600 text-white rounded-full font-black animate-pulse">
                    {pendingUsers.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setUserTab('all')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                  userTab === 'all'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                <KeyRound className="w-4 h-4" />
                <span>Tất cả tài khoản ({profiles.length})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={loadProfiles}
              disabled={loadingProfiles}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingProfiles ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        {/* TAB 1: Danh sách tài khoản chờ duyệt */}
        {userTab === 'pending' && (
          <div>
            {pendingUsers.length === 0 ? (
              <div className="py-6 px-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs flex flex-col items-center justify-center gap-2 text-center">
                <CheckCircle className="w-6 h-6 text-emerald-500" />
                <span className="font-semibold text-sm">Không có tài khoản nào đang chờ phê duyệt.</span>
                <span className="text-slate-500 dark:text-slate-400">Tất cả tài khoản đăng ký hiện tại đã được kích hoạt đầy đủ.</span>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                  Bấm nút <strong>"✓ Duyệt (Confirm)"</strong> màu xanh để kích hoạt tài khoản xem bảng lương cho nhân viên:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {pendingUsers.map((user) => {
                    const emp = employees.find((e) => e.id === user.employee_id);
                    const suggestedRole = emp ? deriveRoleFromPosition(emp.position) : 'user';
                    const isApproving = approvingId === user.id;

                    return (
                      <div
                        key={user.id}
                        className="flex items-center justify-between gap-3 p-3 bg-amber-50/60 dark:bg-slate-900 rounded-xl border border-amber-300 dark:border-amber-700 shadow-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                            {user.full_name}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                            <span className="font-semibold text-blue-600 dark:text-blue-400">
                              {emp?.position || 'Nhân viên'}
                            </span>
                            <span>•</span>
                            <span>Mã: {user.employee_id || user.email.split('@')[0]}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={isApproving}
                            onClick={() => handleApproveUser(user, suggestedRole)}
                            className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition-all cursor-pointer"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>{isApproving ? 'Đang duyệt…' : '✓ Duyệt'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectUser(user)}
                            title="Xóa/Từ chối yêu cầu"
                            className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Tất cả tài khoản & Reset Password */}
        {userTab === 'all' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {profiles.map((user) => {
                const emp = employees.find((e) => e.id === user.employee_id);
                const isResetting = resetTargetId === user.id;

                return (
                  <div
                    key={user.id}
                    className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between gap-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                          <span>{user.full_name}</span>
                          {user.role === 'admin' ? (
                            <span className="px-1.5 py-0.2 bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-[10px] rounded font-bold">Admin</span>
                          ) : user.role ? (
                            <span className="px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] rounded font-semibold">Đã duyệt</span>
                          ) : (
                            <span className="px-1.5 py-0.2 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[10px] rounded font-semibold">Chờ duyệt</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          <span>Mã NV: <strong className="text-slate-700 dark:text-slate-300">{user.employee_id || user.email.split('@')[0]}</strong></span>
                          {emp && <span className="ml-1.5 text-blue-600 dark:text-blue-400 font-semibold">({emp.position})</span>}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRejectUser(user)}
                        title="Xóa tài khoản"
                        className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors cursor-pointer"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Vùng Reset Mật khẩu */}
                    {isResetting ? (
                      <div className="mt-1 p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-800 space-y-2 animate-fadeIn">
                        <div className="text-[11px] font-bold text-blue-800 dark:text-blue-300 flex items-center justify-between">
                          <span>Đặt mật khẩu mới:</span>
                          <button
                            type="button"
                            onClick={() => setNewPasswordInput('123456')}
                            className="text-[11px] text-blue-600 underline font-semibold cursor-pointer"
                          >
                            Gợi ý: 123456
                          </button>
                        </div>
                        <div className="relative flex items-center">
                          <input
                            type={showResetPass ? 'text' : 'password'}
                            value={newPasswordInput}
                            onChange={(e) => setNewPasswordInput(e.target.value)}
                            placeholder="Nhập mật khẩu mới (>= 6 ký tự)"
                            className="w-full text-xs px-2.5 py-1.5 pr-8 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-200"
                          />
                          <button
                            type="button"
                            onClick={() => setShowResetPass((v) => !v)}
                            className="absolute right-2 text-slate-400 hover:text-slate-600"
                          >
                            {showResetPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            disabled={resetBusy}
                            onClick={() => handleResetPassword(user.id, newPasswordInput)}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1.5 px-3 rounded-md transition-all cursor-pointer"
                          >
                            {resetBusy ? 'Đang lưu…' : 'Lưu mật khẩu'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setResetTargetId(null);
                              setNewPasswordInput('');
                            }}
                            className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-md cursor-pointer"
                          >
                            Hủy
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end pt-1.5 border-t border-slate-200/60 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => {
                            setResetTargetId(user.id);
                            setNewPasswordInput('123456');
                            setShowResetPass(false);
                          }}
                          className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 transition-all cursor-pointer"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Đổi / Reset Mật khẩu</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
