// 后端服务入口：Supabase 初始化
// 未配置凭证时自动降级，登录/收藏/评论功能不可用，但博物馆仍能正常浏览
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase = null;
let ready = false;

if (url && key) {
  supabase = createClient(url, key);
  ready = true;
} else {
  console.warn("[云间入墨] 未配置 Supabase 凭证（.env.local），用户/评论/收藏功能暂不可用");
}

export { supabase, ready };
