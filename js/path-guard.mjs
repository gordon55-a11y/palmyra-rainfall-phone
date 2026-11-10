/** The only OneDrive places this phone may touch. */
export const RAIN_LOG = "/Farming Apps/Palmyra Rainfall/rain-log.json";
export const RAIN_BOOK = "/Farming Apps/Palmyra Rainfall/rainfall-book.json";
export const BACKUP_DIR = "/Farming Apps/Palmyra Rainfall/backups";

const GRAPH_ROOT = "https://graph.microsoft.com/v1.0/me/drive/root:";

export class PathRefused extends Error {
  constructor(message = "This phone only opens the Palmyra rain file.") {
    super(message);
    this.name = "PathRefused";
  }
}

export function normalizeDrivePath(input) {
  let text = String(input || "").trim().replace(/\\/g, "/");
  for (let i = 0; i < 2; i += 1) {
    try {
      const decoded = decodeURIComponent(text);
      if (decoded === text) break;
      text = decoded;
    } catch {
      break;
    }
  }
  const parts = [];
  for (const part of text.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return `/${parts.join("/")}`;
}

function banned(path) {
  const lower = path.toLowerCase();
  return lower.includes("vault") || lower.includes("cattle") || lower.includes("onedrive");
}

export function assertRainPath(input, kind) {
  const path = normalizeDrivePath(input);
  if (banned(path)) throw new PathRefused();
  const lower = path.toLowerCase();
  if (kind === "log" && lower === RAIN_LOG.toLowerCase()) return RAIN_LOG;
  if (kind === "book" && lower === RAIN_BOOK.toLowerCase()) return RAIN_BOOK;
  if (kind === "backup-list" && lower === BACKUP_DIR.toLowerCase()) return BACKUP_DIR;
  if (kind === "backup" && lower.startsWith(`${BACKUP_DIR.toLowerCase()}/`)) {
    const name = path.slice(BACKUP_DIR.length + 1);
    if (name.includes("/") || !/^rain-log-[A-Za-z0-9.+-]+\.json$/.test(name)) {
      throw new PathRefused();
    }
    return `${BACKUP_DIR}/${name}`;
  }
  throw new PathRefused();
}

function encodePath(path) {
  return path.split("/").filter(Boolean).map((part) => encodeURIComponent(part)).join("/");
}

export function itemUrl(path, kind) {
  return `${GRAPH_ROOT}/${encodePath(assertRainPath(path, kind))}`;
}

export function contentUrl(path, kind) {
  return `${itemUrl(path, kind)}:/content`;
}

export function childrenUrl() {
  return `${itemUrl(BACKUP_DIR, "backup-list")}:/children`;
}

export function assertGraphUrl(url) {
  const text = String(url);
  let decoded = text;
  try { decoded = decodeURIComponent(text); } catch { /* keep */ }
  if (!decoded.startsWith("https://graph.microsoft.com/v1.0/me/drive/root:")) {
    throw new PathRefused("Unexpected address.");
  }
  const rest = decoded.slice("https://graph.microsoft.com/v1.0/me/drive/root:".length);
  const pathPart = rest.split(":/")[0];
  const normalized = normalizeDrivePath(pathPart);
  const lower = normalized.toLowerCase();
  if (banned(normalized)) throw new PathRefused();
  if (lower === RAIN_LOG.toLowerCase() || lower === RAIN_BOOK.toLowerCase() || lower === BACKUP_DIR.toLowerCase()) {
    return text;
  }
  if (lower.startsWith(`${BACKUP_DIR.toLowerCase()}/`)) {
    assertRainPath(normalized, "backup");
    return text;
  }
  throw new PathRefused();
}
