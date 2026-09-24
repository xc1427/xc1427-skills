import { fail } from "./core.mjs";
import {
  enc,
  query,
  bookPath,
  equalFields,
  parseTarget,
  hash,
} from "./runtime.mjs";
function compact(page, keys, raw) {
  if (raw) return page;
  return {
    ...page,
    items: page.items.map((x) =>
      Object.fromEntries(
        keys.filter((k) => x[k] !== undefined).map((k) => [k, x[k]]),
      ),
    ),
  };
}
export async function openCommand(r, group, action, target, o) {
  if (group === "auth" || group === "user") {
    if (action === "status" || action === "me") {
      const d = await r.me();
      return r.result(o.raw ? d : { id: d.id, login: d.login, name: d.name });
    }
    if (action === "groups") {
      const me = target || (await r.me()).login;
      return r.result(
        await r.pages(
          "open",
          `/api/v2/users/${enc(me)}/groups`,
          { role: o.role, offset: o.offset },
          "offset",
          o.all,
        ),
      );
    }
  }
  if (group === "ping")
    return r.result((await r.request("open", "GET", "/api/v2/hello")).data);
  if (group === "search") {
    if (!target) fail("INPUT", "搜索需要关键词。");
    return r.result(
      compact(
        await r.pages(
          "open",
          "/api/v2/search",
          {
            q: target,
            type: o.type || "doc",
            scope: o.scope,
            creator: o.creator,
            page: o.page,
          },
          "page",
          o.all,
        ),
        ["id", "type", "title", "summary", "url", "info"],
        o.raw,
      ),
    );
  }
  if (group === "book") {
    if (action === "list") {
      const owner = target || (await r.me()).login;
      return r.result(
        compact(
          await r.pages(
            "open",
            `/api/v2/${o.group ? "groups" : "users"}/${enc(owner)}/repos`,
            {
              offset: o.offset,
              limit: o.limit,
              type: o.type,
              filterByAbility: o.filterByAbility,
            },
            "offset",
            o.all,
          ),
          [
            "id",
            "type",
            "name",
            "namespace",
            "slug",
            "description",
            "public",
            "updated_at",
          ],
          o.raw,
        ),
      );
    }
    if (action === "get") return r.result(await r.book(target));
    if (action === "create") {
      const owner = target || (await r.me()).login,
        p = { ...(o.input || {}) };
      for (const k of ["name", "slug", "description", "public"])
        if (o[k] !== undefined) p[k] = o[k];
      if (!p.name || !p.slug)
        fail("INPUT", "创建知识库需要 --name 和 --slug。");
      p.public ??= 0;
      const d = (
        await r.request(
          "open",
          "POST",
          `/api/v2/${o.group ? "groups" : "users"}/${enc(owner)}/repos`,
          p,
        )
      ).data;
      if (!d?.id) fail("RESPONSE", "创建未返回 ID。");
      const after = await r.poll(
        () => r.book(String(d.id), { fresh: true }),
        (x) => equalFields(x, { name: p.name, slug: p.slug }),
      );
      return r.result(after, "verified");
    }
    const b = await r.book(target);
    if (action === "update") {
      const p = { ...(o.input || {}) };
      for (const k of ["name", "slug", "description", "public"])
        if (o[k] !== undefined) p[k] = o[k];
      if (!Object.keys(p).length) fail("INPUT", "没有更新字段。");
      await r.request("open", "PUT", bookPath(String(b.id)), p);
      const { toc, ...check } = p;
      const after = await r.poll(
        () => r.book(String(b.id), { fresh: true }),
        (x) => equalFields(x, check),
      );
      return r.result(after, toc === undefined ? "verified" : "submitted");
    }
    if (action === "delete") {
      if (!o.yes) fail("CONFIRM", "删除知识库需要 --yes。");
      await r.request("open", "DELETE", bookPath(String(b.id)));
      await r.poll(async () => {
        try {
          await r.book(String(b.id), { fresh: true });
          return false;
        } catch (e) {
          if (e.details?.httpStatus === 404) return true;
          throw e;
        }
      }, Boolean);
      return r.result({ id: b.id, deleted: true }, "verified");
    }
  }
  if (group === "doc" && action === "list")
    return r.result(
      compact(
        await r.pages(
          "open",
          bookPath(target) + "/docs",
          { offset: o.offset, limit: o.limit },
          "offset",
          o.all,
        ),
        [
          "id",
          "slug",
          "title",
          "type",
          "format",
          "public",
          "status",
          "updated_at",
        ],
        o.raw,
      ),
    );
  if (group === "note") {
    const via = r.webContext ? "web" : "open",
      root =
        via === "web"
          ? "/api/modules/note/notes/NoteController"
          : "/api/v2/notes";
    if (via === "web") await r.preflightWeb();
    const get = async (id) => {
      const j = await r.request(
        via,
        "GET",
        via === "web"
          ? query(root + "/show", { id, merge_dynamic_data: 0 })
          : root + "/" + enc(id),
      );
      return j.data ?? j;
    };

    if (action === "list")
      return r.result(
        await r.pages(
          via,
          via === "web" ? root + "/index" : root,
          {
            status: o.status,
            offset: o.offset ?? ((o.page || 1) - 1) * (o.limit || 20),
            limit: o.limit || 20,
            ...(via === "web"
              ? { q: o.q, filter_type: o.filterType, order: o.order }
              : {}),
          },
          "offset",
          o.all,
        ),
      );
    if (action === "create") {
      if (o.body === undefined) fail("INPUT", "需要 --body-file/--body。");
      const d = (
        await r.request("open", "POST", "/api/v2/notes", { body: o.body })
      ).data;
      const id = d?.id || d?.note_id;
      if (!id) fail("RESPONSE", "创建小记未返回已知 ID。", { created: d });
      const after = (await r.request("open", "GET", "/api/v2/notes/" + enc(id)))
        .data;
      return r.result(after, "submitted");
    }
    const id = await noteId(r, target),
      path = "/api/v2/notes/" + enc(id);
    if (action === "get") {
      const n = await get(id);
      return r.result({
        ...n,
        sha256: hash(n.content),
        url: "https://www.yuque.com/r/note/" + n.slug,
      });
    }
    if (action === "update") {
      const old = await get(id),
        p = { ...(o.input || {}) };
      if (o.expectedSha256 && hash(old.content) !== o.expectedSha256)
        fail("CONFLICT", "小记已变化。");
      if (o.body !== undefined) {
        if (o.format && o.format !== "text")
          fail(
            "INPUT",
            "--body 仅用于纯文本小记；富格式请用 --input 的 source/html/abstract。",
          );
        const escaped = o.body
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;");
        p.source = "<p>" + escaped.replaceAll("\n", "</p><p>") + "</p>";
        p.html = '<div class="lake-content">' + p.source + "</div>";
        p.abstract = o.body;
      }
      if (o.status !== undefined) p.status = o.status;
      for (const k of ["source", "html", "abstract"]) p[k] ??= old.content?.[k];
      if (["source", "html", "abstract"].some((k) => typeof p[k] !== "string"))
        fail("INPUT", "需要 source/html/abstract。");
      const latest = await get(id);
      if (
        hash(latest.content) !== hash(old.content) ||
        latest.updated_at !== old.updated_at
      )
        fail("CONFLICT", "保存前小记已变化。");
      await r.request(
        via,
        "PUT",
        via === "web" ? root + "/update" : path,
        via === "web"
          ? {
              ...p,
              id: Number(id),
              save_type: "user",
              real_save_type: 4,
              sync_dynamic_data: false,
              has_image: o.body !== undefined ? false : old.has_image,
              has_attachment: o.body !== undefined ? false : old.has_attachment,
              has_bookmark: o.body !== undefined ? false : old.has_bookmark,
              word_count: o.body?.length ?? old.word_count,
            }
          : p,
      );
      const after = await r.poll(
        () => get(id),
        (x) =>
          equalFields(x.content || x, {
            source: p.source,
            abstract: p.abstract,
          }) &&
          (p.status === undefined || x.status === p.status),
      );
      return r.result(
        {
          id: after.id,
          url: "https://www.yuque.com/r/note/" + after.slug,
          sha256: hash(after.content),
        },
        "verified",
      );
    }
  }
  if (group === "group") {
    const path = `/api/v2/groups/${enc(target)}/users`;
    if (action === "members")
      return r.result(
        await r.pages(
          "open",
          path,
          { role: o.role, offset: o.offset },
          "offset",
          o.all,
        ),
      );
    if (!o.user) fail("INPUT", "需要 --user LOGIN/ID。");
    if (!o.yes) fail("CONFIRM", "成员权限操作需要 --yes。");
    if (action === "member-set") {
      if (![0, 1, 2].includes(o.role)) fail("INPUT", "role 必须是 0/1/2。");
      await r.request("open", "PUT", path + "/" + enc(o.user), {
        role: o.role,
      });
    } else if (action === "member-remove")
      await r.request("open", "DELETE", path + "/" + enc(o.user));
    else fail("COMMAND", "未知成员操作。");
    // 团队权限可能影响后续读取，不把已接受响应当作权限已生效。
    return r.result({ group: target, user: o.user, role: o.role }, "submitted");
  }
  if (group === "stats") {
    const path =
      `/api/v2/groups/${enc(target)}/statistics` +
      (action === "group" ? "" : "/" + action);
    return r.result(
      (
        await r.request(
          "open",
          "GET",
          query(path, { ...(o.input || {}), offset: o.offset, limit: o.limit }),
        )
      ).data,
    );
  }
  if (group === "resource") {
    const p = { ...(o.input || {}) };
    if (o.doc) {
      const d = await r.doc(o.doc, { book: o.book });
      p.doc_id = d.id;
    }
    if (target) p.src = target;
    if (action === "get") {
      p.resource_type = "board";
      return r.result(
        (await r.request("open", "GET", query("/api/v2/yfm/boards", p))).data,
      );
    }
    if (action === "create") {
      if (o.type) p.type = o.type;
      if (o.dsl !== undefined) p.dsl = o.dsl;
      if (o.after) p.insert_after_lake_id = o.after;
      if (
        !["mindmap", "flowchart", "architecturediagram"].includes(p.type) ||
        typeof p.dsl !== "string" ||
        !(p.doc_id || p.url)
      )
        fail("INPUT", "创建需要 doc、type 和 DSL 字符串。");
    } else {
      if (o.dsl !== undefined) {
        try {
          p.dsl = JSON.parse(o.dsl);
        } catch {
          fail("INPUT", "更新 DSL 需要 JSON 对象。");
        }
      }
      if (o.body !== undefined) p.text = o.body;
      if (!p.src || (p.dsl === undefined && p.text === undefined))
        fail("INPUT", "更新需要 src 与 DSL/text。");
    }
    const response = (
      await r.request(
        "open",
        action === "create" ? "POST" : "PUT",
        "/api/v2/yfm/boards",
        p,
      )
    ).data;
    return r.result(response, "submitted");
  }
  fail("COMMAND", "未知 Open API 业务操作。");
}
export async function noteId(r, target) {
  const parsed = parseTarget(target),
    id = parsed.id;
  if (/^\d+$/.test(id || "")) return id;
  if (parsed.type !== "note") fail("TARGET", "小记需数字 ID 或分享 URL。");
  // 公网当前列表接受 offset，spec 的 page 实测不会推进；链接解析找到即停。
  for (let offset = 0; offset < 2000; offset += 20) {
    const page = await r.pages(
      r.webContext ? "web" : "open",
      r.webContext
        ? "/api/modules/note/notes/NoteController/index"
        : "/api/v2/notes",
      { limit: 20, offset },
      "offset",
      false,
    );
    const found = page.items.filter((n) => n.slug === id || n.uuid === id);
    if (found.length === 1) return found[0].id;
    if (found.length > 1) fail("AMBIGUOUS", "小记链接匹配多项，请用数字 ID。");
    if (page.complete) break;
  }
  fail("NOT_FOUND", "无法在前 2000 项中解析小记链接；请提供数字 ID。");
}
