-- «تواصل»: tables, bucket and the hourly purge. Applied to the Supabase project «massar» (migration tawasul_messaging_tables).
-- Row level security is on and there are no policies: only the edge function (service role) reads or writes these tables.
create table if not exists public.tawasul_devices (
  code text primary key,
  token_hash text not null,
  name text not null default '',
  kind text not null default 'phone' check (kind in ('phone','tv')),
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create table if not exists public.tawasul_msgs (
  id uuid primary key default gen_random_uuid(),
  from_code text not null references public.tawasul_devices(code) on delete cascade,
  to_code text not null references public.tawasul_devices(code) on delete cascade,
  kind text not null check (kind in ('text','image','audio','file')),
  body text,
  file_path text,
  file_name text,
  mime text,
  size bigint,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);
create index if not exists tawasul_msgs_to_idx on public.tawasul_msgs (to_code, created_at);
create index if not exists tawasul_msgs_exp_idx on public.tawasul_msgs (expires_at);
create index if not exists tawasul_msgs_from_idx on public.tawasul_msgs (from_code, created_at);
alter table public.tawasul_devices enable row level security;
alter table public.tawasul_msgs enable row level security;
insert into storage.buckets (id, name, public, file_size_limit) values ('tawasul', 'tawasul', false, 15728640) on conflict (id) do nothing;

-- every hour the function deletes what expired (rows and files)
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
select cron.schedule('tawasul_purge', '17 * * * *', $$select net.http_post(url := 'https://pegjfuculkrkwitihfqg.supabase.co/functions/v1/tawasul/purge', headers := '{"Content-Type":"application/json"}'::jsonb, body := '{}'::jsonb)$$);
