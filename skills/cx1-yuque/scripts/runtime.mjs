import { webBook, webDocument } from "./web-context.mjs";
import { Client, fail, loadSession, ORIGIN } from "./core.mjs";
import { isDeepStrictEqual } from "node:util";
import { createHash } from "node:crypto";
export const enc = (x) => encodeURIComponent(String(x));
export const hash = (x) =>
  createHash("sha256")
    .update(typeof x === "string" ? x : JSON.stringify(x))
    .digest("hex");
export const query = (path, args = {}) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(args))
    if (v !== undefined)
      p.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  return path + (p.size ? "?" + p : "");
};
export const bodyOf = (d) => d.body_lake || d.body || d.content || "";
export function parseTarget(input) {
  if (!input || typeof input !== "string")
    fail("TARGET", "需要对象 URL、数字 ID 或 owner/book。");
  if (/^https?:/.test(input)) {
    let u;
    try {
      u = new URL(input);
    } catch {
      fail("TARGET", "URL 无效。");
    }
    if (u.origin !== ORIGIN)
      fail("TARGET", "仅接受 https://www.yuque.com 的对象 URL。");
    const s = u.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    if (s[0] === "go" && s[1] === "doc" && /^\d+$/.test(s[2]))
      return { type: "doc", id: s[2] };
    if (s[0] === "r" && s[1] === "note" && s[2])
      return { type: "note", id: s[2] };
    if (s[0] === "dashboard" && s[1] === "note" && s[2])
      return { type: "note", id: s[2] };
    if (
      [
        "api",
        "dashboard",
        "settings",
        "explore",
        "login",
        "r",
        "search",
        "notifications",
        "register",
      ].includes(s[0])
    )
      fail("TARGET", "此 URL 不是受支持的文档/知识库/小记地址。");
    if (s.length === 3)
      return { type: "doc", book: `${s[0]}/${s[1]}`, id: s[2] };
    if (s.length === 2) return { type: "book", book: s.join("/") };
    if (s.length === 1) return { type: "user", id: s[0] };
    fail("TARGET", "无法识别对象 URL。");
  }
  if (/^\d+$/.test(input)) return { type: "id", id: input };
  if (/^[^/\s]+\/[^/\s]+$/.test(input)) return { type: "book", book: input };
  return { type: "slug", id: input };
}
export function one(
  items,
  value,
  { key = "id", name = "name", kind = "对象" } = {},
) {
  const matches = items.filter(
    (x) => String(x[key]) === String(value) || x[name] === value,
  );
  if (matches.length !== 1)
    fail(
      matches.length ? "AMBIGUOUS" : "NOT_FOUND",
      `${kind}匹配数量为 ${matches.length}。请提供唯一 ID。`,
      { candidates: matches.map((x) => ({ id: x[key], name: x[name] })) },
    );
  return matches[0];
}
export class Runtime {
  constructor({ sessionLoader = loadSession, fetcher = fetch } = {}) {
    this.sessionLoader = sessionLoader;
    this.fetcher = fetcher;
    this.cache = new Map();
    this.bookRefs = new Map();
    this.steps = [];
    this.routes = new Set();
    this.pending = null;
    this.account = null;
  }
  async webClient() {
    if (!this.web) {
      this.web = new Client({
        mode: "web",
        session: this.sessionLoader(),
        fetcher: this.fetcher,
      });
    }
    await this.web.check();
    return this.web;
  }
  async preflightWeb() {
    await this.webClient();
  }
  async me() {
    const c = await this.webClient();
    this.routes.add("web");
    return c.account;
  }

