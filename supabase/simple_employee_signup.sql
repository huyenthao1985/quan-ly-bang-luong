-- ============================================================
-- simple_employee_signup.sql
-- Hỗ trợ đăng ký kiểu "chọn Họ tên nhân viên + đặt mật khẩu" (thay vì nhập
-- email thật) — xem signUpEmployee()/fetchEmployeeDirectory() trong lib/auth.ts.
-- Chạy SAU auth_schema.sql và employee_link_schema.sql.
-- ============================================================

-- View CHỈ lộ 3 cột an toàn (id, họ tên, vị trí) — KHÔNG bao giờ thêm cột
-- lương/số tài khoản ngân hàng/số điện thoại vào view này, vì view này được
-- cấp quyền đọc cho người CHƯA đăng nhập (anon) để hiện dropdown "chọn họ
-- tên" ở màn hình Đăng ký.
create or replace view public.employees_directory as
select id, full_name, position from public.employees;

grant select on public.employees_directory to anon, authenticated;

-- ============================================================
-- GHI CHÚ (đọc trước khi bật form Đăng ký cho người dùng thật):
--
-- 1. View trên chạy với quyền của người TẠO view (không bị RLS của bảng
--    employees áp lại) — đây là hành vi mong muốn để lộ ĐÚNG 3 cột này,
--    nhưng đồng nghĩa: KHÔNG được thêm cột nhạy cảm vào view.
--
-- 2. Bảng gốc `public.employees` (đầy đủ cột, có lương/bank) hiện có RLS ra
--    sao thì mình CHƯA nắm được (không có trong các file đã xem) — nếu bảng
--    gốc đang cho phép anon SELECT rộng, các màn hình khác dùng thẳng bảng
--    `employees` (không qua view) có thể đã lộ dữ liệu lương/bank cho người
--    chưa đăng nhập từ trước, không liên quan tới thay đổi trong file này.
--    Nên kiểm tra riêng: Supabase Dashboard > Authentication > Policies >
--    bảng employees.
--
-- 3. "Admin chính là S. Manager": deriveRoleFromPosition() trong lib/auth.ts
--    tự suy role gợi ý từ vị trí ('S. Manager' -> 'admin', còn lại ->
--    'user') — đây CHỈ là gợi ý hiển thị ở AdminUsersPanel, role thật trong
--    DB vẫn giữ null cho tới khi Admin bấm "Duyệt" (gọi admin_assign_role).
--    Muốn ép cứng luật này ở tầng Postgres (không tin tưởng Admin bấm đúng),
--    có thể sửa admin_assign_role thêm điều kiện:
--      new_role = 'admin' chỉ được phép nếu profiles.employee_id đang trỏ
--      tới 1 nhân viên có employees.position = 'S. Manager'.
--    Chưa áp luật này ở đây vì auth_schema.sql (chứa admin_assign_role) có
--    thể đã được chỉnh sửa thêm ở phía bạn — sửa thẳng có thể ghi đè mất.
-- ============================================================
