alter table public.grades
add column if not exists education_model text;

update public.grades
set education_model = 'EDUCACION_TRADICIONAL'
where education_model is null or education_model = '';

alter table public.grades
alter column education_model set default 'EDUCACION_TRADICIONAL';

alter table public.grades
alter column education_model set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'grades_education_model_check'
  ) then
    alter table public.grades
    add constraint grades_education_model_check
    check (education_model in ('EDUCACION_TRADICIONAL', 'ESCUELA_NUEVA'));
  end if;
end $$;
