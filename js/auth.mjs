import { MICROSOFT_AUTHORITY, MICROSOFT_CLIENT_ID, MICROSOFT_SCOPES } from "./config.mjs";

export const PUBLISHED_REDIRECT = "https://gordon55-a11y.github.io/palmyra-rainfall-phone/";

export function redirectUri() {
  if (typeof window === "undefined" || !window.location) return PUBLISHED_REDIRECT;
  return new URL("./", window.location.href).href;
}

function loadMsal() {
  if (window.msal?.PublicClientApplication) return Promise.resolve(window.msal);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = new URL("../vendor/msal-browser.min.js", import.meta.url).href;
    script.onload = () => {
      if (window.msal?.PublicClientApplication) resolve(window.msal);
      else reject(new Error("Microsoft sign-in did not start."));
    };
    script.onerror = () => reject(new Error("Could not load Microsoft sign-in."));
    document.head.appendChild(script);
  });
}

function isOnline(online) {
  if (online) return online() !== false;
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

function renewalFailed(error) {
  const code = `${error?.errorCode || ""} ${error?.name || ""} ${error?.message || ""}`;
  return /interaction_required|consent_required|login_required|no_tokens_found|InteractionRequired/i.test(code);
}

/**
 * Same sign-in as the cattle phone.
 * The account and the refresh token live in localStorage, which is how one
 * sign-in stays on this phone. acquireTokenSilent renews with that refresh
 * token. This does not use the hidden frame (ssoSilent): iOS blocks it.
 * Safari and the home-screen icon keep separate storage. Sign in once inside
 * the icon and that sign-in stays with the icon.
 */
export async function createAuth({ msal, online, redirect } = {}) {
  const lib = msal || await loadMsal();
  const app = new lib.PublicClientApplication({
    auth: {
      clientId: MICROSOFT_CLIENT_ID,
      authority: MICROSOFT_AUTHORITY,
      redirectUri: redirect || redirectUri(),
      navigateToLoginRequestUrl: true,
    },
    cache: {
      cacheLocation: "localStorage",
      temporaryCacheLocation: "localStorage",
    },
  });
  await app.initialize();

  function accounts() {
    const active = app.getActiveAccount?.() || null;
    if (active) return active;
    const all = app.getAllAccounts?.() || [];
    return all[0] || null;
  }

  let account = null;
  try {
    const redirectResult = await app.handleRedirectPromise();
    account = redirectResult?.account || accounts();
    if (account && app.setActiveAccount) app.setActiveAccount(account);
  } catch {
    account = accounts();
    if (account && app.setActiveAccount) app.setActiveAccount(account);
  }

  async function renew() {
    const current = accounts() || account;
    if (!isOnline(online)) {
      return { token: null, account: current, status: "offline" };
    }
    if (!current) return { token: null, account: null, status: "none" };
    let timer = 0;
    try {
      const result = await Promise.race([
        app.acquireTokenSilent({
          account: current,
          scopes: MICROSOFT_SCOPES,
          forceRefresh: false,
        }),
        new Promise((_, reject) => {
          const error = new Error("timeout");
          error.errorCode = "timeout";
          timer = setTimeout(() => reject(error), 8000);
        }),
      ]);
      clearTimeout(timer);
      const next = result?.account || current;
      if (result?.account && app.setActiveAccount) app.setActiveAccount(result.account);
      account = next;
      if (!result?.accessToken) return { token: null, account: next, status: "renewal-failed" };
      return { token: result.accessToken, account: next, status: "ready" };
    } catch (error) {
      clearTimeout(timer);
      if (renewalFailed(error)) return { token: null, account: current, status: "renewal-failed" };
      return { token: null, account: current, status: "transient" };
    }
  }

  return {
    account: accounts() || account,
    async renew() {
      return renew();
    },
    async getToken() {
      const result = await renew();
      return result.token;
    },
    async signIn() {
      const current = accounts() || account;
      await app.loginRedirect({
        scopes: MICROSOFT_SCOPES,
        ...(current ? { account: current } : {}),
      });
    },
  };
}
