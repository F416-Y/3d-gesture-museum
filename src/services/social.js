// 收藏 + 评论的数据访问层（组员4 在展品弹窗里接入）
// 表结构：
//   Favorite: { user: Pointer<_User>, exhibitId: string }
//   Comment:  { user: Pointer<_User>, exhibitId: string, content: string }
import { LC, ready } from "./lc";

function ensureReady() {
  if (!ready) throw new Error("LeanCloud 未配置，请先填写 .env.local");
}

export async function listFavorites(user) {
  ensureReady();
  const q = new LC.Query("Favorite");
  q.equalTo("user", user);
  const rows = await q.find();
  return rows.map((r) => r.get("exhibitId"));
}

export async function isFavorited(user, exhibitId) {
  ensureReady();
  const q = new LC.Query("Favorite");
  q.equalTo("user", user);
  q.equalTo("exhibitId", exhibitId);
  return (await q.count()) > 0;
}

export async function addFavorite(user, exhibitId) {
  ensureReady();
  const f = new (LC.Object.extend("Favorite"))();
  f.set("user", user);
  f.set("exhibitId", exhibitId);
  await f.save();
}

export async function removeFavorite(user, exhibitId) {
  ensureReady();
  const q = new LC.Query("Favorite");
  q.equalTo("user", user);
  q.equalTo("exhibitId", exhibitId);
  await LC.Object.destroyAll(await q.find());
}

export async function listComments(exhibitId) {
  ensureReady();
  const q = new LC.Query("Comment");
  q.equalTo("exhibitId", exhibitId);
  q.include("user");
  q.descending("createdAt");
  q.limit(50);
  const rows = await q.find();
  return rows.map((r) => ({
    id: r.id,
    content: r.get("content"),
    nickname: (r.get("user") && r.get("user").get("username")) || "匿名",
    createdAt: r.createdAt,
  }));
}

export async function addComment(user, exhibitId, content) {
  ensureReady();
  const c = new (LC.Object.extend("Comment"))();
  c.set("user", user);
  c.set("exhibitId", exhibitId);
  c.set("content", content);
  await c.save();
}
