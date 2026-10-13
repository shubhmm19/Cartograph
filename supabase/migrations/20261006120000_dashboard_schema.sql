-- Clerk owns organization identity. This table mirrors Clerk organization IDs so
-- application data can use real foreign keys and cascade when an org is removed.
create table public.organizations (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null,
  repository_url text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  status text not null check (status in ('queued', 'running', 'completed', 'failed')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (organization_id, project_id)
    references public.projects(organization_id, id) on delete cascade,
  unique (organization_id, id)
);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  analysis_id uuid not null,
  path text not null,
  language text not null default 'typescript',
  created_at timestamptz not null default now(),
  foreign key (organization_id, analysis_id)
    references public.analyses(organization_id, id) on delete cascade,
  unique (organization_id, id),
  unique (analysis_id, path)
);

create table public.edges (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  analysis_id uuid not null,
  source_file_id uuid not null,
  target_file_id uuid not null,
  kind text not null default 'import',
  created_at timestamptz not null default now(),
  foreign key (organization_id, analysis_id)
    references public.analyses(organization_id, id) on delete cascade,
  foreign key (organization_id, source_file_id)
    references public.files(organization_id, id) on delete cascade,
  foreign key (organization_id, target_file_id)
    references public.files(organization_id, id) on delete cascade,
  check (source_file_id <> target_file_id)
);

create table public.routes (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  analysis_id uuid not null,
  file_id uuid not null,
  method text not null,
  path text not null,
  created_at timestamptz not null default now(),
  foreign key (organization_id, analysis_id)
    references public.analyses(organization_id, id) on delete cascade,
  foreign key (organization_id, file_id)
    references public.files(organization_id, id) on delete cascade
);

create table public.explanations (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  analysis_id uuid not null,
  file_id uuid not null,
  content text not null,
  created_at timestamptz not null default now(),
  foreign key (organization_id, analysis_id)
    references public.analyses(organization_id, id) on delete cascade,
  foreign key (organization_id, file_id)
    references public.files(organization_id, id) on delete cascade
);

create table public.file_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  analysis_id uuid not null,
  file_id uuid not null,
  role text not null,
  created_at timestamptz not null default now(),
  foreign key (organization_id, analysis_id)
    references public.analyses(organization_id, id) on delete cascade,
  foreign key (organization_id, file_id)
    references public.files(organization_id, id) on delete cascade,
  unique (analysis_id, file_id)
);

create table public.insights (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  analysis_id uuid not null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  foreign key (organization_id, analysis_id)
    references public.analyses(organization_id, id) on delete cascade
);

create index analyses_organization_created_at_idx
  on public.analyses (organization_id, created_at desc);
create index projects_organization_id_idx on public.projects (organization_id);
create index files_organization_analysis_idx on public.files (organization_id, analysis_id);
create index edges_organization_analysis_idx on public.edges (organization_id, analysis_id);
create index routes_organization_analysis_idx on public.routes (organization_id, analysis_id);
create index explanations_organization_analysis_idx on public.explanations (organization_id, analysis_id);
create index file_roles_organization_analysis_idx on public.file_roles (organization_id, analysis_id);
create index insights_organization_analysis_idx on public.insights (organization_id, analysis_id);

-- Keep the RLS policy surface explicit. An organization may only be read when
-- its ID matches the organization carried by the Clerk session token.
create function public.current_clerk_organization_id()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt()->>'org_id', auth.jwt()->'o'->>'id')
$$;

alter table public.organizations enable row level security;
alter table public.projects enable row level security;
alter table public.analyses enable row level security;
alter table public.files enable row level security;
alter table public.edges enable row level security;
alter table public.routes enable row level security;
alter table public.explanations enable row level security;
alter table public.file_roles enable row level security;
alter table public.insights enable row level security;

grant select on public.organizations, public.projects, public.analyses, public.files,
  public.edges, public.routes, public.explanations, public.file_roles, public.insights
  to authenticated;

grant insert, update, delete on public.organizations, public.projects, public.analyses,
  public.files, public.edges, public.routes, public.explanations, public.file_roles,
  public.insights to authenticated;

create policy "organization members can read their organization"
  on public.organizations for select to authenticated
  using (id = (select public.current_clerk_organization_id()));
create policy "organization members can manage their organization"
  on public.organizations for all to authenticated
  using (id = (select public.current_clerk_organization_id()))
  with check (id = (select public.current_clerk_organization_id()));

create policy "organization members can access projects"
  on public.projects for all to authenticated
  using (organization_id = (select public.current_clerk_organization_id()))
  with check (organization_id = (select public.current_clerk_organization_id()));
create policy "organization members can access analyses"
  on public.analyses for all to authenticated
  using (organization_id = (select public.current_clerk_organization_id()))
  with check (organization_id = (select public.current_clerk_organization_id()));
create policy "organization members can access files"
  on public.files for all to authenticated
  using (organization_id = (select public.current_clerk_organization_id()))
  with check (organization_id = (select public.current_clerk_organization_id()));
create policy "organization members can access edges"
  on public.edges for all to authenticated
  using (organization_id = (select public.current_clerk_organization_id()))
  with check (organization_id = (select public.current_clerk_organization_id()));
create policy "organization members can access routes"
  on public.routes for all to authenticated
  using (organization_id = (select public.current_clerk_organization_id()))
  with check (organization_id = (select public.current_clerk_organization_id()));
create policy "organization members can access explanations"
  on public.explanations for all to authenticated
  using (organization_id = (select public.current_clerk_organization_id()))
  with check (organization_id = (select public.current_clerk_organization_id()));
create policy "organization members can access file roles"
  on public.file_roles for all to authenticated
  using (organization_id = (select public.current_clerk_organization_id()))
  with check (organization_id = (select public.current_clerk_organization_id()));
create policy "organization members can access insights"
  on public.insights for all to authenticated
  using (organization_id = (select public.current_clerk_organization_id()))
  with check (organization_id = (select public.current_clerk_organization_id()));
