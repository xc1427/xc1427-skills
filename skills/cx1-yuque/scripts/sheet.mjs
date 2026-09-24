import { inflateSync, deflateSync } from "node:zlib";
import { fail } from "./core.mjs";
export function unpack(body) {
  const value = JSON.parse(body);
  if (typeof value.sheet === "string")
    value.sheet = JSON.parse(
      inflateSync(Buffer.from(value.sheet, "latin1"), {
        maxOutputLength: 64 * 1024 * 1024,
      }).toString("utf8"),
    );
  if (!Array.isArray(value.sheet))
    fail("SHEET_FORMAT", "未知 lakesheet 结构。");
  return value;
}
export function pack(value) {
  const copy = structuredClone(value);
  copy.sheet = deflateSync(Buffer.from(JSON.stringify(copy.sheet))).toString(
    "latin1",
  );
  return JSON.stringify(copy);
}
export function coordinates(ref) {
  const m = /^([A-Z]+)([1-9]\d*)$/i.exec(ref);
  if (!m) fail("CELL_REF", "单元格必须是 A1 格式，行号从 1 开始。");
  let col = 0;
  for (const c of m[1].toUpperCase()) col = col * 26 + c.charCodeAt(0) - 64;
  const row = Number(m[2]) - 1;
  if (!Number.isSafeInteger(row) || row > 999999 || col > 16384)
    fail("CELL_REF", "单元格超出本工具支持范围。");
  return { row, col: col - 1 };
}
export function patch(body, index, cells) {
  const value = unpack(body),
    sheet = value.sheet[index];
  if (!sheet || !Number.isInteger(index) || index < 0)
    fail("SHEET_INDEX", "子表索引无效。");
  if (
    !cells ||
    Array.isArray(cells) ||
    typeof cells !== "object" ||
    !Object.keys(cells).length
  )
    fail("INPUT", "cells 必须是非空 A1 → 标量对象。");
  sheet.data ??= {};
  for (const [ref, v] of Object.entries(cells)) {
    if (v !== null && !["string", "number", "boolean"].includes(typeof v))
      fail("CELL_VALUE", "仅支持标量或 null（清空）；公式编写不在本命令范围。");
    const { row, col } = coordinates(ref),
      old = sheet.data[row]?.[col] || {};
    // 已有公式、富文本或未知单元格属性可能与 v 耦合，不猜测其更新语义。
    if (
      Object.keys(old).some((k) => !["v", "s", "t", "n"].includes(k)) ||
      (typeof old.v === "string" && old.v.startsWith("="))
    )
      fail(
        "COMPLEX_CELL",
        "目标为公式/富文本/扩展单元格；请在网页修改。其他单元格完全保留。",
      );
    if (typeof v === "string" && v.startsWith("="))
      fail("FORMULA", "本命令不计算或维护公式依赖，请在网页编辑公式。");
    sheet.data[row] ??= {};
    sheet.data[row][col] = { ...old };
    if (v === null) delete sheet.data[row][col].v;
    else sheet.data[row][col].v = v;
    sheet.rowCount = Math.max(sheet.rowCount || 0, row + 1);
    sheet.colCount = Math.max(sheet.colCount || 0, col + 1);
  }
  return pack(value);
}
export function blank(rows = []) {
  if (
    !Array.isArray(rows) ||
    rows.some(
      (r) =>
        !Array.isArray(r) ||
        r.some(
          (v) =>
            v !== null && !["string", "number", "boolean"].includes(typeof v),
        ),
    )
  )
    fail("INPUT", "rows 必须是标量二维数组。");
  const data = {};
  rows.forEach((r, i) =>
    r.forEach((v, j) => {
      if (v !== null) {
        data[i] ??= {};
        data[i][j] = { v };
      }
    }),
  );
  return pack({
    format: "lakesheet",
    version: "3.5.5",
    larkJson: true,
    sheet: [
      {
        name: "Sheet1",
        rowCount: Math.max(200, rows.length),
        colCount: Math.max(26, ...rows.map((r) => r.length)),
        data,
        selections: {},
        rows: {},
        columns: {},
        filter: {},
        index: 0,
        mergeCells: {},
      },
    ],
    calcChain: [],
    vessels: {},
    useUTC: true,
    useIndex: true,
    customColors: [],
    meta: { sort: 0, shareFilter: 0 },
    formulaCalclated: true,
  });
}

export function columnName(index) {
  let s = "";
  for (let n = index + 1; n; n = Math.floor((n - 1) / 26))
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
export function markdownRows(text) {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((x) => x.trim());
  const rows = lines
    .map((line) => {
      let s = line.trim();
      if (s.startsWith("|")) s = s.slice(1);
      if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
      const out = [];
      let cell = "",
        escaped = false,
        ticks = false;
      for (const c of s) {
        if (escaped) {
          cell += c;
          escaped = false;
        } else if (c === "\\") escaped = true;
        else if (c === "`") {
          ticks = !ticks;
          cell += c;
        } else if (c === "|" && !ticks) {
          out.push(cell.trim());
          cell = "";
        } else cell += c;
      }
      if (escaped) cell += "\\";
      out.push(cell.trim());
      return out;
    })
    .filter((row) => !row.every((c) => /^:?-{3,}:?$/.test(c)));
  if (!rows.length || rows.some((r) => r.length !== rows[0].length))
    fail("INPUT", "Markdown 表格列数不一致或为空。");
  return rows;
}
export function markdownTable(rows) {
  if (!rows.length) return "";
  const size = Math.max(...rows.map((r) => r.length));
  const escaped = rows.map((r) =>
    Array.from({ length: size }, (_, c) =>
      String(r[c] ?? "")
        .replaceAll("|", "\\|")
        .replaceAll("\n", "<br>"),
    ),
  );
  return escaped
    .map(
      (r, i) =>
        "| " +
        r.join(" | ") +
        " |" +
        (i === 0 ? "\n| " + r.map(() => "---").join(" | ") + " |" : ""),
    )
    .join("\n");
}
export function rowChanges(rows, start = 0) {
  if (!Array.isArray(rows) || rows.some((r) => !Array.isArray(r)))
    fail("INPUT", "rows 需要二维数组。");
  const out = {};
  rows.forEach((r, i) =>
    r.forEach((v, c) => (out[columnName(c) + (start + i + 1)] = v)),
  );
  return out;
}
