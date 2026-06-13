-- ═══ Phase 1.1 · profiles 表 + RLS + 注册触发器 ═══
-- 说明：用 Supabase Auth 扛密码/JWT；profiles 扩展 auth.users；
--       注册时前端把 username 映射成邮箱 {username}@yjsg.local，
--       额外字段（username/nickname/密保）放进 signUp 的 options.data，
--       由下方触发器从 raw_user_meta_data 取出落库。
-- 应用方式：在 Supabase SQL Editor 执行（手动）。
-- 注：注销账号按《需要补充逻辑》§八「后端不做」，不建 DELETE 策略。

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  nickname text,
  avatar_url text,
  gender text,                -- '男'/'女'，资料编辑时填
  birthday date,
  hometown text,              -- "省 · 市"
  dish text,                  -- 代表味道（选填）
  security_question text not null default '',
  security_answer_hash text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 本人可读自己
drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select"
  on public.profiles for select to authenticated
  using (id = auth.uid());

-- 本人可改自己（昵称/头像/性别/生日/籍贯/味道/密保）
drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- INSERT 由下方触发器以 SECURITY DEFINER 完成，不开放直接 INSERT。

-- 注册触发器：auth.users 新建时自动建 profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, nickname, security_question, security_answer_hash)
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'nickname',
    coalesce(new.raw_user_meta_data ->> 'security_question', ''),
    coalesce(new.raw_user_meta_data ->> 'security_answer_hash', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
