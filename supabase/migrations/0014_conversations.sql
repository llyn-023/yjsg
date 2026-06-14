-- ═══ Phase 4.2 · conversations + conversation_messages 表 + RLS ═══
-- conversations: Agent 对话（type: new/anchor/draft/my_version/interview）
-- conversation_messages: 对话消息（role: user/assistant）
-- RLS：读=对话所属用户；增/改/删同理（用户私有）。
-- 应用方式：SQL Editor 手动执行。

-- 1. conversations
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  family_id uuid references public.families(id) on delete set null,
  anchor_id uuid references public.anchors(id) on delete set null,
  type text not null default 'new' check (type in ('new','anchor','draft','my_version','interview')),
  title text default '',
  entry_context jsonb default '{}'::jsonb,   -- 进入上下文（family_name / anchor 等）
  state jsonb default '{}'::jsonb,            -- §8.1 后台状态模型
  status text not null default 'active' check (status in ('active','draft','done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_conv_user on public.conversations(user_id, status);
create index if not exists idx_conv_family on public.conversations(family_id);

alter table public.conversations enable row level security;

-- conversations RLS：用户隔离
drop policy if exists "conv_select" on public.conversations;
create policy "conv_select" on public.conversations for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "conv_insert" on public.conversations;
create policy "conv_insert" on public.conversations for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "conv_update" on public.conversations;
create policy "conv_update" on public.conversations for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "conv_delete" on public.conversations;
create policy "conv_delete" on public.conversations for delete to authenticated
  using (user_id = auth.uid());

-- 2. conversation_messages
create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null default '',
  media jsonb default '[]'::jsonb,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_cmsg_conv on public.conversation_messages(conversation_id, created_at);

alter table public.conversation_messages enable row level security;

-- conversation_messages RLS：用户通过 conversation 隔离
drop policy if exists "cmsg_select" on public.conversation_messages;
create policy "cmsg_select" on public.conversation_messages for select to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()));
drop policy if exists "cmsg_insert" on public.conversation_messages;
create policy "cmsg_insert" on public.conversation_messages for insert to authenticated
  with check (exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()));
drop policy if exists "cmsg_delete" on public.conversation_messages;
create policy "cmsg_delete" on public.conversation_messages for delete to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()));
