// 收藏 + 评论的数据访问层（组员4 在展品弹窗里接入）
// Supabase 表结构（组长在项目控制台创建）：
//   favorites: id(uuid), user_id(uuid), exhibit_id(text), created_at
//   comments:  id(uuid), user_id(uuid), exhibit_id(text), content(text), created_at
// 行级安全策略（RLS）：允许所有用户读取；仅允许本人插入/删除自己的记录
import { supabase, ready } from "./lc";

function ensureReady() {
  if (!ready) throw new Error("Supabase 未配置，请先填写 .env.local");
}

function ensureUser(user) {
  if (!user || !user.id) throw new Error("请先登录");
}

export async function listFavorites(user) {
  ensureReady();
  ensureUser(user);
  const { data, error } = await supabase
    .from("favorites")
    .select("exhibit_id")
    .eq("user_id", user.id);
  if (error) throw error;
  return (data || []).map((r) => r.exhibit_id);
}

export async function isFavorited(user, exhibitId) {
  ensureReady();
  ensureUser(user);
  const { count, error } = await supabase
    .from("favorites")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("exhibit_id", exhibitId);
  if (error) throw error;
  return (count || 0) > 0;
}

export async function addFavorite(user, exhibitId) {
  ensureReady();
  ensureUser(user);
  const { error } = await supabase
    .from("favorites")
    .insert({ user_id: user.id, exhibit_id: exhibitId });
  if (error) throw error;
}

export async function removeFavorite(user, exhibitId) {
  ensureReady();
  ensureUser(user);
  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("user_id", user.id)
    .eq("exhibit_id", exhibitId);
  if (error) throw error;
}

export async function listComments(exhibitId) {
  ensureReady();
  const { data, error } = await supabase
    .from("comments")
    .select("id, content, created_at, user_id, users(username)")
    .eq("exhibit_id", exhibitId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id,
    content: r.content,
    nickname: (r.users && r.users.username) || "匿名",
    createdAt: r.created_at,
  }));
}

export async function addComment(user, exhibitId, content) {
  ensureReady();
  ensureUser(user);
  const { error } = await supabase
    .from("comments")
    .insert({ user_id: user.id, exhibit_id: exhibitId, content });
  if (error) throw error;
}
