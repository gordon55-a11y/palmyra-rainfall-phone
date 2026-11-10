import { MICROSOFT_AUTHORITY, MICROSOFT_CLIENT_ID, MICROSOFT_SCOPES } from "./config.mjs";

export function redirectUri() {
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

/** Sign-in happens only when Gordon taps the banner. An expired token does not redirect. */
export async function createAuth() {
  const msal = await loadMsal();
  const app = new msal.PublicClientApplication({
    auth: {
      clientId: MICROSOFT_CLIENT_ID,
      authority: MICROSOFT_AUTHORITY,
      redirectUri: redirectUri(),
      navigateToLoginRequestUrl: true,
    },
    cache: { cacheLocation: "localStorage" },
  });
  await app.initialize();
  const redirect = await app.handleRedirectPromise();
  const account = redirect?.account || app.getAllAccounts()[0] || null;

  async function getToken() {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return null;
    const current = account || app.getAllAccounts()[0];
    if (!current) return null;
    try {
      const result = await Promise.race([
        app.acquireTokenSilent({ account: current, scopes: MICROSOFT_SCOPES }),
        new Promise((_, reject) => { setTimeout(() => reject(new Error("timeout")), 8000); }),
      ]);
      return result?.accessToken || null;
    } catch {
      return null;
    }
  }

  return {
    account,
    async getToken() { return getToken(); },
    async signIn() { await app.loginRedirect({ scopes: MICROSOFT_SCOPES }); },
  };
}
