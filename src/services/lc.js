// LeanCloud 初始化（用户系统 / 评论 / 收藏的云端数据层）
// 凭证来自 .env.local（见 .env.example），未配置时相关功能优雅降级
import LC from "leancloud-storage";

const appId = import.meta.env.VITE_LC_APP_ID;
const appKey = import.meta.env.VITE_LC_APP_KEY;
const serverURL = import.meta.env.VITE_LC_SERVER_URL;

let ready = false;
if (appId && appKey && serverURL) {
  LC.init({ appId, appKey, serverURL });
  ready = true;
} else {
  console.warn("[云墨] 未配置 LeanCloud 凭证（.env.local），用户/评论/收藏功能暂不可用");
}

export { LC, ready };
