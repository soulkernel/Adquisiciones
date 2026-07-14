(function () {
  "use strict";

  const SESSION_KEY = "glf_demo_session";
  const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

  function byId(id) {
    return document.getElementById(id);
  }

  function safeSessionStorage() {
    const memory = new Map();
    try {
      const testKey = `glf_login_test_${Date.now()}`;
      window.sessionStorage.setItem(testKey, "1");
      window.sessionStorage.removeItem(testKey);
      return window.sessionStorage;
    } catch {
      return {
        getItem: (key) => (memory.has(key) ? memory.get(key) : null),
        setItem: (key, value) => memory.set(key, String(value)),
        removeItem: (key) => memory.delete(key),
      };
    }
  }

  const sessionStore = safeSessionStorage();

  function readSession() {
    try {
      return JSON.parse(sessionStore.getItem(SESSION_KEY) || "null");
    } catch {
      return null;
    }
  }

  function hasActiveSession() {
    const session = readSession();
    return Boolean(session?.startedAt && Date.now() - Number(session.startedAt) < SESSION_MAX_AGE_MS);
  }

  function showLoginError(message) {
    const errorBox = byId("loginError");
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function enterApp() {
    const loginScreen = byId("loginScreen");
    const appShell = byId("appShell");
    if (loginScreen) {
      loginScreen.hidden = true;
      loginScreen.style.display = "none";
    }
    if (appShell) {
      appShell.hidden = false;
      appShell.removeAttribute("hidden");
      appShell.style.display = "grid";
    }
    window.dispatchEvent(new CustomEvent("glf:login-success"));
  }

  function attemptLogin(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const user = (byId("username")?.value || "").trim().toUpperCase();
    const pass = (byId("password")?.value || "").trim().toUpperCase();

    if (user === "ADMIN" && pass === "DEMO") {
      sessionStore.setItem(
        SESSION_KEY,
        JSON.stringify({ user, startedAt: Date.now(), lastSeenAt: Date.now() }),
      );
      const errorBox = byId("loginError");
      if (errorBox) errorBox.hidden = true;
      enterApp();
      return true;
    }

    showLoginError("Usuario o contraseña incorrectos.");
    return false;
  }

  function bootLogin() {
    const form = byId("loginForm");
    const button = byId("loginSubmitBtn");

    if (form) form.addEventListener("submit", attemptLogin, true);
    if (button) button.addEventListener("click", attemptLogin, true);

    if (hasActiveSession()) {
      enterApp();
    }
  }

  window.GLF_LOGIN_BOOT = {
    attemptLogin,
    enterApp,
    hasActiveSession,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootLogin);
  } else {
    bootLogin();
  }
})();