  async request(route, method, path, body, { read = false } = {}) {
    if (route !== "web")
      fail("ROUTE_REMOVED", "仅支持 Web API；不再使用 Open API Token。");
    const c = await this.webClient();
    this.routes.add(route);
    const mutation = method !== "GET" && !read;
    if (mutation) this.pending = { route, method, path: path.split("?")[0] };
    let j;
    try {
      j = await c.request(method, path, body);
    } catch (e) {
      if (mutation) e.details = { ...e.details, operation: this.pending };
      if (
        !["NETWORK_UNKNOWN", "NON_JSON", "AUTH_REDIRECT"].includes(e.code) &&
        !(
          e.code === "API_ERROR" &&
          (e.details?.httpStatus >= 500 || e.details?.httpStatus === 200)
        )
      )
        this.pending = null;
      throw e;
    }
    if (mutation) {
      this.steps.push({
        ...this.pending,
        id:
          j.data?.id ||
          j.data?.attachment_id ||
          j.id ||
          body?.field?.id ||
          body?.data?.id,
        ids:
          body?.fields?.map((f) => f.id) ||
          (Array.isArray(body?.data) ? body.data.map((x) => x.id) : undefined),
        docId: body?.docId,
      });
      this.pending = null;
      this.cache.clear();
      this.webBooks = null;
    }
    return j;
  }
  async book(ref, { fresh = false } = {}) {
    if (fresh) {
      this.cache.clear();
      this.webBooks = null;
    }
    return webBook(this, ref);
  }
  async doc(ref, { book, fresh = false } = {}) {
    return webDocument(this, ref, { book, fresh });
  }
  async webDoc(doc) {
    return (
      await this.request(
        "web",
        "GET",
        query("/api/docs/" + enc(doc.id), { book_id: doc.book_id, raw: 1 }),
      )
    ).data;
  }
  url(d) {
    return d.book?.namespace && d.slug
      ? `${ORIGIN}/${d.book.namespace}/${d.slug}`
      : `${ORIGIN}/go/doc/${d.id}`;
  }
  async poll(read, test, message) {
    for (let i = 0; i < 4; i++) {
      const v = await read();
      if (test(v)) return v;
      if (i < 3) await new Promise((r) => setTimeout(r, 750));
    }
    fail(
      "VERIFY_MISMATCH",
      message || "已提交，但只读核验未满足条件；不要重复写入。",
    );
  }
  async pages(route, path, params = {}, mode = "offset", all = false) {
    let page = Number(params.page || 1),
      offset = Number(params.offset || 0),
      limit = Number(params.limit || (mode === "page" ? 20 : 100)),
      out = [],
      seen = new Set();
    for (let i = 0; i < (all ? 100 : 1); i++) {
      const j = await this.request(
        route,
        "GET",
        query(path, {
          ...params,
          ...(mode === "page" ? { page } : { offset, limit }),
        }),
      );
      const d = j.data ?? j,
        rows = Array.isArray(d)
          ? d
          : d.notes || d.records || d.actions || d.items || null;
      if (!Array.isArray(rows)) fail("PAGINATION", "未知分页响应结构。");
      const signature = JSON.stringify(rows.map((x) => x.id ?? x.uuid ?? x));
      if (seen.has(signature) && rows.length)
        fail("PAGINATION_STALLED", "分页未推进，停止并保留已读取数量。", {
          count: out.length,
        });
      seen.add(signature);
      out.push(
        ...(i === 0 && Array.isArray(d.pin_notes) ? d.pin_notes : []),
        ...rows,
      );
      const more =
        d.has_more ?? d.hasMore ?? j.meta?.has_more ?? rows.length > 0;
      if (!all || !more || !rows.length)
        return {
          items: out,
          complete: !more,
          next: more
            ? mode === "page"
              ? { page: page + 1 }
              : { offset: offset + rows.length }
            : null,
        };
      page++;
      offset += rows.length;
    }
    fail("PAGINATION_LIMIT", "达到 100 页读取上限，请指定范围。", {
      count: out.length,
    });
  }
  result(data, status = "read") {
    return {
      status,
      route: [...this.routes].join("+") || "local",
      data,
      ...(this.steps.length ? { completed: this.steps } : {}),
    };
  }
  error(e) {
    return {
      status: this.pending
        ? "unknown"
        : this.steps.length
          ? "partial"
          : "failed",
      error: e.code || "LOCAL_ERROR",
      message: e.code ? e.message : "本地输入、文件或运行环境错误。",
      ...e.details,
      ...(this.steps.length ? { completed: this.steps } : {}),
    };
  }
}
export function equalFields(actual, expected) {
  return Object.entries(expected).every(([k, v]) =>
    isDeepStrictEqual(actual?.[k], v),
  );
}
export function checkHash(body, expected) {
  if (expected && hash(body) !== expected)
    fail("CONFLICT", "正文版本已变化；重新读取再编辑。");
}

export function containsFields(actual, expected) {
  if (Array.isArray(expected))
    return (
      Array.isArray(actual) &&
      actual.length === expected.length &&
      expected.every((v, i) => containsFields(actual[i], v))
    );
  if (expected && typeof expected === "object")
    return Object.entries(expected).every(([k, v]) =>
      containsFields(actual?.[k], v),
    );
  return isDeepStrictEqual(actual, expected);
}

export function describeUrl(input) {
  const u = new URL(input);
  if (u.origin !== ORIGIN) fail("TARGET", "仅解析公网语雀地址。");
  const parts = u.pathname.split("/").filter(Boolean),
    head = parts[0];
  let value;
  if (!head) value = { type: "home" };
  else if (head === "api") value = { type: "api", path: u.pathname };
  else if (head === "go" && parts[1] !== "doc")
    value = { type: "go", redirect_type: parts[1], redirect_id: parts[2] };
  else if (
    [
      "dashboard",
      "settings",
      "explore",
      "login",
      "search",
      "notifications",
      "register",
    ].includes(head) &&
    !(head === "dashboard" && parts[1] === "note" && parts[2])
  )
    value = { type: "system", path: u.pathname };
  else value = parseTarget(input);
  return {
    ...value,
    ...(u.hash ? { hash: u.hash.slice(1) } : {}),
    ...(u.search ? { query: Object.fromEntries(u.searchParams) } : {}),
  };
}
