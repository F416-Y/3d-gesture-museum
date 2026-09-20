// 当前登录用户（Pinia）
import { defineStore } from "pinia";
import { LC, ready } from "../services/lc";

export const useUserStore = defineStore("user", {
  state: () => ({
    current: ready ? LC.User.current() : null,
  }),
  getters: {
    isLoggedIn: (s) => !!s.current,
    username: (s) => (s.current ? s.current.get("username") : ""),
  },
  actions: {
    async login(username, password) {
      this.current = await LC.User.logIn(username, password);
    },
    async register(username, password) {
      const u = new LC.User();
      u.setUsername(username);
      u.setPassword(password);
      this.current = await u.signUp();
    },
    logout() {
      if (ready) LC.User.logOut();
      this.current = null;
    },
  },
});
