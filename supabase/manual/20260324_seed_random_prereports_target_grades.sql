-- Genera preinformes aleatorios para SEXTO-UNO, SEXTO-DOS y S?PTIMO-UNO.
-- Usa el periodo activo Primer Periodo (_0001).
begin;

with target_period as (
  select '_0001'::text as period_id
),
target_grades as (
  select id, nombre
  from public.grades
  where nombre = any(ARRAY['SEXTO-UNO', 'SEXTO-DOS', 'SÉPTIMO-UNO']::text[])
),
target_assignments as (
  select gs.grade_id, gs.subject_id, gs.teacher_id
  from public.grade_subjects gs
  join target_grades tg on tg.id = gs.grade_id
  where gs.active = true
),
target_students as (
  select s.id as student_id, s.grade_id
  from public.students s
  join target_grades tg on tg.id = s.grade_id
  where s.active = true
),
base_rows as (
  select
    ta.grade_id,
    ta.subject_id,
    ta.teacher_id,
    ts.student_id
  from target_assignments ta
  join target_students ts on ts.grade_id = ta.grade_id
),
prepared_rows as (
  select
    tp.period_id,
    br.grade_id,
    br.subject_id,
    br.teacher_id,
    br.student_id,
    to_jsonb((select coalesce(array_agg(q), '{}') from unnest(ARRAY['Utiliza equipos electronicos en la clase, sin autorizacion.', 'Constantemente llega tarde a la clase.', 'Tiene actitudes de irrespeto hacia los demas.', 'No porta el uniforme correctamente segun el manual.', 'Se evade de la clase.', 'Se le dificulta seguir las orientaciones del docente.', 'Su comportamiento incide en actos de indisciplina.', 'Utiliza un lenguaje agresivo (tono, gestos, palabras).', 'Posturas desobligantes ante las actividades grupales e institucionales.', 'No cuida los enseres ni materiales de la IE.', 'Constantemente falta al colegio sin excusa.']::text[]) q where random() < 0.18)) as convivencia,
    to_jsonb((select coalesce(array_agg(q), '{}') from unnest(ARRAY['Se distrae con facilidad y no presta atencion a la clase.', 'Entrega actividades que no responden a lo planteado.', 'Las competencias alcanzadas se encuentran en niveles de desempeno bajo y basico.', 'No emplea adecuadamente el tiempo de la clase.', 'No se compromete a estudiar para las evaluaciones.', 'Le hace falta responsabilidad y compromiso con la entrega de evidencias de aprendizaje.', 'Presenta actividades, pero no las sustenta.', 'Desinteres y apatia por los procesos escolares.']::text[]) q where random() < 0.22)) as academica,
    (ARRAY['Presenta avances parciales, pero requiere mayor acompanamiento en clase y en casa.', 'Debe fortalecer el cumplimiento de actividades y mejorar su nivel de atencion durante la jornada.', 'Se recomienda seguimiento permanente por parte del acudiente y refuerzo de rutinas de estudio.', 'Ha mostrado disposicion intermitente frente a los compromisos academicos y convivenciales.', 'Necesita mejorar la entrega oportuna de actividades y la participacion responsable en clase.', 'Se evidencian dificultades que requieren trabajo conjunto entre estudiante, familia y docente.']::text[])[1 + floor(random() * array_length(ARRAY['Presenta avances parciales, pero requiere mayor acompanamiento en clase y en casa.', 'Debe fortalecer el cumplimiento de actividades y mejorar su nivel de atencion durante la jornada.', 'Se recomienda seguimiento permanente por parte del acudiente y refuerzo de rutinas de estudio.', 'Ha mostrado disposicion intermitente frente a los compromisos academicos y convivenciales.', 'Necesita mejorar la entrega oportuna de actividades y la participacion responsable en clase.', 'Se evidencian dificultades que requieren trabajo conjunto entre estudiante, familia y docente.']::text[], 1))::int] as observations,
    'active'::text as status
  from base_rows br
  cross join target_period tp
),
rows_to_insert as (
  select *
  from prepared_rows
  where jsonb_array_length(convivencia) > 0
     or jsonb_array_length(academica) > 0
     or btrim(observations) <> ''
),
deleted as (
  delete from public.pre_reports pr
  using target_period tp, target_grades tg
  where pr.period_id = tp.period_id
    and pr.grade_id = tg.id
  returning pr.id
),
numbered as (
  select
    '_' || lpad((coalesce((select max((substring(id from 2))::int) from public.pre_reports where id ~ '^_[0-9]{4,}$'), 0) + row_number() over ())::text, 4, '0') as id,
    period_id, grade_id, subject_id, teacher_id, student_id, convivencia, academica, observations, status
  from rows_to_insert
)
insert into public.pre_reports (
  id, period_id, grade_id, subject_id, teacher_id, student_id, convivencia, academica, observations, status, created_at, updated_at, deleted_at
)
select
  id, period_id, grade_id, subject_id, teacher_id, student_id, convivencia, academica, observations, status, now(), now(), null
from numbered;

commit;
