# Supabase 配置与建表（组长操作）

## 项目现状（2026-09-24 更新）

| 项 | 状态 |
|---|---|
| 项目 | 已建，ref = `qrttacuxnzjoacfhrqyk`，URL = `https://qrttacuxnzjoacfhrqyk.supabase.co` |
| 凭证 | **已填本地 `.env.local`**（`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`，用的是新的 `sb_publishable_` 格式，等价于原来的 anon key） |
| `.env.local` | 已被 `.gitignore` 忽略，**不会入库** ✓ |
| 连通性 | 实测 `GET /auth/v1/settings` → **200**（凭证有效） |
| **两张表** | ❌ **还没建**（`/rest/v1/favorites` → 404 PGRST205） |
| 邮箱登录 | ✅ 已开启，但 **默认要求收邮件确认** ← 会挡住答辩现场注册 |

## 还差两步

### ① 建表（必须做）

**方式 A（自己动手，1 分钟）**：Supabase 控制台 → 左侧 **SQL Editor** → 把下面整段粘进去 → Run。

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

alter table public.favorites enable row level security;
alter table public.comments  enable row level security;

create policy "favorites readable by all" on public.favorites for select using (true);
create policy "comments readable by all"  on public.comments  for select using (true);

create policy "favorites insert own" on public.favorites for insert with check (auth.uid() = user_id);
create policy "favorites delete own" on public.favorites for delete using (auth.uid() = user_id);
create policy "comments insert own"  on public.comments  for insert with check (auth.uid() = user_id);
create policy "comments delete own"  on public.comments  for delete using (auth.uid() = user_id);
```

**方式 B（交给我做）**：在 https://supabase.com/dashboard/account/tokens 生成一个 **Personal Access Token**（只读/管理用，用完可吊销），发我，我用 Management API 的 `POST /v1/projects/{ref}/database/query` 直接把表建好，并回报结果。

> 为什么要 PAT：建表是 DDL，`sb_publishable_` 这种前端密钥只能读写数据（还受 RLS 限制），**不能建表**。

### ② 关掉邮件确认（强烈建议）

Authentication → **Sign In / Providers → Email** → 关掉 **Confirm email**。
否则组员注册后必须去邮箱点确认链接才能登录，**答辩现场演示会卡住**。

## 为什么 Supabase 没有中国区

区域列表全是 AWS/GCP 的海外机房（新加坡、东京、首尔、孟买、悉尼、法兰克福、美东美西、圣保罗）。没有中国大陆，原因：

1. **合规**：大陆境内提供服务需要 **ICP 备案**，且要求主体是境内公司；Supabase 是美国公司，无中国实体与牌照
2. **云账号体系**：大陆机房是独立体系（独立账号、实名、备案），接不进 Supabase 的部署链路
3. **数据出境**：账号/收藏/评论属个人信息，放境外涉及合规判断

**对中国用户的实际影响**：延迟 50–100ms（新加坡/东京）够用；实测本机 `supabase.com` 200 / 845ms。
唯一要留意的是学校/宿舍那种带认证的网络偶尔不稳。

**若必须放国内**：① 腾讯云开发 CloudBase（境内节点，JS SDK 类似，需重写 `src/services/social.js`）
② 自建 Supabase（Docker 部署到阿里云/腾讯云，要买服务器+备案）③ 放弃后端，收藏存 `localStorage`。

课程作业建议就用 Singapore。

## 上线（GitHub Pages）的注意

`.env.local` 不会上传，**线上默认读不到凭证**，收藏/评论在线上不可用。
要让线上生效：仓库 Settings → Secrets and variables → Actions 加 `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` 两个 Secret，并在构建 workflow 里注入。**答辩前再定即可**（本地演示够用）。

## 本地跑通验证

```powershell
npm run dev
```
控制台**不再**出现「未配置 Supabase 凭证」→ 说明 `.env.local` 生效。
登录后收藏/评论能写能读 → 说明表与 RLS 都建对了。