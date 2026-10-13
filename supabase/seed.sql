-- Demo fixtures for local development. Replace these organization IDs with the
-- IDs of Clerk organizations in your development instance to see a fixture
-- while signed in to that organization.
insert into public.organizations (id, name)
values
  ('org_cartograph_alpha', 'Cartograph Studio'),
  ('org_cartograph_beta', 'Northstar Labs')
on conflict (id) do update set name = excluded.name;

insert into public.projects (id, organization_id, name, repository_url)
values
  ('10000000-0000-4000-8000-000000000001', 'org_cartograph_alpha', 'Atlas Web', 'https://github.com/cartograph/atlas-web'),
  ('20000000-0000-4000-8000-000000000001', 'org_cartograph_beta', 'Northstar API', 'https://github.com/northstar/api')
on conflict (id) do nothing;

insert into public.analyses (id, organization_id, project_id, status, started_at, completed_at, created_at)
values
  ('10000000-0000-4000-8000-000000000002', 'org_cartograph_alpha', '10000000-0000-4000-8000-000000000001', 'completed', now() - interval '2 hours', now() - interval '1 hour 58 minutes', now() - interval '2 hours'),
  ('10000000-0000-4000-8000-000000000003', 'org_cartograph_alpha', '10000000-0000-4000-8000-000000000001', 'running', now() - interval '3 minutes', null, now() - interval '3 minutes'),
  ('20000000-0000-4000-8000-000000000002', 'org_cartograph_beta', '20000000-0000-4000-8000-000000000001', 'completed', now() - interval '1 day', now() - interval '23 hours 58 minutes', now() - interval '1 day')
on conflict (id) do nothing;
