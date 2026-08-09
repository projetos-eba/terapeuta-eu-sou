begin;

select plan(126);

select ok(
  has_table_privilege('anon', 'public.therapies', 'SELECT'),
  'anon keeps read access to public therapies'
);

select ok(
  has_table_privilege('authenticated', 'public.therapies', 'SELECT'),
  'authenticated keeps read access to public therapies'
);

select ok(
  has_table_privilege('anon', 'public.therapy_categories', 'SELECT'),
  'anon keeps read access to public therapy categories'
);

select ok(
  has_table_privilege('authenticated', 'public.therapy_categories', 'SELECT'),
  'authenticated keeps read access to public therapy categories'
);

select is(
  has_table_privilege('anon', table_name, privilege),
  false,
  format('anon cannot %s %s', privilege, table_name)
)
from (
  values
    ('public.therapies', 'INSERT'),
    ('public.therapies', 'UPDATE'),
    ('public.therapies', 'DELETE'),
    ('public.therapies', 'TRUNCATE'),
    ('public.therapies', 'REFERENCES'),
    ('public.therapies', 'TRIGGER'),
    ('public.therapy_categories', 'INSERT'),
    ('public.therapy_categories', 'UPDATE'),
    ('public.therapy_categories', 'DELETE'),
    ('public.therapy_categories', 'TRUNCATE'),
    ('public.therapy_categories', 'REFERENCES'),
    ('public.therapy_categories', 'TRIGGER')
) as checks(table_name, privilege);

select is(
  has_table_privilege('authenticated', table_name, privilege),
  false,
  format('authenticated cannot %s %s', privilege, table_name)
)
from (
  values
    ('public.therapies', 'INSERT'),
    ('public.therapies', 'UPDATE'),
    ('public.therapies', 'DELETE'),
    ('public.therapies', 'TRUNCATE'),
    ('public.therapies', 'REFERENCES'),
    ('public.therapies', 'TRIGGER'),
    ('public.therapy_categories', 'INSERT'),
    ('public.therapy_categories', 'UPDATE'),
    ('public.therapy_categories', 'DELETE'),
    ('public.therapy_categories', 'TRUNCATE'),
    ('public.therapy_categories', 'REFERENCES'),
    ('public.therapy_categories', 'TRIGGER')
) as checks(table_name, privilege);

select is(
  has_table_privilege('anon', table_name, privilege),
  false,
  format('anon cannot %s editorial %s', privilege, table_name)
)
from (
  values
    ('public.therapy_public_content', 'SELECT'),
    ('public.therapy_public_content', 'INSERT'),
    ('public.therapy_public_content', 'UPDATE'),
    ('public.therapy_public_content', 'DELETE'),
    ('public.therapy_public_content', 'TRUNCATE'),
    ('public.therapy_public_content', 'REFERENCES'),
    ('public.therapy_public_content', 'TRIGGER'),
    ('public.therapy_highlights', 'SELECT'),
    ('public.therapy_highlights', 'INSERT'),
    ('public.therapy_highlights', 'UPDATE'),
    ('public.therapy_highlights', 'DELETE'),
    ('public.therapy_highlights', 'TRUNCATE'),
    ('public.therapy_highlights', 'REFERENCES'),
    ('public.therapy_highlights', 'TRIGGER'),
    ('public.therapy_benefits', 'SELECT'),
    ('public.therapy_benefits', 'INSERT'),
    ('public.therapy_benefits', 'UPDATE'),
    ('public.therapy_benefits', 'DELETE'),
    ('public.therapy_benefits', 'TRUNCATE'),
    ('public.therapy_benefits', 'REFERENCES'),
    ('public.therapy_benefits', 'TRIGGER'),
    ('public.therapy_faqs', 'SELECT'),
    ('public.therapy_faqs', 'INSERT'),
    ('public.therapy_faqs', 'UPDATE'),
    ('public.therapy_faqs', 'DELETE'),
    ('public.therapy_faqs', 'TRUNCATE'),
    ('public.therapy_faqs', 'REFERENCES'),
    ('public.therapy_faqs', 'TRIGGER')
) as checks(table_name, privilege);

select ok(
  has_table_privilege('authenticated', table_name, 'SELECT'),
  format('authenticated keeps read access to editorial %s for admin RLS-gated tools', table_name)
)
from (
  values
    ('public.therapy_public_content'),
    ('public.therapy_highlights'),
    ('public.therapy_benefits'),
    ('public.therapy_faqs')
) as checks(table_name);

