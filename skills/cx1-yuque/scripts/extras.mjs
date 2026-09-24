import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fail } from "./core.mjs";
import { query, checkHash, bodyOf } from "./runtime.mjs";
import { saveDoc } from "./documents.mjs";
import { prepare } from "./operations.mjs";
export async function extras(r, group, action, target, o) {
  if (group === "attachment") {
    if (!o.file) fail("INPUT", "需要 --file 本地文件。");
    const stat = fs.statSync(o.file);
    if (!stat.isFile() || stat.size > 100 * 1024 * 1024)
      fail("UPLOAD_SIZE", "只接受不超过 100 MiB 的普通文件。");
    const d = action === "add" ? await r.doc(target, { book: o.book }) : null;
    if (d) {
      if (d.format !== "lake")
        fail(
          "FORMAT",
          "附件嵌入需 Lake 文档，先显式转换并核验；不自动替换格式。",
        );
      checkHash(bodyOf(d), o.expectedSha256);
    }
    await r.preflightWeb();
    const form = new FormData();
    form.append(
      "file",
      new Blob([fs.readFileSync(o.file)]),
      path.basename(o.file),
    );
    const a = (await r.request("web", "POST", "/api/upload/attach", form)).data;
    if (!a?.url || !a.attachment_id)
      fail(
        "UPLOAD_RESPONSE",
        "上传响应缺少 URL/attachment_id；先检查远端，禁止自动重传。",
      );
    if (!d) return r.result(a, "submitted");
    const value = {
      id: randomUUID(),
      src: a.url,
      name: a.filename || path.basename(o.file),
      size: a.size ?? stat.size,
      ext: a.extname || path.extname(o.file).slice(1),
      status: "done",
      download: true,
      mode: "card",
      type: "block",
    };
    const card =
      '<card type="block" name="localdoc" value="' +
      encodeURIComponent(JSON.stringify(value)).replaceAll("'", "%27") +
      '"></card>';
    const next = await saveDoc(r, d, {
      format: "lake",
      body: bodyOf(d) + "\n" + card,
    });
    return r.result(
      {
        id: d.id,
        url: r.url(next),
        attachment_id: a.attachment_id,
        attachment_url: a.url,
        card,
      },
      "verified",
    );
  }
  if (group === "comment") {
    const d = await r.doc(target, { book: o.book });
    await r.preflightWeb();
    const args = {
      commentable_type: "Doc",
      commentable_id: d.id,
      ...(o.input || {}),
    };
    // 文档上下文不允许被 JSON 覆盖到另一个对象。
    args.commentable_id = d.id;
    args.commentable_type = "Doc";
    if (action === "list")
      return r.result(
        (
          await r.request(
            "web",
            "GET",
            query("/api/comments", {
              ...args,
              offset: o.offset,
              limit: o.limit,
            }),
          )
        ).data,
      );
    if (o.body === undefined) fail("INPUT", "评论需要 --body/--body-file。");
    const created = (
      await r.request("web", "POST", "/api/comments", {
        ...args,
        body: o.body,
        format: o.format || "markdown",
      })
    ).data;
    if (!created?.id) fail("RESPONSE", "评论未返回 ID；先查看评论列表。");
    await r.poll(
      async () =>
        (await r.request("web", "GET", query("/api/comments", args))).data,
      (rows) => Array.isArray(rows) && rows.some((x) => x.id === created.id),
    );
    return r.result({ id: created.id, url: r.url(d) }, "verified");
  }
  const name = group + "." + action;
  const known = [
    "user.books",
    "user.recent",
    "mark.list",
    "mark.tags",
    "note.tags",
    "note.tag-stats",
    "search.web",
  ];
  if (!known.includes(name)) fail("COMMAND", "未知补充操作。");
  await r.preflightWeb();
  const p = { ...(o.input || {}) };
  for (const k of ["offset", "limit", "type", "scope", "creator"])
    if (o[k] !== undefined) p[k] = o[k];
  if (name === "search.web") p.q = target;
  const req = prepare(name, p);
  const response = await r.request("web", req.method, req.path);
  return r.result(response.data ?? response);
}
