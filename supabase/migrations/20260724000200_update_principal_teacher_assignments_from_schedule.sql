begin;

create temporary table desired_assignment_rules (
  teacher_id text not null,
  subject_id text not null,
  grade_ids text[] not null
) on commit drop;

insert into desired_assignment_rules (teacher_id, subject_id, grade_ids)
values
  ('1112625618', '_0015', array['_0005', '_0007', '_0008', '_0009', '_0010']),
  ('16227605', '_0009', array['_0001', '_0003', '_0004', '_0005', '_0006', '_0007', '_0008', '_0009', '_0010']),
  ('16227605', '_0011', array['_0008', '_0009', '_0010']),
  ('1112625161', '_0003', array['_0008', '_0009', '_0010']),
  ('1112625161', '_0016', array['_0006', '_0007', '_0008', '_0009', '_0010']),
  ('14478366', '_0002', array['_0001']),
  ('14478366', '_0003', array['_0001', '_0003', '_0004', '_0005', '_0006', '_0007']),
  ('14478366', '_0016', array['_0001', '_0003', '_0004', '_0005']),
  ('1113787682', '_0001', array['_0004', '_0005']),
  ('1113787682', '_0010', array['_0001', '_0003', '_0004', '_0005', '_0006', '_0007', '_0008', '_0009', '_0010']),
  ('1112760469', '_0001', array['_0008']),
  ('1112760469', '_0002', array['_0008', '_0009', '_0010']),
  ('1112760469', '_0006', array['_0001', '_0008', '_0009', '_0010']),
  ('1112760469', '_0017', array['_0001', '_0008', '_0009', '_0010']),
  ('29613983', '_0002', array['_0006']),
  ('29613983', '_0013', array['_0001', '_0003', '_0004', '_0005', '_0006', '_0007', '_0008', '_0009', '_0010']),
  ('94274311', '_0007', array['_0001', '_0003', '_0004', '_0005', '_0006', '_0007', '_0008']),
  ('94274311', '_0008', array['_0008', '_0009', '_0010']),
  ('94274311', '_0014', array['_0001', '_0003', '_0004', '_0005', '_0006', '_0007']),
  ('66678685', '_0005', array['_0001', '_0003', '_0004', '_0005', '_0006', '_0007', '_0008', '_0009', '_0010']),
  ('66678685', '_0007', array['_0009', '_0010']),
  ('94276054', '_0002', array['_0005', '_0007']),
  ('94276054', '_0012', array['_0001', '_0003', '_0004', '_0005']),
  ('66750641', '_0001', array['_0001', '_0003', '_0006', '_0007']),
  ('66750641', '_0002', array['_0003', '_0004']),
  ('66750641', '_0015', array['_0001', '_0003', '_0004', '_0006']),
  ('94275461', '_0006', array['_0003', '_0004', '_0005', '_0006', '_0007']),
  ('94275461', '_0017', array['_0003', '_0004', '_0005', '_0006', '_0007']),
  ('1113785555', '_0012', array['_0006', '_0007', '_0008', '_0009', '_0010']),
  ('6356507', '_0001', array['_0009', '_0010']),
  ('6356507', '_0004', array['_0001', '_0003', '_0004', '_0005', '_0006', '_0007', '_0008', '_0009', '_0010']);

create temporary table desired_assignments
on commit drop
as
select
  rule.teacher_id,
  rule.subject_id,
  grade_id
from desired_assignment_rules rule
cross join lateral unnest(rule.grade_ids) as grade_id;

do $$
declare
  desired_count integer;
  duplicate_count integer;
  missing_count integer;
begin
  select count(*) into desired_count from desired_assignments;
  if desired_count <> 138 then
    raise exception 'Actualización cancelada: se esperaban 138 asignaciones y se encontraron %', desired_count;
  end if;

  select count(*)
  into duplicate_count
  from (
    select grade_id, subject_id
    from desired_assignments
    group by grade_id, subject_id
    having count(*) > 1
  ) duplicates;
  if duplicate_count > 0 then
    raise exception 'Actualización cancelada: existen % asignaciones duplicadas en el horario', duplicate_count;
  end if;

  select count(*)
  into missing_count
  from desired_assignments desired
  left join public.teachers teacher on teacher.id = desired.teacher_id
  left join public.subjects subject_record on subject_record.id = desired.subject_id
  left join public.grades grade_record on grade_record.id = desired.grade_id
  left join public.grade_subjects assignment
    on assignment.grade_id = desired.grade_id
   and assignment.subject_id = desired.subject_id
  where teacher.id is null
     or teacher.sede_id <> '_0001'
     or subject_record.id is null
     or grade_record.id is null
     or grade_record.sede_id <> '_0001'
     or assignment.id is null;
  if missing_count > 0 then
    raise exception 'Actualización cancelada: % correspondencias no existen o no pertenecen a la sede principal', missing_count;
  end if;
end
$$;

update public.grade_subjects assignment
set teacher_id = desired.teacher_id
from desired_assignments desired
where assignment.grade_id = desired.grade_id
  and assignment.subject_id = desired.subject_id
  and assignment.teacher_id is distinct from desired.teacher_id;

do $$
declare
  mismatch_count integer;
begin
  select count(*)
  into mismatch_count
  from desired_assignments desired
  join public.grade_subjects assignment
    on assignment.grade_id = desired.grade_id
   and assignment.subject_id = desired.subject_id
  where assignment.teacher_id is distinct from desired.teacher_id;

  if mismatch_count > 0 then
    raise exception 'La verificación final falló: % asignaciones no coinciden con el horario', mismatch_count;
  end if;
end
$$;

commit;
