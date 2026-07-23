create table if not exists public.subject_observations (
  id text primary key,
  period_id text not null references public.periods(id) on delete cascade,
  grade_id text not null references public.grades(id) on delete cascade,
  subject_id text not null references public.subjects(id) on delete cascade,
  teacher_id text not null references public.teachers(id) on delete cascade,
  student_id text not null references public.students(id) on delete cascade,
  observations text not null default '',
  status text not null default 'active' check (status in ('active', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (period_id, grade_id, subject_id, teacher_id, student_id)
);

create table if not exists public.director_observations (
  id text primary key,
  period_id text not null references public.periods(id) on delete cascade,
  grade_id text not null references public.grades(id) on delete cascade,
  director_teacher_id text not null references public.teachers(id) on delete cascade,
  student_id text not null references public.students(id) on delete cascade,
  observations text not null default '',
  status text not null default 'active' check (status in ('active', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (period_id, grade_id, student_id)
);

create index if not exists subject_observations_lookup_idx
on public.subject_observations (teacher_id, period_id, grade_id, subject_id);

create index if not exists director_observations_lookup_idx
on public.director_observations (director_teacher_id, period_id, grade_id);

alter table public.subject_observations enable row level security;
alter table public.director_observations enable row level security;

revoke all on table public.subject_observations from anon, authenticated;
revoke all on table public.director_observations from anon, authenticated;
grant all on table public.subject_observations to service_role;
grant all on table public.director_observations to service_role;

insert into public.subject_observations (
  id,
  period_id,
  grade_id,
  subject_id,
  teacher_id,
  student_id,
  observations,
  status,
  created_at,
  updated_at,
  deleted_at
)
select
  'subject_' || pr.id,
  pr.period_id,
  pr.grade_id,
  pr.subject_id,
  pr.teacher_id,
  pr.student_id,
  pr.observations,
  pr.status,
  pr.created_at,
  pr.updated_at,
  pr.deleted_at
from public.pre_reports pr
where btrim(coalesce(pr.observations, '')) <> ''
on conflict (period_id, grade_id, subject_id, teacher_id, student_id)
do update set
  observations = excluded.observations,
  status = excluded.status,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at;

with latest_director_observation as (
  select distinct on (pr.period_id, pr.grade_id, pr.student_id)
    pr.period_id,
    pr.grade_id,
    pr.student_id,
    g.director_teacher_id,
    pr.director_observations,
    pr.status,
    pr.created_at,
    pr.updated_at,
    pr.deleted_at
  from public.pre_reports pr
  join public.grades g on g.id = pr.grade_id
  where btrim(coalesce(pr.director_observations, '')) <> ''
    and g.director_teacher_id is not null
    and btrim(g.director_teacher_id) <> ''
  order by pr.period_id, pr.grade_id, pr.student_id, pr.updated_at desc, pr.id desc
)
insert into public.director_observations (
  id,
  period_id,
  grade_id,
  director_teacher_id,
  student_id,
  observations,
  status,
  created_at,
  updated_at,
  deleted_at
)
select
  'director_' || md5(period_id || '::' || grade_id || '::' || student_id),
  period_id,
  grade_id,
  director_teacher_id,
  student_id,
  director_observations,
  status,
  created_at,
  updated_at,
  deleted_at
from latest_director_observation
on conflict (period_id, grade_id, student_id)
do update set
  director_teacher_id = excluded.director_teacher_id,
  observations = excluded.observations,
  status = excluded.status,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at;

-- Las columnas antiguas se conservan temporalmente para que la versión
-- actualmente desplegada siga funcionando durante la transición. Una vez
-- desplegado el código que usa las tablas nuevas se eliminarán en una
-- migración de limpieza independiente.
