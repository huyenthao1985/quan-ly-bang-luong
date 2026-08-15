import { useEffect, useState, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

// EPCC (payroll-simple-role-gate) — theo yêu cầu người dùng: thêm đăng nhập
// thật (tái dùng LoginGate + client Supabase hiện có) cho app Bảng lương,
// với phân quyền ĐƠN GIẢN 3 role. Value lưu trong DB (bảng `profiles.role`)
// GIỮ NGUYÊN 'user' | 'editor' | 'admin' (đúng như auth_schema.sql /
// admin_reset_password.sql / admin_assign_role đã có) — chỉ NHÃN HIỂN THỊ
// đổi thành Staff / OP / Manager (xem ROLE_LABEL bên dưới và AdminUsersPanel.tsx).
export type UserRole = 'user' | 'editor' | 'admin';

// Nhãn hiển thị theo role — dùng ở Sidebar (badge role) và AdminUsersPanel
// (dropdown phân quyền). Đổi ở đây là đổi khắp app, không cần sửa nhiều chỗ.
export const ROLE_LABEL: Record<UserRole, { vi: string; en: string; ko: string }> = {
  user: { vi: 'Staff', en: 'Staff', ko: 'Staff' },
  editor: { vi: 'OP', en: 'OP', ko: 'OP' },
  admin: { vi: 'Manager', en: 'Manager', ko: 'Manager' },
};

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  username?: string | null;
  role: UserRole | null;
  // EPCC (employee-account-link) — liên kết tài khoản đăng nhập với ĐÚNG 1 hồ sơ nhân viên
  // (public.employees.id), do Admin gán qua RPC admin_assign_employee (xem
  // employee_link_schema.sql) — null = "chưa được Admin liên kết hồ sơ". Dùng để khoá Staff/
  // OP chỉ xem được đúng bảng lương của chính họ, thay vì cho họ tự chọn nhân viên bất kỳ.
  employee_id: string | null;
}

// EPCC (payroll-employee-login-access) — bảng phân quyền theo tab:
// Khi nhân viên đăng ký (Họ tên + Mật khẩu) và được Admin phê duyệt (role: user/editor/admin),
// họ được phép vào xem mục "BẢNG LƯƠNG" (nhân viên xem phiếu lương của chính mình).
export const TAB_ACCESS: Record<string, UserRole[]> = {
  dashboard: ['user', 'editor', 'admin'],
  employees: ['user', 'editor', 'admin'],
  attendance: ['user', 'editor', 'admin'],
  settings: ['user', 'editor', 'admin'],
};

const DEFAULT_TAB_ROLES: UserRole[] = ['user', 'editor', 'admin'];

// EPCC (staff-exception-vp-kho) — tài khoản VP và KHO toàn quyền xem mục "BẢNG LƯƠNG"
const TAB_ACCESS_EXCEPTIONS: Record<string, string[]> = {
  'vp@imvina.com': ['settings'],
  'kho@imvina.com': ['settings'],
  'vp@noemail.local': ['settings'],
  'kho@noemail.local': ['settings'],
  'vp': ['settings'],
  'kho': ['settings'],
};

export function canAccessTab(
  tabId: string,
  role: UserRole | null | undefined,
  email?: string | null,
  username?: string | null
): boolean {
  if (!role) return false;
  const allowed = TAB_ACCESS[tabId] ?? DEFAULT_TAB_ROLES;
  if (allowed.includes(role)) return true;
  if (email && TAB_ACCESS_EXCEPTIONS[email.trim().toLowerCase()]?.includes(tabId)) {
    return true;
  }
  if (username && TAB_ACCESS_EXCEPTIONS[username.trim().toLowerCase()]?.includes(tabId)) {
    return true;
  }
  return false;
}