select is(
  has_table_privilege('authenticated', table_name, privilege),
  false,
  format('authenticated cannot %s editorial %s', privilege, table_name)
)
from (
  values
    ('public.therapy_public_content', 'INSERT'),
    ('public.therapy_public_content', 'UPDATE'),
    ('public.therapy_public_content', 'DELETE'),
    ('public.therapy_public_content', 'TRUNCATE'),
    ('public.therapy_public_content', 'REFERENCES'),
    ('public.therapy_public_content', 'TRIGGER'),
    ('public.therapy_highlights', 'INSERT'),
    ('public.therapy_highlights', 'UPDATE'),
    ('public.therapy_highlights', 'DELETE'),
    ('public.therapy_highlights', 'TRUNCATE'),
    ('public.therapy_highlights', 'REFERENCES'),
    ('public.therapy_highlights', 'TRIGGER'),
    ('public.therapy_benefits', 'INSERT'),
    ('public.therapy_benefits', 'UPDATE'),
    ('public.therapy_benefits', 'DELETE'),
    ('public.therapy_benefits', 'TRUNCATE'),
    ('public.therapy_benefits', 'REFERENCES'),
    ('public.therapy_benefits', 'TRIGGER'),
    ('public.therapy_faqs', 'INSERT'),
    ('public.therapy_faqs', 'UPDATE'),
    ('public.therapy_faqs', 'DELETE'),
    ('public.therapy_faqs', 'TRUNCATE'),
    ('public.therapy_faqs', 'REFERENCES'),
    ('public.therapy_faqs', 'TRIGGER')
) as checks(table_name, privilege);

select ok(
  has_table_privilege('service_role', table_name, 'SELECT'),
  format('service_role keeps direct read access to %s', table_name)
)
from (
  values
    ('public.therapies'),
    ('public.therapy_categories'),
    ('public.therapy_public_content'),
    ('public.therapy_highlights'),
    ('public.therapy_benefits'),
    ('public.therapy_faqs')
) as checks(table_name);

select is(
  has_table_privilege('service_role', table_name, privilege),
  false,
  format('service_role cannot directly %s %s outside RPC boundaries', privilege, table_name)
)
from (
  values
    ('public.therapies', 'INSERT'),
    ('public.therapies', 'UPDATE'),
    ('public.therapies', 'DELETE'),
    ('public.therapies', 'TRUNCATE'),
    ('public.therapies', 'REFERENCES'),
    ('public.therapies', 'TRIGGER'),
    ('public.therapy_categories', 'INSERT'),
    ('public.therapy_categories', 'UPDATE'),
    ('public.therapy_categories', 'DELETE'),
    ('public.therapy_categories', 'TRUNCATE'),
    ('public.therapy_categories', 'REFERENCES'),
    ('public.therapy_categories', 'TRIGGER'),
    ('public.therapy_public_content', 'INSERT'),
    ('public.therapy_public_content', 'UPDATE'),
    ('public.therapy_public_content', 'DELETE'),
    ('public.therapy_public_content', 'TRUNCATE'),
    ('public.therapy_public_content', 'REFERENCES'),
    ('public.therapy_public_content', 'TRIGGER'),
    ('public.therapy_highlights', 'INSERT'),
    ('public.therapy_highlights', 'UPDATE'),
    ('public.therapy_highlights', 'DELETE'),
    ('public.therapy_highlights', 'TRUNCATE'),
    ('public.therapy_highlights', 'REFERENCES'),
    ('public.therapy_highlights', 'TRIGGER'),
    ('public.therapy_benefits', 'INSERT'),
    ('public.therapy_benefits', 'UPDATE'),
    ('public.therapy_benefits', 'DELETE'),
    ('public.therapy_benefits', 'TRUNCATE'),
    ('public.therapy_benefits', 'REFERENCES'),
    ('public.therapy_benefits', 'TRIGGER'),
    ('public.therapy_faqs', 'INSERT'),
    ('public.therapy_faqs', 'UPDATE'),
    ('public.therapy_faqs', 'DELETE'),
    ('public.therapy_faqs', 'TRUNCATE'),
    ('public.therapy_faqs', 'REFERENCES'),
    ('public.therapy_faqs', 'TRIGGER')
) as checks(table_name, privilege);

select * from finish();

rollback;
