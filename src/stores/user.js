// 当前登录用户（Pinia）
// Supabase Auth 需要邮箱，我们用 "用户名@cloudink.local" 这种内部邮箱占位
import { defineStore } from "pinia";
import { supabase, ready } from "../services/lc";

function toEmail(username) {
  return username.trim().toLowerCase().replace(/\s+/g, "_") + "@cloudink.local";
}

export const useUserStore = defineStore("user", {
  state: () => ({
    current: ready && supabase.auth.getSession
      ? null
      : null,
    displayName: "",
  }),
  getters: {
    isLoggedIn: (s) => !!s.current,
    username: (s) => s.displayName || (s.current && (s.current.user_metadata && s.current.user_metadata.display_name)) || "",
  },
  actions: {
    async restoreSession() {
      if (!ready) return;
      const { data } = await supabase.auth.getSession();
      this.current = data.session ? data.session.user : null;
      this.displayName = this.current && this.current.user_metadata && this.current.user_metadata.display_name
        ? this.current.user_metadata.display_name
        : "";
    },
    async login(username, password) {
      if (!ready) throw new Error("Supabase 未配置");
      const { data, error } = await supabase.auth.signInWithPassword({
        email: toEmail(username),
        password,
      });
      if (error) throw error;
      this.current = data.user;
      this.displayName = username.trim();
    },
    async register(username, password) {
      if (!ready) throw new Error("Supabase 未配置");
      const { data, error } = await supabase.auth.signUp({
        email: toEmail(username),
        password,
        options: { data: { display_name: username.trim() } },
      });
      if (error) throw error;
      this.current = data.user;
      this.displayName = username.trim();
    },
    async logout() {
      if (ready) await supabase.auth.signOut();
      this.current = null;
      this.displayName = "";
    },
  },
});
