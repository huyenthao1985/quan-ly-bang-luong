-- ============================================================
-- employee_link_schema.sql
-- Nối tài khoản đăng nhập (public.profiles) với ĐÚNG 1 hồ sơ nhân viên
-- (public.employees) — để "đăng nhập đúng mật khẩu chỉ xem được lương của
-- người đó thôi". Chạy 1 lần trong Supabase Dashboard > SQL Editor.
--
-- An toàn để chạy nhiều lần (if not exists / create or replace), không mất
-- dữ liệu hiện có. Chạy SAU khi đã có auth_schema.sql (cần bảng profiles).
-- ============================================================

-- Cột employee_id: nullable (chưa liên kết = "chưa được Admin gán hồ sơ").
-- ON DELETE SET NULL: nếu nhân viên bị xoá khỏi bảng employees, tài khoản
-- KHÔNG bị lỗi/khoá cứng, chỉ tự rơi về trạng thái "chưa liên kết".
alter table public.profiles
  add column if not exists employee_id text references public.employees(id) on delete set null;

create index if not exists profiles_employee_id_idx on public.profiles(employee_id);

-- Chỉ admin (role = 'admin', tức "Manager" theo ROLE_LABEL) mới gán được
-- employee_id cho 1 tài khoản — kiểm tra quyền NGAY TRONG Postgres (security
-- definer), giống hệt pattern admin_assign_role trong auth_schema.sql, để
-- client không thể tự UPDATE cột này qua REST API.
create or replace function public.admin_assign_employee(target_id uuid, new_employee_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Only admins can link accounts to an employee record';
  end if;

  -- new_employee_id = null -> gỡ liên kết (cho phép Admin thu hồi quyền xem).
  if new_employee_id is not null and not exists (
    select 1 from public.employees where id = new_employee_id
  ) then
    raise exception 'Employee % does not exist', new_employee_id;
  end if;

  update public.profiles set employee_id = new_employee_id where id = target_id;
end;
$$;

revoke all on function public.admin_assign_employee(uuid, text) from public;
grant execute on function public.admin_assign_employee(uuid, text) to authenticated;

-- ============================================================
-- GHI CHÚ THIẾT KẾ (đọc trước khi mở quyền xem cho Staff/OP):
--
-- Hiện TAB_ACCESS['settings'] (mục "BẢNG LƯƠNG") chỉ cho phép role='admin'
-- (Manager) vào — Staff/OP hiện KHÔNG vào được tab này, nên employee_id ở
-- trên CHƯA có tác dụng lọc gì cho tới khi:
--   1. Mở TAB_ACCESS['settings'] cho 'user'/'editor' (Staff/OP) — trong
--      lib/auth.ts.
--   2. PayslipTab.tsx (chưa có trong tay) phải bị khoá cứng theo
--      authProfile.employee_id cho Staff/OP — không cho họ tự chọn xem
--      nhân viên khác qua bất kỳ dropdown/selector nào trong đó.
-- Nếu làm bước 1 mà CHƯA làm xong bước 2, Staff/OP sẽ vào được "BẢNG
-- LƯƠNG" và (tuỳ PayslipTab hiện có selector gì) có thể xem được lương của
-- TẤT CẢ nhân viên khác — TỆ HƠN hiện trạng. Vì vậy 2 file (lib/auth.ts và
-- PayslipTab.tsx) PHẢI sửa cùng lúc, không tách làm 2 lần deploy.
-- ============================================================
