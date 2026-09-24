# Supabase 配置与建表

## 当前状态（2026-09-24 · 后端已跑通）

| 项 | 状态 |
|---|---|
| 项目 | ref = `qrttacuxnzjoacfhrqyk`，URL = `https://qrttacuxnzjoacfhrqyk.supabase.co` |
| 本地凭证 | ✅ `.env.local` 已填（`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`，`sb_publishable_` 新格式） |
| `.env.local` | 已被 `.gitignore` 忽略，不会入库 |
| `favorites` 表 | ✅ 已建 + **3 条 RLS 策略**（所有人可读 / 仅本人写 / 仅本人删） |
| `comments` 表 | ✅ 已建 + **3 条 RLS 策略** |
| 邮箱登录 | ✅ 已开，且 **已关闭「邮件确认」**（`mailer_autoconfirm=true`）→ 注册后可直接登录 |
| 新用户注册 | ✅ 允许（`disable_signup=false`） |

### 端到端实测（已通过）

```
注册 200 → 登录 200（拿到 token）→ 写收藏 201 → 读收藏 200
→ 写评论 201 → 读评论 200 → 清理 200 → 删测试用户（auth.users 剩 0）
```

## 组员现在可以直接测了

```powershell
npm run dev
```
1. 控制台**不应**再出现「未配置 Supabase 凭证」
2. 注册一个账号（随便一个合法邮箱格式，如 `xx@example.com`）→ 应能**直接登录**（不用去邮箱点确认）
3. 登录后收藏 / 评论应能写能读；换账号登录看不到别人的收藏（RLS 生效）

## 建表 SQL（留档，重建项目时用）

```sql
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exhibit_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, exhibit_id)
);
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
create policy "favorites insert own" on public.favorites for insert with check (auth.uid() = user_id);
create policy "favorites delete own" on public.favorites for delete using (auth.uid() = user_id);
create policy "comments readable by all" on public.comments for select using (true);
create policy "comments insert own"  on public.comments  for insert with check (auth.uid() = user_id);
create policy "comments delete own"  on public.comments  for delete using (auth.uid() = user_id);
```

## ⚠️ 安全：PAT 用完请吊销

建表时用过的 Personal Access Token（`sbp_...`）**具备项目级管理权限**，用完请去
https://supabase.com/dashboard/account/tokens 点 **Revoke** 吊销。以后需要再生成新的。

## 为什么 Supabase 没有中国区

区域列表全是 AWS/GCP 海外机房（新加坡、东京、首尔、孟买、悉尼、法兰克福、美东美西、圣保罗）。原因：

1. **合规**：大陆境内提供服务需 ICP 备案 + 境内主体，Supabase 是美国公司，无中国实体与牌照
2. **云账号体系**：大陆机房（阿里云/腾讯云/AWS 中国）是独立体系，接不进 Supabase 的部署链路
3. **数据出境**：账号/收藏/评论属个人信息，放境外涉及合规判断

实测本机 `supabase.com` 200 / 845ms，延迟可用。若必须放国内：腾讯云开发 CloudBase（需重写
`src/services/social.js`）、自建 Supabase（要买服务器+备案）、或放弃后端改用 `localStorage`。

## 上线（GitHub Pages）的注意

`.env.local` 不会上传，**线上默认读不到凭证**，收藏/评论在线上不可用。
要让线上生效：仓库 Settings → Secrets and variables → Actions 加 `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY`，并在构建 workflow 里注入。**答辩前再定即可**。