import { fail } from "./core.mjs";
const table = "/api/modules/table/doc/";
// required 为线上已验证请求的最小操作上下文；对象字段按原协议保留。
export const operations = {
  "comment.list": ["GET", "/api/comments", ["commentable_id"]],
  "comment.create": ["POST", "/api/comments", ["commentable_id", "body"]],
  "search.web": ["GET", "/api/zsearch", ["q"]],
  "toc.list": ["GET", "/api/catalog_nodes", ["book_id"]],
  "toc.attach": [
    "POST",
    "/api/docs/add_to_catalog",
    ["book_id", "ids", "action"],
  ],
  "toc.copy": [
    "PUT",
    "/api/catalog_nodes/copy",
    [
      "book_id",
      "target_book_id",
      "node_uuid",
      "action",
      "with_children",
      "insert_to_catalog",
    ],
  ],
  "toc.move": [
    "PUT",
    "/api/catalog_nodes/move",
    [
      "book_id",
      "target_book_id",
      "node_uuid",
      "action",
      "with_children",
      "insert_to_catalog",
    ],
  ],
  "toc.batch": [
    "PUT",
    "/api/catalog_nodes/batch",
    ["book_id", "batch_action", "node_uuids"],
  ],
  "table.records": [
    "GET",
    table + "TableRecordController/show",
    ["docId", "sheetId"],
  ],
  "table.record.create": [
    "POST",
    table + "TableRecordController/create",
    ["docId", "sheetId", "viewId", "data"],
  ],
  "table.record.update": [
    "PUT",
    table + "TableRecordValueController/bulkUpdate",
    ["docId", "sheetId", "viewId", "records"],
  ],
  "table.record.remove": [
    "DELETE",
    table + "TableRecordController/remove",
    ["docId", "sheetId", "viewId", "recordIds"],
  ],
  "table.content.get": [
    "POST",
    table + "TableRecordController/getContent",
    ["docId", "sheetId", "recordIds"],
  ],
  "table.content.put": [
    "PUT",
    table + "TableRecordController/putContent",
    ["docId", "sheetId", "recordId", "content"],
  ],
  "table.field.create": [
    "POST",
    table + "TableFieldController/create",
    ["docId", "sheetId", "viewId", "fields"],
  ],
  "table.field.update": [
    "PUT",
    table + "TableFieldController/update",
    ["docId", "sheetId", "viewId", "field"],
  ],
  "table.field.remove": [
    "DELETE",
    table + "TableFieldController/remove",
    ["docId", "sheetId", "viewId", "fieldIds"],
  ],
  "table.view.create": [
    "POST",
    table + "TableViewController/create",
    ["docId", "sheetId", "viewId", "data"],
  ],
  "table.view.update": [
    "PUT",
    table + "TableViewController/update",
    ["docId", "sheetId", "viewId", "data"],
  ],
  "table.view.remove": [
    "DELETE",
    table + "TableViewController/remove",
    ["docId", "sheetId", "viewId", "data"],
  ],
  "user.books": ["GET", "/api/mine/book_stacks", []],
  "user.recent": ["GET", "/api/recent/list", []],
  "mark.list": ["GET", "/api/mine/marks", []],
  "mark.tags": ["GET", "/api/action/tags/list", []],
  "note.tags": ["GET", "/api/modules/note/tags/TagController/index", []],
  "note.tag-stats": [
    "GET",
    "/api/modules/note/notes/NoteTagController/count",
    [],
  ],
};
export function required(input, fields) {
  for (const k of fields)
    if (input[k] === undefined || input[k] === null || input[k] === "")
      fail("INPUT", `缺少 ${k}。`);
}
export function prepare(name, input) {
  const spec = operations[name];
  if (!spec) fail("COMMAND", "未知操作；使用 help。");
  const [method, endpoint, fields] = spec;
  required(input, fields);
  let body = { ...input };
  if (name.startsWith("comment."))
    body = {
      commentable_type: "Doc",
      ...(name === "comment.create" ? { format: "markdown" } : {}),
      ...body,
    };
  if (name === "mark.list")
    body = { offset: 0, limit: 100, type: "all", ...body };
  if (name === "mark.tags") body = { action_type: "mark", ...body };
  if (name === "search.web") body = { type: "doc", p: 1, ...body };
  if (name.startsWith("table."))
    body = {
      docType: "Doc",
      ...(name.includes("content") || name === "table.records"
        ? {}
        : { type: "GRID" }),
      ...body,
    };
  for (const k of [
    "ids",
    "node_uuids",
    "recordIds",
    "fieldIds",
    "fields",
    "records",
  ])
    if (k in body && (!Array.isArray(body[k]) || !body[k].length))
      fail("INPUT", `${k} 必须是非空数组。`);
  if (
    ["toc.copy", "toc.move", "toc.attach"].includes(name) &&
    !["appendChild", "prependChild", "moveBefore", "moveAfter"].includes(
      body.action,
    )
  )
    fail("INPUT", "无效的位置 action。");
  if (
    ["moveBefore", "moveAfter"].includes(body.action) &&
    !(body.target_uuid || body.target_node_uuid)
  )
    fail("INPUT", "同级定位必须提供目标 UUID。");
  if (name === "toc.batch") {
    if (
      !["batchRemove", "batchDestroy", "batchMove", "batchCopy"].includes(
        body.batch_action,
      )
    )
      fail("INPUT", "无效的 batch_action。");
    if (["batchMove", "batchCopy"].includes(body.batch_action)) {
      required(body, [
        "target_book_id",
        "transfer_action",
        "insert_to_catalog",
      ]);
      if (
        !["appendChild", "prependChild", "moveBefore", "moveAfter"].includes(
          body.transfer_action,
        )
      )
        fail("INPUT", "无效的 transfer_action。");
      if (["moveBefore", "moveAfter"].includes(body.transfer_action))
        required(body, ["target_uuid"]);
    }
  }
  for (const k of ["with_children", "insert_to_catalog"])
    if (k in body && typeof body[k] !== "boolean")
      fail("INPUT", `${k} 必须是布尔值。`);
  if (name.startsWith("table.view.") && body.data?.id !== body.viewId)
    fail("INPUT", "data.id 必须等于 viewId。");
  if (
    name === "table.content.put" &&
    (!body.content ||
      typeof body.content !== "object" ||
      Array.isArray(body.content))
  )
    fail("INPUT", "content 必须是对象，不是字符串。");
  if (method === "GET")
    return {
      method,
      path:
        endpoint +
        "?" +
        new URLSearchParams(
          Object.entries(body).map(([k, v]) => [
            k,
            typeof v === "object" ? JSON.stringify(v) : String(v),
          ]),
        ),
    };
  return { method, path: endpoint, body };
}
