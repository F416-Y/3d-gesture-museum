# Supabase 配置与建表（组长操作，约 10 分钟）

## 现状

- 代码已写好：`src/services/lc.js`（初始化）、`src/services/social.js`（收藏/评论数据层）、`src/views/FavoritesView.vue`（收藏页）
- **`.env.local` 不存在**（只有 `.env.example` 空模板）→ 所以 Supabase 目前是 `ready = false`，代码会 `console.warn` 后降级，**不影响其他功能**
- `.env.local` 已在 `.gitignore` 里，**不会入库**

## 第 1 步 · 建项目

1. 打开 https://supabase.com → 用 GitHub 登录（免费版够用）
2. New project → 名字随意（如 `yunmo-museum`）、选个近的区域（Singapore / Tokyo）
3. 等 2 分钟初始化完成

## 第 2 步 · 拿凭证

项目页 → 左下 **Settings → API**：

| 要复制的 | 对应字段 |
|---|---|
| **Project URL**（形如 `https://xxxx.supabase.co`） | `VITE_SUPABASE_URL` |
| **anon public** key（很长的一串 JWT） | `VITE_SUPABASE_ANON_KEY` |

> 注意：是 **anon public**，不是 `service_role`（后者是管理员密钥，绝不能进前端）

## 第 3 步 · 本地填 .env.local

在项目根目录（`3d-gesture-museum\`）复制 `.env.example` 为 `.env.local`，填成：

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...（那一长串）
```

填完 `npm run dev` 重启一次，控制台不再出现「未配置 Supabase 凭证」即成功。

## 第 4 步 · 建表 + 行级安全（在 SQL Editor 粘贴执行）

```sql
-- 收藏
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exhibit_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, exhibit_id)
);

-- 评论
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exhibit_id text not null,
  content text not null,
  created_at timestamptz not null default now()
);

-- 开启行级安全
alter table public.favorites enable row level security;
alter table public.comments  enable row level security;

-- 所有人可读
create policy "favorites readable by all" on public.favorites for select using (true);
create policy "comments readable by all"  on public.comments  for select using (true);

-- 仅本人可写/删
create policy "favorites insert own" on public.favorites for insert with check (auth.uid() = user_id);
create policy "favorites delete own" on public.favorites for delete using (auth.uid() = user_id);
create policy "comments insert own"  on public.comments  for insert with check (auth.uid() = user_id);
create policy "comments delete own"  on public.comments  for delete using (auth.uid() = user_id);
```

## 第 5 步 · 打开登录方式

Authentication → Providers → **Email** 打开（建议同时关掉 "Confirm email" 方便答辩演示，否则注册后要收邮件确认）。

## 第 6 步 · 通知组员

凭证填好后告诉组员5/组员4：`npm run dev` 起来后收藏/评论应该能跑通；
若报「请先登录」，说明 Auth 的 Email provider 没开。

## ⚠️ 上线（GitHub Pages）时的注意

`.env.local` 不会上传，所以**线上站点默认也读不到凭证**，收藏/评论在线上不可用。
要让线上生效，需在 GitHub 仓库 → Settings → Secrets and variables → Actions 里加
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` 两个 Secret，并在构建 workflow 里注入。
**这条是否要做，答辩前再定即可**（本地演示够用）。