// EPCC (employee-account-link) — Admin gán/gỡ liên kết employee_id cho 1 tài khoản, qua RPC
// `admin_assign_employee` (security definer, tự kiểm tra quyền admin trong Postgres — xem
// employee_link_schema.sql). Client KHÔNG thể tự UPDATE cột employee_id qua REST API thường,
// chỉ gọi được qua RPC này, và RPC tự chặn nếu người gọi không phải admin.
export async function assignEmployeeToProfile(
  targetProfileId: string,
  employeeId: string | null
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase chưa được cấu hình.' };
  const { error } = await supabase.rpc('admin_assign_employee', {
    target_id: targetProfileId,
    new_employee_id: employeeId,
  });
  return { error: error?.message ?? null };
}

// EPCC (employee-name-password-signup) — tạo email ẩn chuẩn RFC theo mã nhân viên (@imvina.com)
// để Supabase Auth kiểm tra tính hợp lệ của email thành công mà người dùng không cần nhập email thật.
export function buildEmployeeEmail(employeeId: string): string {
  const cleanId = employeeId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return `${cleanId}@imvina.com`;
}

// EPCC (admin-is-s-manager) — theo yêu cầu người dùng: "Admin chính là S. Manager" — vị trí
// hồ sơ nhân viên là 'S. Manager' thì được coi là Manager (role 'admin', toàn quyền Bảng
// lương); mọi vị trí khác mặc định là 'user' (Staff, phạm vi xem theo payrollViewPermissions
// đã có sẵn). Dùng làm gợi ý role khi Admin duyệt tài khoản ở AdminUsersPanel — Admin vẫn
// phải bấm "Duyệt" mới thật sự kích hoạt (role trong DB vẫn null cho tới lúc đó).
export function deriveRoleFromPosition(position: string | null | undefined): UserRole {
  return position === 'S. Manager' ? 'admin' : 'user';
}

// EPCC (employee-name-password-signup) — đăng ký tài khoản THẬT qua Supabase Auth, gắn kèm
// employee_id/position vào user_metadata để loadProfile() tự liên kết employee_id NGAY lúc
// tạo hồ sơ (không cần Admin làm thêm thao tác gán riêng) — Admin chỉ còn 1 việc: bấm
// "Duyệt" (xem AdminUsersPanel.tsx) để thật sự cấp quyền vào app.
// EPCC (employee-name-password-signup) — đăng ký tài khoản nhân viên:
// Ưu tiên gọi RPC register_employee_account (chèn thẳng auth.users không qua SMTP) để
// loại bỏ hoàn toàn lỗi "email rate limit exceeded". Nếu RPC chưa được nạp thì fallback
// sang supabase.auth.signUp.
export async function signUpEmployee(
  employeeId: string,
  fullName: string,
  position: string,
  password: string
): Promise<{ error: string | null; hasSession: boolean }> {
  if (!supabase) return { error: 'Supabase chưa được cấu hình.', hasSession: false };

  const email = buildEmployeeEmail(employeeId);

  // 1. Thử đăng ký qua RPC trực tiếp (không gửi email, không bao giờ bị rate limit)
  try {
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('register_employee_account', {
      p_employee_id: employeeId,
      p_full_name: fullName,
      p_position: position,
      p_password: password,
    });

    if (!rpcErr && rpcRes) {
      const res = rpcRes as { success: boolean; error?: string };
      if (!res.success) {
        return { error: res.error || 'Không thể đăng ký tài khoản.', hasSession: false };
      }
      // Tự động đăng nhập lấy session
      const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error: loginErr?.message ?? null, hasSession: !!loginData.session };
    }
  } catch (e) {
    console.warn('[Supabase] RPC register_employee_account fallback to auth.signUp:', e);
  }

  // 2. Fallback sang Supabase Auth API mặc định
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, employee_id: employeeId, position },
    },
  });

  if (error) {
    let msg = error.message;
    if (msg.toLowerCase().includes('rate limit')) {
      msg = 'Tần suất gửi email của Supabase đã vượt giới hạn. Vui lòng chạy file register_employee_account.sql trong Supabase SQL Editor hoặc tắt "Confirm email" trong Supabase Authentication.';
    }
    return { error: msg, hasSession: false };
  }

  return { error: null, hasSession: !!data.session };
}

