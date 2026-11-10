import {
  BACKUP_DIR,
  RAIN_BOOK,
  RAIN_LOG,
  PathRefused,
  assertGraphUrl,
  assertRainPath,
  childrenUrl,
  contentUrl,
  itemUrl,
} from "./path-guard.mjs";

export class UnreadableRainError extends Error {
  constructor(message = "The rain file could not be read, so nothing was saved over it.") {
    super(message);
    this.name = "UnreadableRainError";
  }
}

export class SignInNeededError extends Error {
  constructor() {
    super("Sign in to send the readings saved on this phone.");
    this.name = "SignInNeededError";
    this.code = "auth";
  }
}

export function backupName(stamp) {
  const name = `rain-log-${stamp}.json`;
  assertRainPath(`${BACKUP_DIR}/${name}`, "backup");
  return name;
}

/**
 * Microsoft Graph for the Palmyra rain file, its backups, and the rainfall book.
 * Every address is checked before fetch.
 */
export function createGraphDrive({ fetch: fetchImpl, getToken }) {
  const fetchFn = fetchImpl;

  async function request(url, options = {}) {
    assertGraphUrl(url);
    let token = null;
    try {
      token = await getToken();
    } catch {
      token = null;
    }
    if (!token) throw new SignInNeededError();
    return fetchFn(url, {
      method: options.method || "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(options.headers || {}),
      },
      body: options.body,
      cache: "no-store",
    });
  }

  function encodeLog(log) {
    return `${JSON.stringify(log, null, 2)}\n`;
  }

  return {
    kind: "graph",
    async getLog() {
      const response = await request(contentUrl(RAIN_LOG, "log"));
      if (response.status === 404) return { ok: false, status: 404 };
      if (!response.ok) return { ok: false, status: response.status };
      const text = await response.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        throw new UnreadableRainError();
      }
      if (!body || typeof body !== "object" || Array.isArray(body) || !body.days || typeof body.days !== "object") {
        throw new UnreadableRainError();
      }
      return { ok: true, status: 200, etag: response.headers.get("ETag") || "", body, raw: text };
    },
    async putLog(log, etag) {
      if (!etag) throw new PathRefused("Refusing to save without a version check.");
      const response = await request(contentUrl(RAIN_LOG, "log"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", "If-Match": etag },
        body: encodeLog(log),
      });
      if (response.status === 412) return { ok: false, status: 412 };
      if (!response.ok) return { ok: false, status: response.status };
      const item = await response.json().catch(() => ({}));
      return { ok: true, status: 200, etag: item.eTag || item.etag || etag, body: log };
    },
    async putBackup(name, rawText) {
      const path = assertRainPath(`${BACKUP_DIR}/${name}`, "backup");
      const response = await request(contentUrl(path, "backup"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: rawText,
      });
      return { ok: response.ok, status: response.status };
    },
    async listBackups() {
      const response = await request(childrenUrl());
      if (response.status === 404) return [];
      if (!response.ok) return [];
      const payload = await response.json();
      return (payload.value || [])
        .map((item) => item.name)
        .filter((name) => /^rain-log-[A-Za-z0-9.+-]+\.json$/.test(name));
    },
    async deleteBackup(name) {
      const path = assertRainPath(`${BACKUP_DIR}/${name}`, "backup");
      const response = await request(itemUrl(path, "backup"), { method: "DELETE" });
      return response.ok || response.status === 404;
    },
    async getBook() {
      const response = await request(contentUrl(RAIN_BOOK, "book"));
      if (!response.ok) return null;
      try {
        const body = JSON.parse(await response.text());
        if (!body || typeof body !== "object" || !body.months || !body.rain) return null;
        return body;
      } catch {
        return null;
      }
    },
  };
}
