import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { fail } from "./core.mjs";
import { one, query, equalFields, containsFields } from "./runtime.mjs";
const base = "/api/modules/table/doc/";
export const viewType = (type) => (type === "GALLERY" ? "CARD" : type);
function merge(base, patch) {
  const out = structuredClone(base);
  for (const [k, v] of Object.entries(patch || {})) {
    if (["__proto__", "constructor", "prototype"].includes(k))
      fail("INPUT", "配置键无效。");
    out[k] =
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      out[k] &&
      typeof out[k] === "object" &&
      !Array.isArray(out[k])
        ? merge(out[k], v)
        : v;
  }
  return out;
}
export const uid = () => randomUUID().replaceAll("-", "");
async function model(r, d) {
  const w = await r.webDoc(d);
  if (w.format !== "laketable")
    fail("FORMAT", "目标不是独立数据表；嵌入表需提供对应数据表文档。");
  const m = JSON.parse(w.content || w.body);
  if (!Array.isArray(m.sheet)) fail("RESPONSE", "未知数据表模型。");
  return m;
}
export async function tableContext(r, d, o) {
  const m = d.content ? JSON.parse(d.content) : await model(r, d),
    s = o.sheet
      ? one(m.sheet, String(o.sheet), { kind: "数据表子表" })
      : m.sheet.length === 1
        ? m.sheet[0]
        : null;
  if (!s)
    fail("AMBIGUOUS", "请指定 --sheet ID/名称。", {
      candidates: m.sheet.map((s) => ({ id: s.id, name: s.name })),
    });
  const views = Object.values(s.views || {}),
    v = o.view
      ? one(views, o.view, { kind: "视图" })
      : views.find((v) => v.id === (s.activeView || s.defaultView)) ||
        (views.length === 1 ? views[0] : null);
  if (!v && !o.withoutView)
    fail("AMBIGUOUS", "请指定 --view ID/名称。", {
      candidates: views.map((v) => ({ id: v.id, name: v.name })),
    });
  return {
    sheet: s,
    view: v,
    payload: {
      docId: d.id,
      docType: "Doc",
      sheetId: s.id,
      viewId: v?.id,
      type: v?.type,
    },
  };
}
async function records(r, c) {
  const p = await r.pages(
    "web",
    base + "TableRecordController/show",
    { docId: c.payload.docId, docType: "Doc", sheetId: c.sheet.id, limit: 500 },
    "offset",
    true,
  );
  return p.items.map((x) => ({
    ...x,
    data: typeof x.data === "string" ? JSON.parse(x.data) : x.data,
  }));
}
function values(c, input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    fail("INPUT", "需要 --values-file {字段名或ID:值}。");
  return Object.entries(input).map(([key, value]) => {
    const f = one(c.sheet.columns, key, { kind: "字段" });
    // 单选和多选接受已有选项名称，其他结构化值原样传入，避免猜测类型转换。
    if (f.type === "select" && typeof value === "string")
      value = one(f.options || [], value, { name: "value", kind: "选项" }).id;
    if (f.type === "multiSelect" && Array.isArray(value))
      value = value.map(
        (v) => one(f.options || [], v, { name: "value", kind: "选项" }).id,
      );
    return {
      fieldId: f.id,
      data:
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        "value" in value
          ? value
          : { value },
    };
  });
}
export async function tableCommand(r, action, target, o) {
  const d = await r.doc(target, {
    book: o.book,
    page: o.page,
    page_size: o.pageSize,
  });
  if (d.format !== "laketable")
    fail("FORMAT", "目标不是数据表，请选择 laketable 文档。");
  await r.preflightWeb();
  const c = await tableContext(r, d, {
    ...o,
    withoutView: [
      "read",
      "schema",
      "records",
      "content.get",
      "content.set",
    ].includes(action),
  });
  if (action === "read") {
    const rows = await records(r, c),
      page = o.page || 1,
      size = o.pageSize || 100;
    return r.result({
      id: d.id,
      url: r.url(d),
      sheet: c.sheet,
      records: rows.slice((page - 1) * size, page * size),
      total: rows.length,
      page,
      page_size: size,
      complete: page * size >= rows.length,
    });
  }
  if (action === "schema")
    return r.result({
      id: d.id,
      url: r.url(d),
      sheet: c.sheet.id,
      fields: c.sheet.columns,
      views: Object.values(c.sheet.views).map((v) => ({
        id: v.id,
        name: v.name,
        type: v.type,
        ...(o.raw ? { config: v } : {}),
      })),
    });
  if (action === "records") return r.result(await records(r, c));
  const [kind, verb] = action.split(".");
  if (kind === "record") {
    if (verb === "bulk") {
      if (!Array.isArray(o.input?.records) || !o.input.records.length)
        fail("INPUT", "input 需要 records: [{record,values:{字段:值}}]。");
      const rows = await records(r, c),
        updates = o.input.records.flatMap((item) => {
          one(rows, item.record, { key: "uuid", kind: "记录" });
          return values(c, item.values).map((u) => ({
            recordId: item.record,
            ...u,
          }));
        });
      if (!updates.length) fail("INPUT", "没有待更新值。");
      await r.request(
        "web",
        "PUT",
        base + "TableRecordValueController/bulkUpdate",
        { ...c.payload, records: updates },
      );
      await r.poll(
        () => records(r, c),
        (rs) =>
          updates.every((u) =>
            isDeepStrictEqual(
              rs.find((x) => x.uuid === u.recordId)?.data[u.fieldId],
              u.data,
            ),
          ),
      );
      return r.result(
        {
          records: [...new Set(updates.map((u) => u.recordId))],
          url: r.url(d),
        },
        "verified",
      );
    }

    const rows = verb === "add" ? [] : await records(r, c);
    let id = o.record;
    if (verb !== "add") {
      if (!id) fail("INPUT", "需要 --record UUID。");
      one(rows, id, { key: "uuid", kind: "记录" });
    }
    if (verb === "add" || verb === "set") {
      const updates = values(c, o.values || o.input || {});
      if (verb === "set" && !updates.length) fail("INPUT", "没有修改值。");
      if (verb === "add") {
        id = uid();
        await r.request("web", "POST", base + "TableRecordController/create", {
          ...c.payload,
          data: [{ id }],
        });
      }
      if (updates.length)
        await r.request(
          "web",
          "PUT",
          base + "TableRecordValueController/bulkUpdate",
          {
            ...c.payload,
            records: updates.map((u) => ({ recordId: id, ...u })),
          },
        );
      const verified = await r.poll(
        () => records(r, c),
        (rs) => {
          const row = rs.find((x) => x.uuid === id);
          return (
            row &&
            updates.every((u) => isDeepStrictEqual(row.data[u.fieldId], u.data))
          );
        },
      );
      return r.result(
        { id, url: r.url(d), values: verified.find((x) => x.uuid === id).data },
        "verified",
      );
    }
    if (verb === "remove") {
      if (!o.yes) fail("CONFIRM", "移除记录需要 --yes。");
      await r.request("web", "DELETE", base + "TableRecordController/remove", {
        ...c.payload,
        recordIds: [id],
      });
      await r.poll(
        () => records(r, c),
        (rs) => !rs.some((x) => x.uuid === id),
      );
      return r.result({ id, removed: true, url: r.url(d) }, "verified");
    }
  }
  if (kind === "content") {
    if (!o.record) fail("INPUT", "需要 --record UUID。");
    const read = async () => {
      const j = await r.request(
        "web",
        "POST",
        base + "TableRecordController/getContent",
        {
          docId: d.id,
          docType: "Doc",
          sheetId: c.sheet.id,
          recordIds: [o.record],
        },
        { read: true },
      );
      return j.content?.[o.record] || j.data?.content?.[o.record];
    };
    if (verb === "get") return r.result(await read());
    const content =
      o.input ||
      (o.body !== undefined
        ? {
            format: "lake",
            source: o.body,
            html: '<div class="lake-content">' + o.body + "</div>",
          }
        : null);
    if (!content?.source || typeof content.source !== "string")
      fail("INPUT", "需要 Lake --body-file 或 content 对象 --input。");
    await r.request("web", "PUT", base + "TableRecordController/putContent", {
      docId: d.id,
      docType: "Doc",
      sheetId: c.sheet.id,
      recordId: o.record,
      content,
    });
    await r.poll(read, (x) => x?.source === content.source);
    return r.result({ record: o.record, url: r.url(d) }, "verified");
  }
  if (kind === "field") {
    let f =
      verb === "add"
        ? { id: uid(), name: o.name, type: o.type || "text", config: {} }
        : structuredClone(one(c.sheet.columns, o.field, { kind: "字段" }));
    if (verb === "remove") {
      if (!o.yes) fail("CONFIRM", "删除字段需要 --yes。");
      await r.request("web", "DELETE", base + "TableFieldController/remove", {
        ...c.payload,
        fieldIds: [f.id],
      });
      await r.poll(
        () => model(r, d),
        (m) =>
          !m.sheet
            .find((s) => s.id === c.sheet.id)
            ?.columns.some((x) => x.id === f.id),
      );
      return r.result({ id: f.id, removed: true, url: r.url(d) }, "verified");
    }
    f = merge(f, o.input);
    if (o.name) f.name = o.name;
    if (o.type) f.type = o.type;
    if (!f.name) fail("INPUT", "字段需要 --name。");
    if (o.options)
      f.options = o.options.map((v) =>
        typeof v === "string" ? { id: uid(), value: v } : v,
      );
    if (
      verb === "set" &&
      f.id !== one(c.sheet.columns, o.field, { kind: "字段" }).id
    )
      fail("INPUT", "不能修改字段 ID。");
    await r.request(
      "web",
      verb === "add" ? "POST" : "PUT",
      base + "TableFieldController/" + (verb === "add" ? "create" : "update"),
      { ...c.payload, ...(verb === "add" ? { fields: [f] } : { field: f }) },
    );
    await r.poll(
      () => model(r, d),
      (m) => {
        const field = m.sheet
          .find((s) => s.id === c.sheet.id)
          ?.columns.find((x) => x.id === f.id);
        return containsFields(field, f);
      },
    );
    return r.result({ field: f, url: r.url(d) }, "verified");
  }
  if (kind === "view") {
    let v = structuredClone(c.view);
    if (verb === "add") {
      const rows = await records(r, c);
      v = {
        id: uid(),
        name: o.name,
        type: viewType(o.type || o.input?.type || "GRID"),
        columns: c.sheet.columns.map((f) => ({ id: f.id })),
        colCount: c.sheet.columns.length,
        rowCount: rows.length,
        rows: rows.map((r) => ({ id: r.uuid })),
        data: {},
        filter: null,
        sort: null,
        stats: {},
        group: [],
        groupData: [],
        frozenCol: 0,
        index: 0,
        rowHeight: { type: "low", name: "低", value: 36 },
        scrollX: 0,
        scrollY: 0,
        selections: {},
        tableId: "",
        showField: false,
      };
      if (v.type === "CARD") {
        v.columns = c.sheet.columns.map((f, i) => ({
          id: f.id,
          hidden: i >= 3,
        }));
        v.cover = { show: false, display: "clip" };
      }
      if (v.type === "CALENDAR") {
        const dateFields = c.sheet.columns.filter((f) => f.type === "date");
        const start = o.dateField
          ? one(dateFields, o.dateField, { kind: "日期字段" })
          : o.input?.date?.startId
            ? one(dateFields, o.input.date.startId, { kind: "日期字段" })
            : dateFields.length === 1
              ? dateFields[0]
              : null;
        if (!start)
          fail("INPUT", "日历需要唯一日期字段，或 --date-field 字段名称/ID。");
        const end = o.endField
          ? one(dateFields, o.endField, { kind: "结束日期字段" })
          : start;
        const title = o.titleField
          ? one(c.sheet.columns, o.titleField, { kind: "标题字段" })
          : c.sheet.columns[0];
        const now = new Date(),
          month = String(now.getMonth() + 1).padStart(2, "0");
        v.columns = c.sheet.columns.map((f, i) => ({
          id: f.id,
          hidden: i >= 3,
        }));
        v.date = {
          startId: start.id,
          endId: end.id,
          activeDate: `${now.getFullYear()}-${month}-01`,
          titleId: title.id,
          showLunar: false,
          sundayAtFirst: false,
          colorType: "custom",
          colorId: "",
        };
      }
      if (v.type === "KANBAN") {
        const field = o.groupBy
          ? one(c.sheet.columns, o.groupBy, { kind: "分组字段" })
          : c.sheet.columns.find((f) => f.type === "select");
        if (!field || field.type !== "select")
          fail("INPUT", "看板需要已有单选字段 --group-by 字段名称/ID。");
        v.group = [{ id: field.id, type: "asc" }];
        v.groupData = [
          {
            value: "",
            titleValue: "",
            rows: rows
              .filter((x) => !x.data[field.id]?.value)
              .map((x) => x.uuid),
            groupBy: field.id,
            key: "__(empty)__",
            collapse: false,
          },
          ...(field.options || []).map((o) => ({
            value: o.value,
            titleValue: [o.id],
            rows: rows
              .filter((x) => x.data[field.id]?.value === o.id)
              .map((x) => x.uuid),
            groupBy: field.id,
            key: field.id + ":" + o.id,
            collapse: false,
          })),
        ];
      }
    }
    if (verb === "remove") {
      if (!o.yes) fail("CONFIRM", "删除视图需要 --yes。");
      if (Object.keys(c.sheet.views).length <= 1)
        fail("INPUT", "不能移除唯一视图。");
      await r.request("web", "DELETE", base + "TableViewController/remove", {
        ...c.payload,
        viewId: v?.id,
        type: v?.type,
        data: { id: v.id },
      });
      await r.poll(
        () => model(r, d),
        (m) => !m.sheet.find((s) => s.id === c.sheet.id)?.views[v.id],
      );
      return r.result({ id: v.id, removed: true, url: r.url(d) }, "verified");
    }
    v = merge(v, o.input);
    if (o.name) v.name = o.name;
    if (o.type) v.type = o.type;
    v.type = viewType(v.type);
    if (!v.name || !["GRID", "KANBAN", "CARD", "CALENDAR"].includes(v.type))
      fail("INPUT", "需要 name，视图类型限 GRID/KANBAN/GALLERY/CALENDAR。");
    if (verb === "set" && v.id !== c.view.id)
      fail("INPUT", "不能修改视图 ID。");
    await r.request(
      "web",
      verb === "add" ? "POST" : "PUT",
      base + "TableViewController/" + (verb === "add" ? "create" : "update"),
      { ...c.payload, viewId: v?.id, type: v?.type, data: v },
    );
    await r.poll(
      () => model(r, d),
      (m) => {
        const x = m.sheet.find((s) => s.id === c.sheet.id)?.views[v.id];
        return containsFields(x, {
          ...(o.input || {}),
          name: v.name,
          type: v.type,
        });
      },
    );
    return r.result({ view: v, url: r.url(d) }, "verified");
  }
  fail("COMMAND", "未知数据表操作。");
}
