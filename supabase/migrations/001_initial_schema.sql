-- ============================================================
-- Migration 001: Initial Schema for Quản Lý Bảng Lương
-- Chạy lệnh này trong Supabase SQL Editor
-- ============================================================

-- Enable UUID extension (dùng cho id tự sinh nếu cần)
create extension if not exists "uuid-ossp";

-- ============================================================
-- Bảng nhân viên (employees)
-- ============================================================
create table if not exists employees (
  id                   text        primary key,
  full_name            text        not null,
  birth_date           text,
  department           text,
  position             text,
  start_date           text,
  phone                text,
  is_female            boolean     default false,
  base_salary          numeric     default 0,
  dependents_count     integer     default 0,
  contract_type        text,
  email                text,
  bank_account         text,
  bank_name            text,
  union_member         boolean     default false,
  insurance_base_salary numeric,
  number_of_dependents  integer,
  comp_leave_balance   numeric,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

comment on table employees is 'Hồ sơ nhân viên';

-- ============================================================
-- Bảng chấm công (attendance_records)
-- Key format: {employeeId}_{year}_{month}
-- ============================================================
create table if not exists attendance_records (
  id                              text        primary key,  -- {employeeId}_{year}_{month}
  employee_id                     text        references employees(id) on delete cascade,
  month                           integer     not null check (month between 1 and 12),
  year                            integer     not null check (year between 2000 and 2100),
  month_standard_days             numeric,
  daily_records                   jsonb       default '{}', -- DailyAttendance records by date

  -- Manual overrides
  manual_female_support_hours     numeric,
  manual_transferred_annual_leave numeric,
  manual_personal_tax             numeric,
  manual_insurance_arrears        numeric,
  manual_bonus_other              numeric,
  manual_night_ot50_hours         numeric,
  manual_night_ot60_hours         numeric,
  manual_ot70_hours               numeric,
  manual_holiday_night_ot90_hours numeric,
  manual_min_wage_leave_days      numeric,
  manual_number_of_dependents     integer,
  manual_document_fee             numeric,
  manual_other_allowance          numeric,
  manual_referral_bonus           numeric,
  manual_other_addition           numeric,
  manual_other_deduction          numeric,
  manual_unauthorized_absence_days integer,

  created_at                      timestamptz default now(),
  updated_at                      timestamptz default now(),

  unique(employee_id, year, month)
);

comment on table attendance_records is 'Bảng chấm công theo tháng';
comment on column attendance_records.daily_records is 'Dữ liệu điểm danh từng ngày (JSON), key = YYYY-MM-DD';

-- ============================================================
-- Bảng cấu hình lương (salary_config) — 1 dòng duy nhất
-- ============================================================
create table if not exists salary_config (
  id         integer     primary key default 1,
  config     jsonb       not null,
  updated_at timestamptz default now(),
  constraint single_row_only check (id = 1)
);

comment on table salary_config is 'Cấu hình hệ số lương và phụ cấp theo chức vụ (1 dòng)';

-- ============================================================
-- Row Level Security (RLS)
-- Mặc định cho phép tất cả — cần bật Auth sau khi thêm đăng nhập
-- ============================================================
alter table employees           enable row level security;
alter table attendance_records  enable row level security;
alter table salary_config       enable row level security;

-- Drop existing policies if any (idempotent)
drop policy if exists "allow_all_employees"          on employees;
drop policy if exists "allow_all_attendance_records" on attendance_records;
drop policy if exists "allow_all_salary_config"      on salary_config;

create policy "allow_all_employees"
  on employees for all
  using (true)
  with check (true);

create policy "allow_all_attendance_records"
  on attendance_records for all
  using (true)
  with check (true);

create policy "allow_all_salary_config"
  on salary_config for all
  using (true)
  with check (true);

-- ============================================================
-- Trigger tự update updated_at
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at_employees          on employees;
drop trigger if exists set_updated_at_attendance_records on attendance_records;
drop trigger if exists set_updated_at_salary_config      on salary_config;

create trigger set_updated_at_employees
  before update on employees
  for each row execute function update_updated_at();

create trigger set_updated_at_attendance_records
  before update on attendance_records
  for each row execute function update_updated_at();

create trigger set_updated_at_salary_config
  before update on salary_config
  for each row execute function update_updated_at();
