alter table public.teachers
add column if not exists email text;

update public.teachers
set email = lower(trim(email))
where email is not null and email <> lower(trim(email));

create unique index if not exists teachers_email_unique
on public.teachers (lower(email))
where email is not null and email <> '';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'teachers_email_format_check'
  ) then
    alter table public.teachers
    add constraint teachers_email_format_check
    check (email is null or email = '' or email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');
  end if;
end $$;

create table if not exists public.password_reset_tokens (
  token_hash text primary key,
  teacher_id text not null references public.teachers(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists password_reset_tokens_teacher_created_idx
on public.password_reset_tokens (teacher_id, created_at desc);

alter table public.password_reset_tokens enable row level security;
revoke all on table public.password_reset_tokens from anon, authenticated;
grant all on table public.password_reset_tokens to service_role;

create or replace function public.reset_teacher_password(p_token_hash text, p_password_hash text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id text;
begin
  select teacher_id
  into v_teacher_id
  from public.password_reset_tokens
  where token_hash = p_token_hash
    and used_at is null
    and expires_at > now()
  for update;

  if v_teacher_id is null then
    return null;
  end if;

  update public.teachers
  set password_hash = p_password_hash
  where id = v_teacher_id and active = true;

  if not found then
    return null;
  end if;

  update public.password_reset_tokens
  set used_at = now()
  where token_hash = p_token_hash;

  return v_teacher_id;
end;
$$;

revoke all on function public.reset_teacher_password(text, text) from public, anon, authenticated;
grant execute on function public.reset_teacher_password(text, text) to service_role;
