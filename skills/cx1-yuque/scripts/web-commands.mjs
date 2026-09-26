import { fail } from "./core.mjs";
import { enc, query, equalFields, parseTarget, hash } from "./runtime.mjs";
import { webProfile } from "./web-context.mjs";
import { resourceCommand } from "./resources.mjs";
const escapeText = (s) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
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
async function owner(r, value) {
  if (!value) return r.me();
  if (/^\d+$/.test(String(value))) return { id: Number(value) };
  const me = await r.me();
  if (value === me.login) return me;
  const d = await webProfile(r, value);
  if (!d?.id) fail("RESPONSE", "无法解析用户 ID。");
  return d;
}
async function groupInfo(r, value) {
  if (!value) fail("INPUT", "需要团队 login/ID。");
  const d = /^\d+$/.test(String(value))
    ? (await r.request("web", "GET", `/api/groups/${enc(value)}/detail`)).data
    : await webProfile(r, value);
  if (d?.type !== "Group") fail("INPUT", "目标不是团队。");
  if (!d?.id) fail("RESPONSE", "无法解析团队 ID。");
  return d;
}
export async function webCommand(r, group, action, target, o) {
  if (group === "auth" || group === "user") {
    if (action === "status" || action === "me") {
      const d = await r.me();
      return r.result(o.raw ? d : { id: d.id, login: d.login, name: d.name });
    }
    if (action === "groups") {
      const u = await owner(r, target);
      const rows = (await r.request("web", "GET", `/api/users/${u.id}/groups`))
        .data;
      return r.result(
        collection(
          rows,
          { ...o },
          (x) => o.role === undefined || x.group_user_role === o.role,
        ),
      );
    }
  }
  if (group === "ping") {
    await r.me();
    return r.result({ ok: true });
  }
  if (group === "search") {
    if (!target) fail("INPUT", "搜索需要关键词。");
    const scope = o.scope?.startsWith("https:")
      ? parseTarget(o.scope).book
      : o.scope;
    if (o.scope && !scope)
      fail("INPUT", "scope 需要 owner/book、团队 login 或 /。");
    let page = o.page || 1,
      items = [],
      seen = new Set();
    for (let i = 0; i < (o.all ? 100 : 1); i++, page++) {
      const d = (
        await r.request(
          "web",
          "GET",
          query("/api/zsearch", {
            q: target,
            type: o.type || "doc",
            scope: scope || "/",
            ...(!scope || scope === "/" ? { tab: "related" } : {}),
            p: page,
            sence: "modal",
            creator: o.creator,
          }),
        )
      ).data;
      if (!Array.isArray(d?.hits)) fail("RESPONSE", "搜索响应缺少 hits。");
      const signature = JSON.stringify(d.hits.map((x) => x.id));
      if (d.hits.length && seen.has(signature))
        fail("PAGINATION_STALLED", "搜索分页未推进。", { count: items.length });
      seen.add(signature);
      items.push(...d.hits);
      const total = Number(d.totalHits ?? d.total);
      const more =
        d.hits.length > 0 &&
        (Number.isFinite(total) ? page * 20 < total : d.hits.length === 20);
      if (!o.all || !more)
        return r.result(
          compact(
            { items, complete: !more, next: more ? { page: page + 1 } : null },
            ["id", "type", "title", "abstract", "url", "_record"],
            o.raw,
          ),
        );
    }
    fail("PAGINATION_LIMIT", "达到 100 页搜索上限。", { count: items.length });
  }
  if (group === "book") {
    if (action === "list") {
      const u = o.group ? await groupInfo(r, target) : await owner(r, target);
      const params = {
        ...(!o.group ? { user_id: u.id } : {}),
        type: o.type,
        filterByAbility: o.filterByAbility,
      };
      const page = o.group
        ? await r.pages(
            "web",
            `/api/groups/${u.id}/books`,
            { ...params, offset: o.offset, limit: o.limit },
            "offset",
            o.all,
          )
        : collection(await userBooks(r, u, params), o);
      for (const b of page.items) {
        b.namespace ??= b.user?.login
          ? `${b.user.login}/${b.slug}`
          : u.login
            ? `${u.login}/${b.slug}`
            : undefined;
        r.cache.set("webbook:" + b.id, b);
      }
      return r.result(
        compact(
          page,
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
      const u = o.group ? await groupInfo(r, target) : await owner(r, target);
      const p = { ...(o.input || {}) };
      for (const k of ["name", "slug", "description", "public"])
        if (o[k] !== undefined) p[k] = o[k];
      if (!p.name || !p.slug)
        fail("INPUT", "创建知识库需要 --name 和 --slug。");
      p.public ??= 0;
      p.type ??= "Book";
      p.user_id = u.id;
      const d = (await r.request("web", "POST", "/api/books", p)).data;
      if (!d?.id) fail("RESPONSE", "创建未返回 ID，先核对远端。");
      const login = u.login || d.user?.login;
      const ref = login ? `${login}/${d.slug || p.slug}` : String(d.id);
      const after = await r.poll(
        () => r.book(ref, { fresh: true }),
        (x) => equalFields(x, { name: p.name, slug: p.slug, public: p.public }),
      );
      return r.result(after, "verified");
    }
    const b = await r.book(target);
    if (action === "update") {
      const p = { ...(o.input || {}) };
      for (const k of ["name", "slug", "description", "public"])
        if (o[k] !== undefined) p[k] = o[k];
      if (!Object.keys(p).length) fail("INPUT", "没有更新字段。");
      await r.request("web", "PUT", `/api/books/${b.id}`, p);
      const ref =
        p.slug && b.namespace
          ? b.namespace.split("/")[0] + "/" + p.slug
          : target;
      return r.result(
        await r.poll(
          () => r.book(ref, { fresh: true }),
          (x) => equalFields(x, p),
        ),
        "verified",
      );
    }
    if (action === "delete") {
      if (!o.yes) fail("CONFIRM", "删除知识库需要 --yes。");
      await r.request("web", "DELETE", `/api/books/${b.id}`);
      await r.poll(async () => {
        try {
          await r.book(b.namespace || target, { fresh: true });
          return false;
        } catch (e) {
          if (e.details?.httpStatus === 404 || e.code === "BOOK_NOT_FOUND")
            return true;
          throw e;
        }
      }, Boolean);
      return r.result({ id: b.id, deleted: true }, "verified");
    }
  }
  if (group === "doc" && action === "list") {
    const b = await r.book(target);
    return r.result(
      compact(
        await r.pages(
          "web",
          `/api/books/${b.id}/docs`,
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
  }
  if (group === "group") {
    const g = await groupInfo(r, target),
      path = `/api/groups/${g.id}/users`;
    if (action === "members")
      return r.result(
        await r.pages(
          "web",
          path,
          { role: o.role, offset: o.offset },
          "offset",
          o.all,
        ),
      );
    if (!o.user || !o.yes) fail("INPUT", "成员操作需要 --user 与 --yes。");
    const page = await r.pages("web", path, {}, "offset", true);
    const matches = page.items.filter(
      (x) =>
        String(x.user_id || x.user?.id) === String(o.user) ||
        x.user?.login === o.user,
    );
    if (matches.length > 1) fail("AMBIGUOUS", "团队成员未唯一匹配。");
    let member = matches[0];
    if (!member && action === "member-set") {
      if (![0, 1, 2].includes(o.role)) fail("INPUT", "role 必须是 0/1/2。");
      const user = await owner(r, o.user);
      const created = (
        await r.request("web", "POST", "/api/group_users", {
          group_id: g.id,
          user_id: user.id,
          login: user.login,
          name: user.name,
        })
      ).data;
      if (!created?.id)
        fail("RESPONSE", "新增/邀请未返回成员 ID；先核对成员列表。");
      member = created;
    }
    if (!member) fail("NOT_FOUND", "团队成员不存在。");
    if (action === "member-set") {
      if (![0, 1, 2].includes(o.role)) fail("INPUT", "role 必须是 0/1/2。");
      await r.request("web", "PUT", `/api/group_users/${member.id}`, {
        role: o.role,
      });
    } else if (action === "member-remove")
      await r.request("web", "DELETE", `/api/group_users/${member.id}`);
    else fail("COMMAND", "未知成员操作。");
    return r.result({ group: g.id, user: o.user, role: o.role }, "submitted");
  }
  if (group === "stats") {
    const g = await groupInfo(r, target);
    return r.result(
      (
        await r.request(
          "web",
          "GET",
          query(
            `/api/groups/${g.id}/statistics` +
              (action === "group" ? "" : "/" + action),
            { ...(o.input || {}), offset: o.offset, limit: o.limit },
          ),
        )
      ).data,
    );
  }
  if (group === "resource") return resourceCommand(r, action, target, o);
  if (group === "note") {
    const via = "web",
      root = "/api/modules/note/notes/NoteController";
    await r.preflightWeb();
    const get = async (id) => {
      const j = await r.request(
        via,
        "GET",
        query(root + "/show", { id, merge_dynamic_data: 0 }),
      );
      return j.data ?? j;
    };

    if (action === "list")
      return r.result(
        await r.pages(
          via,
          root + "/index",
          {
            status: o.status,
            offset: o.offset ?? ((o.page || 1) - 1) * (o.limit || 20),
            limit: o.limit || 20,
            q: o.q,
            filter_type: o.filterType,
            order: o.order,
          },
          "offset",
          o.all,
        ),
      );
    if (action === "create") {
      if (o.body === undefined) fail("INPUT", "需要 --body-file/--body。");
      const source =
        "<p>" + escapeText(o.body).replaceAll("\n", "</p><p>") + "</p>";
      const created = await r.request("web", "POST", root + "/create", {
        source,
        html: '<div class="lake-content">' + source + "</div>",
        abstract: o.body,
        status: 0,
        save_type: "user",
        real_save_type: 4,
        sync_dynamic_data: false,
        has_image: false,
        has_attachment: false,
        has_bookmark: false,
        word_count: o.body.length,
      });
      const d = created.data ?? created;
      const id = d?.id || d?.note_id;
      if (!id) fail("RESPONSE", "创建小记未返回 ID，先核对远端。");
      const after = await r.poll(
        () => get(id),
        (x) => x.content?.source === source,
      );
      return r.result(
        { id, url: "https://www.yuque.com/r/note/" + after.slug },
        "verified",
      );
    }
    const id = await noteId(r, target);
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
      await r.request(via, "PUT", root + "/update", {
        ...p,
        id: Number(id),
        save_type: "user",
        real_save_type: 4,
        sync_dynamic_data: false,
        has_image: o.body !== undefined ? false : old.has_image,
        has_attachment: o.body !== undefined ? false : old.has_attachment,
        has_bookmark: o.body !== undefined ? false : old.has_bookmark,
        word_count: o.body?.length ?? old.word_count,
      });
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
  fail("COMMAND", "未知 Web API 业务操作。");
}
export async function noteId(r, target) {
  const parsed = parseTarget(target),
    id = parsed.id;
  if (/^\d+$/.test(id || "")) return id;
  if (parsed.type !== "note") fail("TARGET", "小记需数字 ID 或分享 URL。");
  // 公网当前列表接受 offset，spec 的 page 实测不会推进；链接解析找到即停。
  for (let offset = 0; offset < 2000; offset += 20) {
    const page = await r.pages(
      "web",
      "/api/modules/note/notes/NoteController/index",
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

// 此接口一次返回全量，offset/limit 被服务端忽略；由 CLI 在本地分页。
function collection(rows, o = {}, predicate = () => true) {
  if (!Array.isArray(rows)) fail("RESPONSE", "集合响应不是数组。");
  rows = rows.filter(predicate);
  const offset = o.offset || 0,
    end = o.all ? rows.length : offset + (o.limit || 100);
  return {
    items: rows.slice(offset, end),
    complete: end >= rows.length,
    next: end < rows.length ? { offset: end } : null,
    total: rows.length,
  };
}

async function userBooks(r, user, params) {
  const account = await r.me();
  const own = (await r.request("web", "GET", query("/api/books", params))).data;
  if (!Array.isArray(own)) fail("RESPONSE", "知识库列表结构已变化。");
  let rows = own;
  if (String(user.id) !== String(account.id)) {
    const invited = (
      await r.request("web", "GET", "/api/mine/collaborate_books")
    ).data;
    if (!Array.isArray(invited)) fail("RESPONSE", "协作库列表结构已变化。");
    rows = [...rows, ...invited];
    const layout = (
      await r.request(
        "web",
        "GET",
        query(`/api/groups/${user.id}/homepage_public`, { scene: 1 }),
      )
    ).data;
    if (!Array.isArray(layout)) fail("RESPONSE", "公开主页布局结构已变化。");
    const blocks = layout
      .flatMap((c) => (c.placements || []).flatMap((p) => p.blocks || []))
      .filter((b) => b.type === "publicPageBookStack");
    for (const block of blocks) {
      const books = (
        await r.request(
          "web",
          "GET",
          query("/api/book_stack_maps", { id: block.id }),
        )
      ).data;
      if (!Array.isArray(books)) fail("RESPONSE", "公开书架结构已变化。");
      rows.push(...books);
    }
  }
  // books 接口忽略 user_id 且混入团队库；所有来源都按归属过滤后去重。
  return [
    ...new Map(
      rows
        .filter((b) => String(b.user_id) === String(user.id))
        .map((b) => [b.id, b]),
    ).values(),
  ];
}
