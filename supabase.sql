create table if not exists public.storage (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

alter table public.storage enable row level security;

create policy "leitura publica" on public.storage for select using (true);
create policy "insercao publica" on public.storage for insert with check (true);
create policy "atualizacao publica" on public.storage for update using (true);
create policy "exclusao publica" on public.storage for delete using (true);
