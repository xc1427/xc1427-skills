import { fail, ORIGIN } from "./core.mjs";
import {
  enc,
  query,
  bookPath,
  hash,
  bodyOf,
  equalFields,
  checkHash,
} from "./runtime.mjs";
export const tocId = (n) => Number(n.doc_id ?? n.id);
export async function toc(r, ref) {
  const j = r.webContext
    ? await r.request(
        "web",
        "GET",
        query("/api/catalog_nodes", { book_id: (await r.book(ref)).id }),
      )
    : await r.request("open", "GET", bookPath(ref) + "/toc");
  if (!Array.isArray(j.data)) fail("RESPONSE", "目录响应不是数组。");
  return j.data;
}
export function subtree(nodes, root) {
  const ids = new Set([root]);
  let count;
  do {
    count = ids.size;
    for (const n of nodes) if (ids.has(n.parent_uuid)) ids.add(n.uuid);
  } while (count !== ids.size);
  return nodes.filter((n) => ids.has(n.uuid));
}
export function positioned(nodes, id, target, position = "appendChild") {
  const n = nodes.find((x) => x.uuid === id),
    t = nodes.find((x) => x.uuid === target);
  if (!n || (target && !t)) return false;
  const parent = ["appendChild", "prependChild"].includes(position)
    ? target || ""
    : t?.parent_uuid || "";
  if ((n.parent_uuid || "") !== parent) return false;
  const siblings = nodes.filter((x) => (x.parent_uuid || "") === parent),
    i = siblings.findIndex((x) => x.uuid === id),
    j = siblings.findIndex((x) => x.uuid === target);
  return position === "appendChild"
    ? i === siblings.length - 1
    : position === "prependChild"
      ? i === 0
      : position === "moveBefore"
        ? i === j - 1
        : i === j + 1;
}
export function positionedMany(nodes, ids, target, position = "appendChild") {
  const t = nodes.find((n) => n.uuid === target);
  if (target && !t) return false;
  const parent = ["appendChild", "prependChild"].includes(position)
    ? target || ""
    : t?.parent_uuid || "";
  const siblings = nodes.filter((n) => (n.parent_uuid || "") === parent),
    start = siblings.findIndex((n) => n.uuid === ids[0]);
  if (start < 0 || !ids.every((id, i) => siblings[start + i]?.uuid === id))
    return false;
  const j = siblings.findIndex((n) => n.uuid === target);
  return position === "appendChild"
    ? start + ids.length === siblings.length
    : position === "prependChild"
      ? start === 0
      : position === "moveBefore"
        ? start + ids.length === j
        : start === j + 1;
}
export function sameTree(source, copy) {
  if (source.length !== copy.length) return false;
  return source.every(
    (n, i) =>
      n.type === copy[i].type &&
      n.title === copy[i].title &&
      (i === 0 ||
        source.findIndex((x) => x.uuid === n.parent_uuid) ===
          copy.findIndex((x) => x.uuid === copy[i].parent_uuid)),
  );
}
export async function attach(
  r,
  book,
  ids,
  { target, position = "appendChild" } = {},
) {
  const locations = {
    appendChild: ["appendNode", "child"],
    prependChild: ["prependNode", "child"],
    moveBefore: ["prependNode", "sibling"],
    moveAfter: ["appendNode", "sibling"],
  };
  if (["moveBefore", "moveAfter"].includes(position) && !target)
    fail("INPUT", "同级定位需 target UUID。");
  if (!locations[position]) fail("INPUT", "无效目录位置。");
  const [action, action_mode] = locations[position];
  if (r.webContext)
    await r.request("web", "POST", "/api/docs/add_to_catalog", {
      book_id: Number(book),
      ids,
      action: position,
      ...(target ? { target_node_uuid: target } : {}),
    });
  else
    await r.request("open", "PUT", bookPath(String(book)) + "/toc", {
      action,
      action_mode,
      type: "DOC",
      doc_ids: ids,
      ...(target ? { target_uuid: target } : {}),
    });
  return r.poll(
    () => toc(r, String(book)),
    (rows) =>
      ids.every((id) => rows.some((n) => tocId(n) === Number(id))) &&
      (ids.length !== 1 ||
        positioned(
          rows,
          rows.find((n) => tocId(n) === Number(ids[0]))?.uuid,
          target,
          position,
        )),
    "创建已完成，但目录挂载未确认。",
  );
}
function sameBody(d, payload) {
  const value = payload.format === "lake" ? d.body_lake : d.body;
  if (payload.format === "html") return false;
  return (
    typeof value === "string" &&
    value.replace(/\r\n/g, "\n").trimEnd() ===
      payload.body.replace(/\r\n/g, "\n").trimEnd()
  );
}
export async function saveDoc(r, d, payload) {
  const now = await r.doc(String(d.id), { fresh: true });
  if (now.updated_at !== d.updated_at || hash(bodyOf(now)) !== hash(bodyOf(d)))
    fail("CONFLICT", "保存前文档已发生变化。");
  await r.request(
    "open",
    "PUT",
    bookPath(String(d.book_id)) + "/docs/" + d.id,
    payload,
  );
  const { body, format, ...fields } = payload;
  return r.poll(
    () => r.doc(String(d.id), { fresh: true }),
    (x) =>
      equalFields(x, fields) &&
      (body === undefined || format === "html" || sameBody(x, payload)),
    "文档已提交，但正文/属性回读不一致。",
  );
}
export async function document(r, action, target, o) {
  if (o.format && !["lake", "html", "markdown"].includes(o.format))
    fail("FORMAT", "文档 format 仅支持 lake/html/markdown。");
  if (action === "create") {
    if (!o.title || o.body === undefined)
      fail("INPUT", "创建需要 --title 和 --body-file/--body。");
    const b = await r.book(target),
      payload = {
        title: o.title,
        body: o.body,
        format: o.format || "markdown",
        public: o.public ?? 0,
        ...(o.slug ? { slug: o.slug } : {}),
      };
    const j = await r.request(
        "open",
        "POST",
        bookPath(String(b.id)) + "/docs",
        payload,
      ),
      id = j.data?.id;
    if (!id) fail("RESPONSE", "创建响应缺少文档 ID，先查询远端状态。");
    const d = await r.poll(
      () => r.doc(String(id), { fresh: true }),
      (x) =>
        x.title === o.title &&
        (payload.format === "html" || sameBody(x, payload)),
    );
    if (o.attach !== false) await attach(r, b.id, [id], o);
    return r.result(
      { id, url: r.url(d), attached: o.attach !== false },
      payload.format === "html" ? "submitted" : "verified",
    );
  }
  if (action === "version")
    return r.result(
      (await r.request("open", "GET", "/api/v2/doc_versions/" + enc(target)))
        .data,
    );
  const d = await r.doc(target, {
    book: o.book,
    page: o.page,
    page_size: o.pageSize,
  });
  if (action === "inspect")
    return r.result({
      id: d.id,
      book_id: d.book_id,
      title: d.title,
      format: d.format,
      sha256: hash(bodyOf(d)),
      updated_at: d.updated_at,
      url: r.url(d),
      ...(o.raw ? { document: d } : {}),
    });
  if (action === "read") {
    const body =
      o.format === "lake"
        ? d.body_lake
        : o.format === "html"
          ? d.body_html
          : d.body;
    return r.result({
      id: d.id,
      title: d.title,
      url: r.url(d),
      format: o.format || "markdown",
      body: body ?? "",
      sha256: hash(bodyOf(d)),
      ...(d.body_sheet ? { body_sheet: d.body_sheet } : {}),
      ...(d.body_table ? { body_table: d.body_table } : {}),
    });
  }
  if (action === "versions")
    return r.result(
      (
        await r.request(
          "open",
          "GET",
          query("/api/v2/doc_versions", { doc_id: d.id }),
        )
      ).data,
    );
  if (action === "patch") {
    if (!["lake", "markdown"].includes(d.format))
      fail("FORMAT", "patch 只编辑 Lake/Markdown 文档。");
    const edits = o.input?.edits;
    if (!Array.isArray(edits) || !edits.length)
      fail("INPUT", "input 需要 edits: [{find,replace}]。");
    checkHash(bodyOf(d), o.expectedSha256);
    let body = d.format === "lake" ? d.body_lake : d.body;
    for (const edit of edits) {
      if (
        typeof edit.find !== "string" ||
        !edit.find ||
        typeof edit.replace !== "string"
      )
        fail("INPUT", "find 必须为非空字符串，replace 必须为字符串。");
      if (body.split(edit.find).length !== 2)
        fail("AMBIGUOUS", "精确片段必须只匹配一次；请扩大上下文。");
      body = body.replace(edit.find, () => edit.replace);
    }
    const after = await saveDoc(r, d, { format: d.format, body });
    return r.result(
      { id: d.id, url: r.url(after), sha256: hash(bodyOf(after)) },
      "verified",
    );
  }
  if (action === "update" || action === "append") {
    if (!["lake", "markdown", "html"].includes(d.format))
      fail("FORMAT", "此对象是特殊文档；请使用对应的 sheet/table 命令保存。");
    checkHash(bodyOf(d), o.expectedSha256);
    const payload = {};
    for (const k of ["title", "slug", "public"])
      if (o[k] !== undefined) payload[k] = o[k];
    if (o.body !== undefined) {
      if (!o.format)
        fail("INPUT", "正文写入需显式 --format markdown/html/lake。");
      if (action === "append" && o.format !== d.format)
        fail("FORMAT", "追加内容必须与现有格式一致。");
      payload.format = o.format;
      payload.body =
        action === "append"
          ? (d.format === "markdown"
              ? d.body
              : d.format === "html"
                ? d.body_html
                : bodyOf(d)) +
            "\n" +
            o.body
          : o.body;
      if (d.format === "lake" && o.format !== "lake" && !o.replaceFormat)
        fail("FORMAT", "目标为 Lake；改格式需显式 --replace-format。");
    }
    if (!Object.keys(payload).length) fail("INPUT", "没有指定修改字段。");
    const next = await saveDoc(r, d, payload);
    return r.result(
      { id: d.id, url: r.url(next), changed: Object.keys(payload) },
      payload.format === "html" ? "submitted" : "verified",
    );
  }
  if (action === "delete") {
    if (!o.yes) fail("CONFIRM", "删除需要 --yes。");
    await r.request(
      "open",
      "DELETE",
      bookPath(String(d.book_id)) + "/docs/" + d.id,
    );
    await r.poll(async () => {
      try {
        await r.doc(String(d.id), { fresh: true });
        return false;
      } catch (e) {
        if (e.details?.httpStatus === 404) return true;
        throw e;
      }
    }, Boolean);
    return r.result({ id: d.id, url: r.url(d), deleted: true }, "verified");
  }
  if (action === "publish") {
    await r.preflightWeb();
    const draft = await r.webDoc(d);
    await r.request("web", "PUT", `/api/docs/${d.id}/publish`, {
      force: o.force ?? false,
      notify: o.notify ?? false,
      ignoreGlobalMessage: true,
    });
    const after = await r.poll(
      () => r.webDoc(d),
      (x) =>
        x.status === 1 &&
        (x.content || x.body) === (draft.content || draft.body),
    );
    return r.result(
      { id: d.id, url: r.url(d), status: after.status },
      "verified",
    );
  }
  if (["copy", "move"].includes(action)) {
    if (!o.to) fail("INPUT", "迁移需要 --to 知识库URL。");
    await r.preflightWeb();
    const b = await r.book(o.to),
      source = await toc(r, String(d.book_id));
    const nodes = source.filter((n) => tocId(n) === Number(d.id));
    if (nodes.length !== 1)
      fail(
        "CATALOG_NODE",
        "文档没有唯一目录节点；请先挂载，或使用 toc copy/transfer 指定节点。",
      );
    return transfer(
      r,
      action,
      d.book_id,
      b.id,
      nodes[0].uuid,
      { ...o, withChildren: false },
      d,
    );
  }
  fail("COMMAND", "未知文档操作。");
}
export async function transfer(r, action, source, target, node, o = {}, doc) {
  await r.preflightWeb();
  if (
    !["appendChild", "prependChild", "moveBefore", "moveAfter"].includes(
      o.position || "appendChild",
    )
  )
    fail("INPUT", "无效位置。");
  if (["moveBefore", "moveAfter"].includes(o.position) && !o.target)
    fail("INPUT", "同级定位必须有 --target UUID。");
  const before = await toc(r, String(target)),
    sourceBefore = source === target ? before : await toc(r, String(source)),
    sourceNodes =
      o.withChildren === false
        ? sourceBefore.filter((n) => n.uuid === node)
        : subtree(sourceBefore, node);
  if (!sourceNodes.length) fail("NOT_FOUND", "源节点不存在。");
  await r.request("web", "PUT", `/api/catalog_nodes/${action}`, {
    book_id: source,
    target_book_id: target,
    node_uuid: node,
    action: o.position || "appendChild",
    with_children: o.withChildren ?? true,
    insert_to_catalog: true,
    ...(o.target ? { target_uuid: o.target } : {}),
  });
  const after = await r.poll(
    () => toc(r, String(target)),
    (rows) => {
      if (action === "move")
        return (
          sourceNodes.every((n) =>
            rows.some(
              (x) =>
                x.uuid === n.uuid &&
                (n.uuid === node || x.parent_uuid === n.parent_uuid),
            ),
          ) && positioned(rows, node, o.target, o.position)
        );
      const added = rows.filter((n) => !before.some((b) => b.uuid === n.uuid));
      return (
        sameTree(sourceNodes, added) &&
        added.some(
          (n) =>
            n.title === sourceNodes[0].title &&
            positioned(rows, n.uuid, o.target, o.position),
        )
      );
    },
  );
  if (action === "move" && source !== target)
    await r.poll(
      () => toc(r, String(source)),
      (rows) => !rows.some((n) => sourceNodes.some((x) => x.uuid === n.uuid)),
    );
  const added =
    action === "copy"
      ? after.filter((n) => !before.some((b) => b.uuid === n.uuid))
      : after.filter((n) => sourceNodes.some((x) => x.uuid === n.uuid));
  if (doc && action === "copy") {
    const candidates = added.filter((n) => n.title === doc.title && tocId(n));
    if (candidates.length !== 1)
      fail("VERIFY_MISMATCH", "复制已执行，但无法唯一确认新文档。", {
        nodes: added.map((n) => n.uuid),
      });
    const copy = await r.doc(String(tocId(candidates[0])), {
      book: String(target),
      fresh: true,
    });
    if (hash(bodyOf(copy)) !== hash(bodyOf(doc)))
      fail("VERIFY_MISMATCH", "副本正文与源文档不一致。", {
        id: copy.id,
        url: r.url(copy),
      });
  }
  return r.result(
    {
      source_book_id: source,
      target_book_id: target,
      nodes: added.map((n) => ({
        uuid: n.uuid,
        id: tocId(n) || undefined,
        title: n.title,
        url: tocId(n) ? `${ORIGIN}/go/doc/${tocId(n)}` : undefined,
      })),
      ...(doc && action === "move"
        ? { url: `${ORIGIN}/go/doc/${doc.id}` }
        : {}),
    },
    "verified",
  );
}
export async function catalog(r, action, target, o) {
  const b = await r.book(target),
    path = bookPath(String(b.id)) + "/toc";
  if (action === "list" || action === "tree") {
    const nodes = await toc(r, String(b.id));
    if (action === "list") return r.result(nodes);
    const map = new Map(nodes.map((n) => [n.uuid, { ...n, children: [] }])),
      roots = [];
    for (const n of nodes) {
      const parent = map.get(n.parent_uuid);
      if (parent && n.parent_uuid !== n.uuid)
        parent.children.push(map.get(n.uuid));
      else roots.push(map.get(n.uuid));
    }
    return r.result(roots);
  }
  if (action === "attach") {
    if (!o.doc) fail("INPUT", "需要 --doc 文档URL/ID。");
    const d = await r.doc(o.doc, { book: String(b.id) });
    if (Number(d.book_id) !== Number(b.id))
      fail("BOOK", "文档不属于此库；使用 doc move/copy。");
    await attach(r, b.id, [d.id], o);
    return r.result({ id: d.id, url: r.url(d) }, "verified");
  }
  const before = await toc(r, String(b.id));
  if (["copy", "transfer"].includes(action)) {
    if (!o.node || !o.to) fail("INPUT", "需要 --node UUID 和 --to 目标库。");
    if (!before.some((n) => n.uuid === o.node))
      fail("NOT_FOUND", "源节点不存在。");
    const dest = await r.book(o.to);
    return transfer(
      r,
      action === "copy" ? "copy" : "move",
      b.id,
      dest.id,
      o.node,
      o,
    );
  }
  if (action === "batch") {
    await r.preflightWeb();
    const p = o.input || {};
    if (
      !Array.isArray(p.node_uuids) ||
      !p.node_uuids.length ||
      p.node_uuids.some((id) => !before.some((n) => n.uuid === id))
    )
      fail("INPUT", "input 需包含有效 node_uuids。");
    if (
      !["batchRemove", "batchDestroy", "batchMove", "batchCopy"].includes(
        p.batch_action,
      )
    )
      fail("INPUT", "无效批量操作。");
    if (p.batch_action === "batchDestroy" && !o.yes)
      fail("CONFIRM", "删除到回收站需要 --yes。");
    const moving = ["batchMove", "batchCopy"].includes(p.batch_action);
    let destination, destBefore;
    if (moving) {
      destination = await r.book(String(p.target_book_id || ""));

      if (
        !["appendChild", "prependChild", "moveBefore", "moveAfter"].includes(
          p.transfer_action,
        )
      )
        fail("INPUT", "迁移需要 transfer_action。");
      if (
        ["moveBefore", "moveAfter"].includes(p.transfer_action) &&
        !p.target_uuid
      )
        fail("INPUT", "同级迁移需要 target_uuid。");
      destBefore = await toc(r, String(destination.id));
    }
    const payload = {
      ...p,
      book_id: b.id,
      ...(moving
        ? { target_book_id: destination.id, insert_to_catalog: true }
        : {}),
    };
    await r.request("web", "PUT", "/api/catalog_nodes/batch", payload);
    const affected = [
      ...new Set(
        p.node_uuids.flatMap((id) => subtree(before, id).map((n) => n.uuid)),
      ),
    ];
    if (p.batch_action !== "batchCopy" && (!moving || b.id !== destination.id))
      await r.poll(
        () => toc(r, String(b.id)),
        (ns) => affected.every((id) => !ns.some((n) => n.uuid === id)),
      );
    let result = [];
    if (moving) {
      const ns = await r.poll(
        () => toc(r, String(destination.id)),
        (nodes) => {
          const added = nodes.filter(
            (n) => !destBefore.some((x) => x.uuid === n.uuid),
          );
          const roots =
            p.batch_action === "batchMove"
              ? p.node_uuids
              : added
                  .filter((n) => !added.some((x) => x.uuid === n.parent_uuid))
                  .map((n) => n.uuid);
          return (
            (p.batch_action === "batchMove"
              ? affected.every((id) => nodes.some((n) => n.uuid === id))
              : added.length === affected.length) &&
            roots.length === p.node_uuids.length &&
            positionedMany(nodes, roots, p.target_uuid, p.transfer_action)
          );
        },
      );
      result =
        p.batch_action === "batchMove"
          ? ns.filter((n) => affected.includes(n.uuid))
          : ns.filter((n) => !destBefore.some((x) => x.uuid === n.uuid));
    }
    return r.result(
      {
        nodes: result,
        source_nodes: p.node_uuids,
        target_book_id: destination?.id,
      },
      "verified",
    );
  }
  let payload;
  if (action === "add") {
    if (!o.title) fail("INPUT", "创建目录节点需要 --title。");
    payload = {
      action: "appendNode",
      action_mode: o.target ? "child" : "sibling",
      type: o.url ? "LINK" : "TITLE",
      title: o.title,
      ...(o.url ? { url: o.url, open_window: o.openWindow ?? 0 } : {}),
      ...(o.target ? { target_uuid: o.target } : {}),
    };
  } else {
    if (!o.node || !before.some((n) => n.uuid === o.node))
      fail("INPUT", "需要有效 --node UUID。");
    if (action === "edit")
      payload = {
        action: "editNode",
        action_mode: "sibling",
        node_uuid: o.node,
        ...(o.title ? { title: o.title } : {}),
        ...(o.url ? { url: o.url } : {}),
        ...(o.openWindow !== undefined ? { open_window: o.openWindow } : {}),
        ...(o.visible !== undefined ? { visible: o.visible } : {}),
      };
    else if (action === "destroy") {
      if (!o.yes) fail("CONFIRM", "删除节点/文档需要 --yes。");
      payload = {
        action: o.withChildren ? "destroyWithChildren" : "destroy",
        node_uuid: o.node,
      };
    } else if (action === "remove")
      payload = {
        action: "removeNode",
        action_mode: o.withChildren ? "child" : "sibling",
        node_uuid: o.node,
      };
    else if (action === "move") {
      if (!o.target || !before.some((n) => n.uuid === o.target))
        fail("INPUT", "移动需要有效 --target UUID。");
      const p = {
        appendChild: ["appendNode", "child"],
        prependChild: ["prependNode", "child"],
        moveBefore: ["prependNode", "sibling"],
        moveAfter: ["appendNode", "sibling"],
      }[o.position || "appendChild"];
      if (!p) fail("INPUT", "无效目录位置。");
      payload = {
        action: p[0],
        action_mode: p[1],
        node_uuid: o.node,
        target_uuid: o.target,
      };
    } else fail("COMMAND", "未知目录操作。");
  }
  if (r.webContext) {
    let webAction =
      action === "add"
        ? "insert"
        : action === "move"
          ? o.position || "appendChild"
          : action === "remove"
            ? o.withChildren
              ? "removeWithChildren"
              : "remove"
            : action === "edit"
              ? "edit"
              : payload.action;
    const { action: unused, action_mode, ...fields } = payload;
    await r.request("web", "PUT", "/api/catalog_nodes", {
      ...fields,
      book_id: b.id,
      format: "list",
      action: webAction,
    });
  } else await r.request("open", "PUT", path, payload);
  const ns = await r.poll(
    () => toc(r, String(b.id)),
    (rows) => {
      const n = rows.find((x) => x.uuid === o.node);
      if (action === "add")
        return rows.some(
          (x) => x.title === o.title && !before.some((a) => a.uuid === x.uuid),
        );
      if (action === "remove" || action === "destroy")
        return (
          !n &&
          (o.withChildren
            ? subtree(before, o.node).every(
                (a) => !rows.some((x) => x.uuid === a.uuid),
              )
            : subtree(before, o.node)
                .filter((a) => a.uuid !== o.node)
                .every((a) => rows.some((x) => x.uuid === a.uuid)))
        );
      if (action === "edit")
        return (
          n &&
          (!o.title || n.title === o.title) &&
          (!o.url || n.url === o.url) &&
          (o.openWindow === undefined || n.open_window === o.openWindow) &&
          (o.visible === undefined || n.visible === o.visible)
        );
      if (action === "move")
        return positioned(rows, o.node, o.target, o.position);
    },
  );
  return r.result(
    {
      book_id: b.id,
      nodes:
        action === "add"
          ? ns.filter((x) => !before.some((a) => a.uuid === x.uuid))
          : ns.filter((x) => x.uuid === o.node),
    },
    "verified",
  );
}
