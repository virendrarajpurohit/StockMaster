-- StockMaster Supabase schema. Run this in Supabase SQL Editor before deploying.
create extension if not exists pgcrypto;

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  category text default 'General',
  material text default 'Other',
  unit text default 'pcs',
  default_price numeric(12,2),
  reorder_level integer not null default 5 check (reorder_level >= 0),
  current_stock integer not null default 0 check (current_stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.parties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('manufacturer', 'shop')),
  phone text,
  address text,
  created_at timestamptz not null default now(),
  unique (name, type)
);

create table if not exists public.stock_transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('purchase', 'sale', 'adjustment')),
  party_id uuid references public.parties(id) on delete set null,
  party_name text,
  bill_number text,
  notes text,
  total_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.stock_transaction_lines (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.stock_transactions(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete restrict,
  sku text not null,
  item_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2),
  line_total numeric(12,2) generated always as (quantity * coalesce(unit_price, 0)) stored,
  stock_before integer not null check (stock_before >= 0),
  stock_after integer not null check (stock_after >= 0)
);

create index if not exists idx_items_sku on public.items (lower(sku));
create index if not exists idx_items_name on public.items using gin (to_tsvector('simple', name));
create index if not exists idx_transactions_created_at on public.stock_transactions (created_at desc);
create index if not exists idx_lines_item_id on public.stock_transaction_lines (item_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_items_updated_at on public.items;
create trigger touch_items_updated_at
before update on public.items
for each row execute function public.touch_updated_at();

alter table public.items enable row level security;
alter table public.parties enable row level security;
alter table public.stock_transactions enable row level security;
alter table public.stock_transaction_lines enable row level security;

-- This app uses the server-side service-role key, so no public policies are required.
-- If you later add Supabase Auth, create user-scoped policies before exposing anon access.

create or replace function public.record_stock_transaction(
  p_type text,
  p_party_type text,
  p_party_name text,
  p_bill_number text,
  p_notes text,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_party_id uuid;
  v_transaction_id uuid;
  v_line jsonb;
  v_item items%rowtype;
  v_sku text;
  v_name text;
  v_quantity integer;
  v_unit_price numeric(12,2);
  v_stock_before integer;
  v_stock_after integer;
  v_total numeric(12,2) := 0;
begin
  if p_type not in ('purchase', 'sale') then
    raise exception 'Unsupported transaction type: %', p_type using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_lines, '[]'::jsonb)) = 0 then
    raise exception 'At least one item is required' using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_party_name, '')), '') is not null then
    insert into parties(name, type)
    values (trim(p_party_name), p_party_type)
    on conflict (name, type) do update set name = excluded.name
    returning id into v_party_id;
  end if;

  insert into stock_transactions(type, party_id, party_name, bill_number, notes, total_amount)
  values (p_type, v_party_id, nullif(trim(coalesce(p_party_name, '')), ''), nullif(trim(coalesce(p_bill_number, '')), ''), nullif(trim(coalesce(p_notes, '')), ''), 0)
  returning id into v_transaction_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_sku := upper(trim(v_line->>'sku'));
    v_name := trim(v_line->>'name');
    v_quantity := (v_line->>'quantity')::integer;
    v_unit_price := nullif(v_line->>'unit_price', '')::numeric;

    if v_sku = '' or v_name = '' or v_quantity <= 0 then
      raise exception 'Invalid item line for SKU %', v_sku using errcode = '22023';
    end if;

    if p_type = 'purchase' then
      insert into items(sku, name, category, material, unit, default_price, reorder_level, current_stock, is_active)
      values (
        v_sku,
        v_name,
        coalesce(nullif(trim(v_line->>'category'), ''), 'General'),
        coalesce(nullif(trim(v_line->>'material'), ''), 'Other'),
        coalesce(nullif(trim(v_line->>'unit'), ''), 'pcs'),
        v_unit_price,
        coalesce((v_line->>'reorder_level')::integer, 5),
        0,
        true
      )
      on conflict (sku) do update set
        name = excluded.name,
        category = excluded.category,
        material = excluded.material,
        unit = excluded.unit,
        default_price = coalesce(excluded.default_price, items.default_price),
        reorder_level = excluded.reorder_level,
        is_active = true
      returning * into v_item;
    else
      select * into v_item from items where sku = v_sku for update;
      if not found then
        raise exception 'SKU % does not exist. Add purchase stock first.', v_sku using errcode = 'P0002';
      end if;
    end if;

    select * into v_item from items where id = v_item.id for update;
    v_stock_before := v_item.current_stock;

    if p_type = 'purchase' then
      v_stock_after := v_stock_before + v_quantity;
    else
      if v_stock_before < v_quantity then
        raise exception 'Insufficient stock for SKU %. Available %, requested %', v_sku, v_stock_before, v_quantity using errcode = '23514';
      end if;
      v_stock_after := v_stock_before - v_quantity;
    end if;

    update items set current_stock = v_stock_after where id = v_item.id;

    insert into stock_transaction_lines(transaction_id, item_id, sku, item_name, quantity, unit_price, stock_before, stock_after)
    values (v_transaction_id, v_item.id, v_sku, v_name, v_quantity, coalesce(v_unit_price, v_item.default_price), v_stock_before, v_stock_after);

    v_total := v_total + (v_quantity * coalesce(v_unit_price, v_item.default_price, 0));
  end loop;

  update stock_transactions set total_amount = v_total where id = v_transaction_id;
  return v_transaction_id;
end;
$$;
