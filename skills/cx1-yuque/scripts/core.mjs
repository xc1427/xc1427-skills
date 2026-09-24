import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
export const ORIGIN = "https://www.yuque.com";
export class Failure extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}
export function fail(code, message, details) {
  throw new Failure(code, message, details);
}
export function sessionPath() {
  return (
    process.env.YUQUE_SESSION_FILE ||
    path.join(os.homedir(), ".config/cx1-yuque/session.json")
  );
}
export function parseCookie(raw) {
  const cookie = raw.trim().replace(/^cookie:\s*/i, "");
  if (!cookie || /[\r\n]/.test(cookie))
    fail(
      "SESSION_INPUT",
      "输入必须是一行 Cookie header，不是完整 curl、HAR 或 Set-Cookie。",
    );
  const pairs = new Map();
  for (const part of cookie.split(";")) {
    const i = part.indexOf("=");
    if (i < 1) fail("SESSION_INPUT", "Cookie 格式不正确。");
    const key = part.slice(0, i).trim(),
      value = part.slice(i + 1).trim();
    if (!/^[\w-]+$/.test(key) || pairs.has(key))
      fail("SESSION_INPUT", "Cookie 名重复或格式不正确。");
    pairs.set(key, value);
  }
  // 只保存认证所需的两项，不复制整份浏览器 Cookie。
  for (const key of ["_yuque_session", "yuque_ctoken"])
    if (!pairs.get(key))
      fail(
        "SESSION_INPUT",
        `缺少 ${key}；请从已登录 www.yuque.com 的请求头重新取得。`,
      );
  return {
    _yuque_session: pairs.get("_yuque_session"),
    yuque_ctoken: pairs.get("yuque_ctoken"),
  };
}
export function protectFile(file) {
  const st = fs.lstatSync(file);
  if (
    !st.isFile() ||
    st.isSymbolicLink() ||
    st.mode & 0o077 ||
    (process.getuid && st.uid !== process.getuid())
  )
    fail(
      "SESSION_PERMISSIONS",
      "Session 文件必须由当前用户持有、为普通文件且权限为 0600。",
    );
}
export function saveSession(session, file = sessionPath()) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const st = fs.lstatSync(dir);
  if (!st.isDirectory() || st.isSymbolicLink() || st.mode & 0o077)
    fail(
      "SESSION_PERMISSIONS",
      "Session 所在目录必须是私有目录（0700），不能是符号链接。",
    );
  if (fs.existsSync(file)) protectFile(file);
  const tmp = path.join(dir, `.session-${randomUUID()}`);
  fs.writeFileSync(tmp, JSON.stringify(session), { mode: 0o600, flag: "wx" });
  fs.renameSync(tmp, file);
}
export function loadSession(file = sessionPath()) {
  if (!fs.existsSync(file))
    fail(
      "SESSION_MISSING",
      "尚未导入 session。运行 session import --account LOGIN，从 stdin 输入 Cookie。",
    );
  protectFile(file);
  let s;
  try {
    s = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    fail("SESSION_INPUT", "Session 文件不是有效 JSON。");
  }
  if (s.version !== 1 || !s.account?.id || !s.account?.login)
    fail("SESSION_INPUT", "Session 结构无效，请重新导入。");
  s.cookies = parseCookie(
    Object.entries(s.cookies || {})
      .map(([k, v]) => `${k}=${v}`)
      .join("; "),
  );
  if (
    s.expiresAt &&
    (!Number.isFinite(Date.parse(s.expiresAt)) ||
      Date.parse(s.expiresAt) <= Date.now())
  )
    fail("SESSION_EXPIRED", "Cookie 已达到客户端到期时间，请重新导入。");
  return s;
}
export function safePath(input, mode) {
  if (
    typeof input !== "string" ||
    !input.startsWith("/api/") ||
    /[\\#\r\n]/.test(input)
  )
    fail("PATH", "仅接受本站 /api/ 相对路径。");
  const decoded = decodeURIComponent(input.split("?")[0]);
  if (
    decoded.split("/").some((x) => x === "." || x === "..") ||
    decoded.includes("\\")
  )
    fail("PATH", "禁止路径穿越。");
  const url = new URL(input, ORIGIN);
  if (
    url.origin !== ORIGIN ||
    !url.pathname.startsWith("/api/") ||
    (mode === "open") !== url.pathname.startsWith("/api/v2/")
  )
    fail("PATH", "open 只允许 /api/v2/；web 只允许其他 /api/ 路径。");
  return url.href;
}
export class Client {
  constructor({ mode, session, token, fetcher = fetch }) {
    Object.assign(this, { mode, session, token, fetcher });
    this.checked = false;
  }
  async check() {
    if (this.mode === "open") return;
    const j = await this.request("GET", "/api/mine", undefined, {
      skipCheck: true,
    });
    const me = j.data;
    if (!me?.id || !me?.login)
      fail("SESSION_EXPIRED", "/api/mine 未返回有效账号；重新登录并导入。");
    if (
      String(me.id) !== String(this.session.account.id) ||
      me.login !== this.session.account.login
    )
      fail("ACCOUNT_MISMATCH", "Session 账号与已绑定账号不一致；停止操作。");
    this.checked = true;
    return { id: me.id, login: me.login };
  }
  async request(method, endpoint, body, { skipCheck = false } = {}) {
    const url = safePath(endpoint, this.mode);
    if (!["GET", "POST", "PUT", "DELETE", "PATCH"].includes(method))
      fail("METHOD", "不支持的请求方法。");
    if (method === "GET" && body !== undefined)
      fail("INPUT", "GET 参数必须放在 query 中。");
    if (this.mode === "web" && !skipCheck && !this.checked) await this.check();
    const headers = { Accept: "application/json", "User-Agent": "cx1-yuque" };
    if (this.mode === "open") {
      if (!this.token)
        fail(
          "TOKEN_MISSING",
          "请设置 YUQUE_PERSONAL_TOKEN；工具不会自动 source shell 配置。",
        );
      headers["X-Auth-Token"] = this.token;
    } else {
      headers.Cookie = Object.entries(this.session.cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
      headers["x-csrf-token"] = this.session.cookies.yuque_ctoken;
      headers["x-requested-with"] = "XMLHttpRequest";
      headers.Referer = ORIGIN + "/";
      headers.Origin = ORIGIN;
    }
    if (body !== undefined && !(body instanceof FormData))
      headers["Content-Type"] = "application/json";
    let response;
    try {
      response = await this.fetcher(url, {
        method,
        headers,
        body:
          body === undefined
            ? undefined
            : body instanceof FormData
              ? body
              : JSON.stringify(body),
        redirect: "manual",
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      fail(
        "NETWORK_UNKNOWN",
        "网络失败或超时；写请求结果未知，先回读，禁止直接重试。",
        { method },
      );
    }
    if (response.status >= 300 && response.status < 400)
      fail("AUTH_REDIRECT", "拒绝跟随重定向；检查登录状态。");
    if (response.status === 429)
      fail(
        "RATE_LIMIT",
        "Open/Web API 已限流。等待后重新发起读取；不得换通道自动重放写入。",
        {
          httpStatus: 429,
          retryAfter: response.headers.get("retry-after") || null,
        },
      );
    if ([401, 403, 419].includes(response.status))
      fail(
        "AUTH_OR_PERMISSION",
        "认证、CSRF 或权限失败；检查 session/账号/对象权限，不自动切换认证或重放。",
        { httpStatus: response.status },
      );
    if (!response.headers.get("content-type")?.includes("json"))
      fail("NON_JSON", "收到非 JSON 响应；可能是登录页或服务故障。", {
        httpStatus: response.status,
      });
    let json;
    try {
      json = await response.json();
    } catch {
      fail("NON_JSON", "响应 JSON 无法解析；写请求先回读。");
    }
    // 不回显服务端错误正文，避免登录票据或完整请求意外进入日志。
    if (
      !response.ok ||
      json?.success === false ||
      json?.error ||
      Number(json?.status) >= 400 ||
      json?.data?.success === false
    )
      fail(
        "API_ERROR",
        "API 拒绝或报告业务失败。检查参数和权限；写入先核对远端状态。",
        { httpStatus: response.status },
      );
    return json;
  }
}
export async function importSession(
  raw,
  login,
  expiresAt,
  { fetcher = fetch, file = sessionPath() } = {},
) {
  if (!login || typeof login !== "string")
    fail("INPUT", "session import 必须提供 --account LOGIN。");
  if (
    expiresAt &&
    (!Number.isFinite(Date.parse(expiresAt)) ||
      Date.parse(expiresAt) <= Date.now())
  )
    fail("INPUT", "--expires 必须是未来的 ISO 时间。");
  const session = {
    version: 1,
    cookies: parseCookie(raw),
    account: { id: "pending", login },
    importedAt: new Date().toISOString(),
    ...(expiresAt ? { expiresAt } : {}),
  };
  const c = new Client({ mode: "web", session, fetcher });
  const me = (
    await c.request("GET", "/api/mine", undefined, { skipCheck: true })
  ).data;
  if (!me?.id || me.login !== login)
    fail(
      "ACCOUNT_MISMATCH",
      "导入失败：/api/mine 账号与 --account 不一致，原 session 未替换。",
    );
  session.account = { id: me.id, login: me.login };
  saveSession(session, file);
  return {
    account: session.account,
    importedAt: session.importedAt,
    expiresAt: expiresAt || null,
    verified: true,
  };
}

export async function downloadExport(client, source, file, type) {
  const url = new URL(source, ORIGIN);
  if (url.origin !== ORIGIN || !url.pathname.startsWith("/attachments/"))
    fail(
      "DOWNLOAD_ORIGIN",
      "下载地址不在本站附件路径；请另行核验目标，不携带本站凭据。",
    );
  await client.check();
  let response;
  try {
    response = await client.fetcher(url.href, {
      headers: {
        Cookie: Object.entries(client.session.cookies)
          .map(([k, v]) => `${k}=${v}`)
          .join("; "),
        Referer: ORIGIN + "/",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    fail(
      "DOWNLOAD_NETWORK",
      "附件下载失败，可重新获取下载地址；无需重做文档写入。",
    );
  }
  // 已观察到的公网导出会跳转到 OSS 临时签名 URL；该跳转绝不携带 Cookie。
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const destination = new URL(response.headers.get("location") || "", url);
    if (destination.origin !== "https://lark-temp.oss-cn-hangzhou.aliyuncs.com")
      fail("DOWNLOAD_ORIGIN", "下载重定向目标尚未验证，停止并检查网页。");
    try {
      response = await client.fetcher(destination.href, {
        redirect: "manual",
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      fail("DOWNLOAD_NETWORK", "临时导出文件下载失败。");
    }
  }
  if (!response.ok)
    fail("DOWNLOAD_HTTP", "附件下载被拒绝或重定向。", {
      httpStatus: response.status,
    });
  const bytes = Buffer.from(await response.arrayBuffer());
  if (
    response.headers.get("content-type")?.includes("text/html") ||
    (type === "excel" &&
      !bytes.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4])))
  )
    fail("DOWNLOAD_CONTENT", "下载结果不是预期文件，可能是登录页；未保存。");
  fs.writeFileSync(file, bytes, { flag: "wx", mode: 0o600 });
  return { file, bytes: bytes.length };
}
