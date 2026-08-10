# Quản Lý Bảng Lương & Chấm Công

Ứng dụng quản lý bảng lương và chấm công cho doanh nghiệp, xây dựng với React + Vite + TypeScript + Supabase.

## 🚀 Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4
- **Charts**: Recharts
- **Animations**: Motion (Framer Motion)
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel

## ✨ Tính năng

- 📊 **Dashboard** tổng quan chấm công và lương
- 👤 **Hồ sơ nhân viên** — thêm, sửa, xóa
- 📅 **Chấm công** — nhập điểm danh theo ngày, tháng
- 💰 **Bảng lương** — tính lương tự động theo phụ cấp chức vụ
- 🧾 **Phiếu lương** — xuất chi tiết từng nhân viên
- ⚙️ **Cài đặt** — cấu hình hệ số lương, phụ cấp
- 🌙 **Dark mode**
- 🔐 **Phân quyền** Admin / Leader / User

## 🗄️ Database (Supabase)

Xem SQL migration tại: [`supabase/migrations/001_initial_schema.sql`](./supabase/migrations/001_initial_schema.sql)

## ⚙️ Cài đặt local

```bash
# Clone repo
git clone https://github.com/huyenthao1985/quan-ly-bang-luong.git
cd quan-ly-bang-luong

# Cài dependencies
npm install

# Tạo file env
cp .env.example .env.local
# Điền VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY

# Chạy dev server
npm run dev
```

## 🌐 Deploy

- **Vercel**: Kết nối GitHub repo → tự động deploy khi push
- **Supabase**: Chạy migration SQL trong Supabase SQL Editor

## 📝 Environment Variables

| Variable | Mô tả |
|----------|-------|
| `VITE_SUPABASE_URL` | URL Supabase project |
| `VITE_SUPABASE_ANON_KEY` | Anon/public key từ Supabase |

---

© 2026 Quản Lý Bảng Lương IM