// EPCC (employee-name-password-signup) — danh sách rút gọn (id/họ tên/vị trí) để màn hình
// Đăng ký hiển thị dropdown "chọn họ tên" TRƯỚC khi đăng nhập (chưa có session). Đọc từ VIEW
// `public.employees_directory` (xem employee_link_schema.sql) — CHỈ lộ 3 cột này ra cho
// người chưa đăng nhập.
export interface EmployeeDirectoryEntry {
  id: string;
  full_name: string;
  position: string;
}

export async function fetchEmployeeDirectory(): Promise<EmployeeDirectoryEntry[]> {
  if (!supabase) {
    return [];
  }
  let { data, error } = await supabase
    .from('employees_directory')
    .select('id, full_name, position')
    .order('full_name');
  if (error || !data || data.length === 0) {
    const { data: empData, error: empErr } = await supabase
      .from('employees')
      .select('id, full_name, position')
      .order('full_name');
    if (!empErr && empData && empData.length > 0) {
      data = empData;
    }
  }
  return (data as EmployeeDirectoryEntry[]) ?? [];
}

// useAuthGate — hook DUY NHẤT quản lý trạng thái đăng nhập cho App.tsx, dùng
// CHUNG client `supabase` đã có sẵn ở ./supabase (client đang lưu dữ liệu
// employees/attendance) — KHÔNG tạo thêm client thứ 2.
const AUTH_TIMEOUT_MS = 15_000;
function withAuthTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) =>
      setTimeout(() => reject(new Error('auth-timeout')), AUTH_TIMEOUT_MS)
    ),
  ]);
}

export function useAuthGate() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authTimedOut, setAuthTimedOut] = useState(false);

  const loadProfile = useCallback(async (
    userId: string,
    email: string,
    fallbackName: string,
    employeeId?: string | null
  ) => {
    if (!supabase) return;
    let { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (!prof) {
      // Chưa có hồ sơ (VD lần đầu xác nhận email) -> tự tạo, role = null
      // (nghĩa là "đang chờ Manager phân quyền"). EPCC (employee-name-password-signup) —
      // nếu tài khoản vừa đăng ký qua signUpEmployee() (có employee_id trong
      // user_metadata), liên kết NGAY employee_id ở đây — Admin chỉ còn việc bấm "Duyệt"
      // (xem AdminUsersPanel.tsx), không cần gán employee_id thủ công riêng nữa.
      const { data: created } = await supabase
        .from('profiles')
        .insert({ id: userId, full_name: fallbackName, email, role: null, employee_id: employeeId ?? null })
        .select()
        .single();
      prof = created;
    }
    setProfile((prof as Profile) ?? null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await loadProfile(
        user.id,
        user.email || '',
        user.user_metadata?.full_name || user.email || '',
        user.user_metadata?.employee_id
      );
    }
  }, [loadProfile]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let mounted = true;

    withAuthTimeout(supabase.auth.getSession())
      .then(async ({ data: { session } }) => {
        if (!mounted) return;
        setSession(session);
        if (session?.user) {
          await withAuthTimeout(
            loadProfile(
              session.user.id,
              session.user.email || '',
              session.user.user_metadata?.full_name || session.user.email || '',
              session.user.user_metadata?.employee_id
            )
          );
        }
        if (mounted) setLoading(false);
      })
      .catch((err: Error) => {
        console.warn('useAuthGate: hết thời gian chờ đăng nhập —', err.message);
        if (mounted) {
          setAuthTimedOut(true);
          setLoading(false);
        }
      });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        await loadProfile(
          newSession.user.id,
          newSession.user.email || '',
          newSession.user.user_metadata?.full_name || newSession.user.email || '',
          newSession.user.user_metadata?.employee_id
        );
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  return { loading, session, profile, signOut, refreshProfile, authTimedOut };
}
