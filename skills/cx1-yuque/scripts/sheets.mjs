import { isDeepStrictEqual } from "node:util";
import { fail, downloadExport } from "./core.mjs";
import { hash, checkHash, one } from "./runtime.mjs";
import {
  blank,
  unpack,
  patch,
  markdownRows,
  markdownTable,
  rowChanges,
} from "./sheet.mjs";
async function save(r, d, previous, body) {
  const latest = await r.webDoc(d);
  if (
    previous &&
    (latest.draft_version !== previous.draft_version ||
      (latest.content || latest.body) !== (previous.content || previous.body))
  )
    fail("CONFLICT", "Sheet 保存前已变化。");
  if (!Number.isInteger(latest.draft_version))
    fail("RESPONSE", "缺少 draft_version。");
  await r.request("web", "PUT", `/api/docs/${d.id}/content`, {
    format: "lakesheet",
    body_asl: body,
    draft_version: latest.draft_version,
    sync_dynamic_data: false,
    created_by: "online",
    body_html: null,
    save_type: "user",
    edit_type: "Lake",
  });
  await r.request("web", "PUT", `/api/docs/${d.id}/publish`, {
    force: false,
    notify: false,
    ignoreGlobalMessage: true,
  });
  await r.poll(
    () => r.webDoc(d),
    (x) => isDeepStrictEqual(unpack(x.content || x.body), unpack(body)),
  );
}
function rowsInput(o) {
  if (o.rows) return o.rows;
  if (o.body !== undefined) return markdownRows(o.body);
  return o.input?.rows || [];
}
export async function sheetCommand(r, action, target, o) {
  if (action === "create") {
    if (!o.title) fail("INPUT", "需要 --title。");
    const body = blank(rowsInput(o)),
      book = await r.book(target);
    await r.preflightWeb();
    const d = (
      await r.request("web", "POST", `/api/docs?book_id=${book.id}`, {
        type: "Sheet",
        format: "lakesheet",
        title: o.title,
        insert_to_catalog: true,
      })
    ).data;
    if (!d?.id) fail("RESPONSE", "创建 Sheet 未返回 ID。");
    d.book_id = book.id;
    d.book = book;
    await save(r, d, null, body);
    return r.result({ id: d.id, url: r.url(d) }, "verified");
  }
  const d = await r.doc(target, { book: o.book });
  if (d.format !== "lakesheet") fail("FORMAT", "目标不是 Sheet。");
  if (action === "read") {
    const m = unpack(d.content || d.body),
      selected =
        o.sheet === undefined
          ? m.sheet.length === 1
            ? m.sheet[0]
            : null
          : one(m.sheet, String(o.sheet), { key: "index", kind: "子表" });
    if (!selected) fail("AMBIGUOUS", "请指定子表。");
    const data = selected.data || {},
      rowKeys = Object.keys(data).map(Number),
      width = Math.max(
        0,
        ...Object.values(data).flatMap((cs) =>
          Object.keys(cs).map((k) => Number(k) + 1),
        ),
      ),
      height = Math.max(0, ...rowKeys.map((k) => k + 1));
    if (height * width > 1000000)
      fail(
        "SHEET_SIZE",
        "展开读取超过 100 万单元格；使用 sheet inspect 稀疏结构。",
      );
    const rows = Array.from({ length: height }, (_, i) =>
      Array.from({ length: width }, (_, j) => data[i]?.[j]?.v ?? ""),
    );
    return r.result({
      id: d.id,
      url: r.url(d),
      name: selected.name,
      rows,
      markdown: markdownTable(rows),
    });
  }
  await r.preflightWeb();
  if (action === "export") {
    const type = o.type || "excel";
    if (!["excel", "lakesheet", "lake"].includes(type))
      fail("INPUT", "未知导出类型。");
    for (let i = 0; i < 30; i++) {
      const j = (
        await r.request(
          "web",
          "POST",
          `/api/docs/${d.id}/export`,
          { type },
          { read: true },
        )
      ).data;
      if (j?.state === "success" && j.url) {
        const file = o.download
          ? await downloadExport(await r.webClient(), j.url, o.download, type)
          : undefined;
        return r.result(
          { id: d.id, url: r.url(d), download_url: j.url, ...file },
          file ? "downloaded" : "ready",
        );
      }
      if (j?.state !== "pending") fail("EXPORT", "导出状态未知。");
      await new Promise((x) => setTimeout(x, 1000));
    }
    fail("EXPORT_PENDING", "30 次查询后仍未就绪。");
  }
  const web = d.content ? d : await r.webDoc(d),
    body = web.content || web.body,
    model = unpack(body);
  if (action === "inspect")
    return r.result({
      id: d.id,
      url: r.url(d),
      sha256: hash(body),
      workbook: model,
    });
  checkHash(body, o.expectedSha256);
  const selected =
    o.sheet === undefined
      ? model.sheet.length === 1
        ? model.sheet[0]
        : null
      : one(model.sheet, String(o.sheet), { key: "index", kind: "子表" });
  if (!selected) fail("AMBIGUOUS", "需要 --sheet 索引/名称。");
  const idx = model.sheet.indexOf(selected);
  let cells = o.cells || o.input?.cells;
  if (action === "append") {
    const rows = rowsInput(o);
    if (!rows.length)
      fail("INPUT", "追加需要 --rows-file 或 Markdown --body-file。");
    const occupied = Object.entries(selected.data || {}).filter(([, cs]) =>
      Object.values(cs).some((c) => c.v !== undefined && c.v !== ""),
    );
    const start = occupied.length
      ? Math.max(...occupied.map(([key]) => Number(key))) + 1
      : 0;
    cells = rowChanges(rows, start);
  } else if (!cells) cells = rowChanges(rowsInput(o));
  const next = patch(body, idx, cells);
  await save(r, d, web, next);
  return r.result(
    {
      id: d.id,
      url: r.url(d),
      sheet: selected.name,
      updatedCells: Object.keys(cells),
      sha256: hash(next),
    },
    "verified",
  );
}
