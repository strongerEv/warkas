-- ============================================================
-- WARKAS — POS UMKM
-- 0001: Skema dasar (extensions, enum, tabel, index, trigger)
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- Enums ----------
do $$ begin
  create type public.user_role as enum ('admin', 'kasir');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.shift_status as enum ('open', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('cash', 'qris', 'transfer', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_source as enum ('cash', 'non_cash');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.stock_reason as enum ('initial', 'sale', 'purchase', 'adjustment', 'void');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.expense_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.reset_type as enum ('simulation', 'transactional', 'factory');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.recurrence as enum ('weekly', 'monthly');
exception when duplicate_object then null; end $$;

-- ---------- stores ----------
create table if not exists public.stores (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  address               text,
  phone                 text,
  logo_url              text,
  -- Toggle sandbox. Dibaca server-side oleh RPC penulis data,
  -- sehingga flag is_simulation tidak pernah ditentukan oleh client.
  simulation_mode       boolean not null default false,
  -- Batas nominal pengeluaran yang boleh diinput kasir tanpa approval admin.
  cashier_expense_limit numeric(14,2) not null default 100000,
  currency_prefix       text not null default 'Rp',
  -- zona waktu toko, dipakai untuk penomoran struk & pengelompokan laporan per jam/hari
  timezone              text not null default 'Asia/Jakarta',
  receipt_footer        text default 'Terima kasih telah berbelanja',
  created_at            timestamptz not null default now()
);

-- ---------- profiles ----------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  store_id   uuid references public.stores (id) on delete cascade,
  name       text not null,
  role       public.user_role not null default 'kasir',
  -- kode + PIN dipakai untuk login cepat di device toko
  code       text unique,
  pin_hash   text,
  email      text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists profiles_store_idx on public.profiles (store_id);

-- ---------- categories ----------
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores (id) on delete cascade,
  name       text not null,
  color      text not null default '#64748b',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  is_simulation boolean not null default false,
  unique (store_id, name)
);

-- ---------- products ----------
create table if not exists public.products (
  id                   uuid primary key default gen_random_uuid(),
  store_id             uuid not null references public.stores (id) on delete cascade,
  category_id          uuid references public.categories (id) on delete set null,
  name                 text not null,
  price                numeric(14,2) not null default 0 check (price >= 0),
  stock                integer not null default 0,
  low_stock_threshold  integer not null default 5,
  -- produk jasa/olahan yang stoknya tidak dihitung
  track_stock          boolean not null default true,
  image_url            text,
  sku                  text,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- Produk sandbox dipisah total dari produk asli: saat mode simulasi aktif
  -- kasir hanya bisa menjual produk simulasi, sehingga stok asli tak tersentuh.
  is_simulation        boolean not null default false,
  unique (store_id, sku)
);

create index if not exists products_store_idx    on public.products (store_id);
create index if not exists products_category_idx on public.products (category_id);
create index if not exists products_sim_idx      on public.products (store_id, is_simulation, is_active);

-- ---------- shifts ----------
create table if not exists public.shifts (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  opening_cash  numeric(14,2) not null default 0,
  closing_cash  numeric(14,2),
  expected_cash numeric(14,2),
  difference    numeric(14,2) generated always as (closing_cash - expected_cash) stored,
  status        public.shift_status not null default 'open',
  note          text,
  opened_at     timestamptz not null default now(),
  closed_at     timestamptz,
  is_simulation boolean not null default false
);

create index if not exists shifts_user_idx on public.shifts (user_id, opened_at desc);
create index if not exists shifts_sim_idx  on public.shifts (store_id, is_simulation, opened_at desc);

-- Satu kasir hanya boleh punya satu shift terbuka pada satu waktu.
create unique index if not exists shifts_one_open_per_user
  on public.shifts (user_id) where (status = 'open');

-- ---------- transactions ----------
create sequence if not exists public.transaction_code_seq;

create table if not exists public.transactions (
  id             uuid primary key default gen_random_uuid(),
  store_id       uuid not null references public.stores (id) on delete cascade,
  shift_id       uuid references public.shifts (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  code           text not null unique,
  -- id lokal dari device offline; mencegah transaksi dobel saat sync ulang
  client_ref     text unique,
  subtotal       numeric(14,2) not null default 0,
  discount       numeric(14,2) not null default 0,
  total          numeric(14,2) not null default 0,
  payment_method public.payment_method not null default 'cash',
  paid_amount    numeric(14,2) not null default 0,
  change_amount  numeric(14,2) not null default 0,
  note           text,
  created_at     timestamptz not null default now(),
  is_simulation  boolean not null default false
);

create index if not exists transactions_shift_idx on public.transactions (shift_id);
create index if not exists transactions_sim_idx   on public.transactions (store_id, is_simulation, created_at desc);
create index if not exists transactions_user_idx  on public.transactions (user_id, created_at desc);

-- ---------- transaction_items ----------
create table if not exists public.transaction_items (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  product_id     uuid references public.products (id) on delete set null,
  -- snapshot nama produk, supaya struk lama tetap terbaca walau produk dihapus
  product_name   text not null,
  qty            integer not null check (qty > 0),
  price_at_sale  numeric(14,2) not null,
  discount       numeric(14,2) not null default 0,
  subtotal       numeric(14,2) not null
);

create index if not exists transaction_items_trx_idx     on public.transaction_items (transaction_id);
create index if not exists transaction_items_product_idx on public.transaction_items (product_id);

-- ---------- expense_categories ----------
create table if not exists public.expense_categories (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores (id) on delete cascade,
  name       text not null,
  color      text not null default '#64748b',
  created_at timestamptz not null default now(),
  is_simulation boolean not null default false,
  unique (store_id, name)
);

-- ---------- expenses ----------
create table if not exists public.expenses (
  id             uuid primary key default gen_random_uuid(),
  store_id       uuid not null references public.stores (id) on delete cascade,
  shift_id       uuid references public.shifts (id) on delete set null,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  category_id    uuid references public.expense_categories (id) on delete set null,
  amount         numeric(14,2) not null check (amount > 0),
  note           text,
  receipt_url    text,
  expense_date   date not null default current_date,
  -- menentukan apakah pengeluaran ini mengurangi kas fisik laci
  payment_source public.payment_source not null default 'cash',
  status         public.expense_status not null default 'approved',
  approved_by    uuid references public.profiles (id) on delete set null,
  approved_at    timestamptz,
  created_at     timestamptz not null default now(),
  is_simulation  boolean not null default false
);

create index if not exists expenses_shift_idx on public.expenses (shift_id);
create index if not exists expenses_sim_idx   on public.expenses (store_id, is_simulation, expense_date desc);

-- ---------- recurring_expenses ----------
create table if not exists public.recurring_expenses (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores (id) on delete cascade,
  category_id   uuid references public.expense_categories (id) on delete set null,
  name          text not null,
  amount        numeric(14,2) not null check (amount > 0),
  frequency     public.recurrence not null default 'monthly',
  -- 1..31 untuk bulanan, 0..6 (Minggu..Sabtu) untuk mingguan
  day_of_period integer not null default 1,
  next_due_date date not null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------- stock_logs ----------
create table if not exists public.stock_logs (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores (id) on delete cascade,
  product_id    uuid not null references public.products (id) on delete cascade,
  change_qty    integer not null,
  stock_after   integer not null,
  reason        public.stock_reason not null,
  reference_id  uuid,
  user_id       uuid references public.profiles (id) on delete set null,
  note          text,
  created_at    timestamptz not null default now(),
  is_simulation boolean not null default false
);

create index if not exists stock_logs_product_idx on public.stock_logs (product_id, created_at desc);
create index if not exists stock_logs_sim_idx     on public.stock_logs (store_id, is_simulation);

-- ---------- activity_logs ----------
create table if not exists public.activity_logs (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid references public.stores (id) on delete cascade,
  user_id     uuid references public.profiles (id) on delete set null,
  action_type text not null,
  description text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists activity_logs_store_idx on public.activity_logs (store_id, created_at desc);

-- ---------- trigger: products.updated_at ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at
  before update on public.products
  for each row execute function public.touch_updated_at();
