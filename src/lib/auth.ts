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
}

// EPCC (payroll-simple-role-gate) — bảng phân quyền theo tab, khớp đúng 4
// activeTab của app Bảng lương (xem ITEMS trong Sidebar.tsx / MainContent
// trong App.tsx): 'dashboard' | 'employees' | 'attendance' | 'settings'.
// Theo yêu cầu người dùng: CHỈ mục 'settings' (mục số 4 — "BẢNG LƯƠNG")
// giới hạn cho Manager (role 'admin'); 3 mục còn lại mọi role đã đăng nhập
// đều xem được.
export const TAB_ACCESS: Record<string, UserRole[]> = {
  dashboard: ['user', 'editor', 'admin'],
  employees: ['user', 'editor', 'admin'],
  attendance: ['user', 'editor', 'admin'],
  settings: ['admin'], // Chỉ Manager xem được mục Bảng lương
};

const DEFAULT_TAB_ROLES: UserRole[] = ['user', 'editor', 'admin'];

export function canAccessTab(tabId: string, role: UserRole | null | undefined): boolean {
  if (!role) return false;
  const allowed = TAB_ACCESS[tabId] ?? DEFAULT_TAB_ROLES;
  return allowed.includes(role);
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

  const loadProfile = useCallback(async (userId: string, email: string, fallbackName: string) => {
    if (!supabase) return;
    let { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (!prof) {
      // Chưa có hồ sơ (VD lần đầu xác nhận email) -> tự tạo, role = null
      // (nghĩa là "đang chờ Manager phân quyền").
      const { data: created } = await supabase
        .from('profiles')
        .insert({ id: userId, full_name: fallbackName, email, role: null })
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
      await loadProfile(user.id, user.email || '', user.user_metadata?.full_name || user.email || '');
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
              session.user.user_metadata?.full_name || session.user.email || ''
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
          newSession.user.user_metadata?.full_name || newSession.user.email || ''
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
