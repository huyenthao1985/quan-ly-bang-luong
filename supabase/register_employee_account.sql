-- ============================================================
-- register_employee_account.sql
-- Hàm đăng ký tài khoản nhân viên TRỰC TIẾP vào auth.users mà KHÔNG cần gửi email,
-- giúp loại bỏ hoàn toàn lỗi "email rate limit exceeded" của Supabase.
-- Chạy file này 1 lần trong: Supabase Dashboard > SQL Editor
-- ============================================================

-- Bật extension pgcrypto nếu chưa có để băm mật khẩu chuẩn bcrypt
create extension if not exists "pgcrypto";

create or replace function public.register_employee_account(
  p_employee_id text,
  p_full_name text,
  p_position text,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_user_id uuid;
  v_email text;
  v_encrypted_pw text;
begin
  if p_employee_id is null or trim(p_employee_id) = '' then
    return jsonb_build_object('success', false, 'error', 'Mã nhân viên không hợp lệ');
  end if;

  if p_password is null or length(p_password) < 6 then
    return jsonb_build_object('success', false, 'error', 'Mật khẩu phải có ít nhất 6 ký tự');
  end if;

  v_email := lower(trim(p_employee_id)) || '@imvina.com';
  
  -- Kiểm tra xem tài khoản đã tồn tại chưa
  select id into v_user_id from auth.users where email = v_email;
  if v_user_id is not null then
    return jsonb_build_object('success', false, 'error', 'Tài khoản nhân viên ' || p_full_name || ' (' || p_employee_id || ') đã được đăng ký trước đó. Vui lòng đăng nhập hoặc liên hệ Admin nếu quên mật khẩu.');
  end if;

  v_user_id := gen_random_uuid();
  v_encrypted_pw := crypt(p_password, gen_salt('bf'));

  -- Thêm trực tiếp vào auth.users với email_confirmed_at = now() để không cần gửi email xác nhận
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    v_encrypted_pw,
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', p_full_name, 'employee_id', p_employee_id, 'position', p_position),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  -- Tạo hoặc cập nhật profiles với role = null (chờ Admin duyệt)
  insert into public.profiles (id, full_name, email, role, employee_id)
  values (v_user_id, p_full_name, v_email, null, p_employee_id)
  on conflict (id) do update set
    full_name = excluded.full_name,
    email = excluded.email,
    employee_id = excluded.employee_id;

  return jsonb_build_object('success', true, 'user_id', v_user_id);
exception when others then
  return jsonb_build_object('success', false, 'error', SQLERRM);
end;
$$;

-- Cấp quyền gọi hàm cho người chưa đăng nhập (anon) để đăng ký
revoke all on function public.register_employee_account(text, text, text, text) from public;
grant execute on function public.register_employee_account(text, text, text, text) to anon, authenticated;
