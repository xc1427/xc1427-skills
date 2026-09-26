import { fail, ORIGIN } from "./core.mjs";
import { parseTarget, enc, query } from "./runtime.mjs";
export async function webBook(r, ref) {
  const target = parseTarget(ref);
  if (!target.book) {
    if (r.cache.has("webbook:" + target.id))
      return r.cache.get("webbook:" + target.id);
    if (r.bookRefs.has(String(target.id)))
      return webBook(r, r.bookRefs.get(String(target.id)));
    if (!r.webBooks) {
      const j = await r.request("web", "GET", "/api/mine/book_stacks");
      r.webBooks = (j.data || []).flatMap((s) => s.books || []);
    }
    const book = r.webBooks.find((b) => String(b.id) === String(target.id));
    if (!book)
      fail(
        "BOOK_NOT_FOUND",
        "无法从个人知识库列表解析此数字 ID，请提供库 URL。",
      );
    book.namespace ??= book.user?.login
      ? `${book.user.login}/${book.slug}`
      : undefined;
    return book;
  }
  const key = "webbook:" + target.book;
  if (r.cache.has(key)) return r.cache.get(key);
  const c = await r.webClient();
  r.routes.add("web");
  const url = ORIGIN + "/" + target.book.split("/").map(enc).join("/");
  let res;
  try {
    res = await c.fetcher(url, {
      headers: {
        Accept: "text/html",
        Cookie: Object.entries(c.session.cookies)
          .map(([k, v]) => k + "=" + v)
          .join("; "),
      },
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    fail("NETWORK_UNKNOWN", "知识库页面读取失败。");
  }
  if (!res.ok || !res.headers.get("content-type")?.includes("text/html"))
    fail("BOOK", "无法读取知识库页面；检查地址及登录状态。", {
      httpStatus: res.status,
    });
  const html = await res.text(),
    m = html.match(/JSON\.parse\(decodeURIComponent\("([^"]+)"/);
  let book;
  try {
    book = JSON.parse(decodeURIComponent(m?.[1])).book;
  } catch {
    fail("WEB_SCHEMA", "知识库页面数据结构已变化；停止并在 Chrome 检查。");
  }
  if (!book?.id) fail("BOOK", "页面未包含有效知识库。");
  book.namespace = target.book;
  r.bookRefs.set(String(book.id), target.book);
  r.cache.set(key, book);
  r.cache.set("webbook:" + book.id, book);
  return book;
}
export async function webDocument(r, ref, { book } = {}) {
  const p = parseTarget(ref),
    refBook = p.book || book;
  if (!refBook) {
    if (!/^\d+$/.test(p.id || ""))
      fail("BOOK", "Web 工作流需要文档 URL，或 ID 加 --book。");
    const c = await r.webClient();
    r.routes.add("web");
    let res;
    try {
      res = await c.fetcher(ORIGIN + "/go/doc/" + p.id, {
        headers: {
          Cookie: Object.entries(c.session.cookies)
            .map(([k, v]) => k + "=" + v)
            .join("; "),
        },
        redirect: "manual",
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      fail("NETWORK_UNKNOWN", "短链接解析失败。");
    }
    const location = res.headers.get("location");
    if (res.status < 300 || res.status >= 400 || !location)
      fail("BOOK", "短链接没有返回文档地址；请提供完整文档 URL 或 --book。");
    const url = new URL(location, ORIGIN),
      resolved = parseTarget(url.href);
    if (resolved.type !== "doc" || !resolved.book)
      fail("BOOK", "短链接没有指向本站文档。");
    return webDocument(r, url.href, {});
  }
  const b = await r.book(refBook),
    j = await r.request(
      "web",
      "GET",
      query("/api/docs/" + enc(p.id), { book_id: b.id, raw: 1 }),
    ),
    d = j.data;
  if (!d?.id || Number(d.book_id) !== Number(b.id))
    fail("RESPONSE", "文档响应缺少或不匹配 id/book_id。");
  if (d.collab) delete d.collab.token;
  d.book = { ...b, ...d.book, namespace: b.namespace || d.book?.namespace };
  if (d.format === "lake") d.body_lake = d.content ?? d.body_asl ?? d.body;
  else if (d.format === "html") d.body_html = d.content ?? d.body;
  else if (d.format === "markdown") d.body = d.content ?? d.body;
  r.cache.set("webbook:" + b.id, b);
  return d;
}

export async function webProfile(r, login) {
  if (!/^[a-zA-Z0-9_-]+$/.test(login)) fail("TARGET", "用户/团队 login 无效。");
  const c = await r.webClient();
  r.routes.add("web");
  let response;
  try {
    response = await c.fetcher(ORIGIN + "/" + enc(login), {
      headers: {
        Accept: "text/html",
        Cookie: Object.entries(c.session.cookies)
          .map(([k, v]) => k + "=" + v)
          .join("; "),
      },
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    fail("NETWORK_UNKNOWN", "用户/团队页面读取失败。");
  }
  if (
    !response.ok ||
    !response.headers.get("content-type")?.includes("text/html")
  )
    fail("RESPONSE", "无法读取用户/团队页面。", {
      httpStatus: response.status,
    });
  const html = await response.text(),
    match = html.match(/JSON\.parse\(decodeURIComponent\("([^"]+)"/);
  let data;
  try {
    data = JSON.parse(decodeURIComponent(match?.[1]));
  } catch {
    fail("WEB_SCHEMA", "用户/团队页面结构已变化。");
  }
  const entity = data.user || data.group;
  if (!entity?.id || entity.login !== login)
    fail("RESPONSE", "用户/团队身份不匹配。");
  return entity;
}
