import { fail, ORIGIN } from "./core.mjs";
import { parseTarget, enc, query } from "./runtime.mjs";
export async function webBook(r, ref) {
  const target = parseTarget(ref);
  if (!target.book) {
    if (!r.webBooks) {
      const j = await r.request("web", "GET", "/api/mine/book_stacks");
      r.webBooks = (j.data || []).flatMap((s) => s.books || []);
    }
    const book = r.webBooks.find((b) => String(b.id) === String(target.id));
    if (!book)
      fail("BOOK", "Web 模式无法从个人知识库列表解析此数字 ID，请提供库 URL。");
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
  r.cache.set(key, book);
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
  d.book = { ...b, ...d.book, namespace: b.namespace || d.book?.namespace };
  if (d.format === "lake") d.body_lake = d.content || d.body;
  return d;
}
