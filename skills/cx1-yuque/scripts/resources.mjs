import { randomUUID } from "node:crypto";
import { fail } from "./core.mjs";
import { bodyOf, checkHash, hash } from "./runtime.mjs";
import { saveDoc } from "./documents.mjs";
// 画板的可编辑数据位于 Lake card；src 只是导出快照，不能作为独立资源写回。
export function boardCards(body) {
  return [
    ...body.matchAll(/<card\b[^>]*\bname=["']board["'][^>]*>\s*<\/card>/g),
  ].map((m) => {
    const value = m[0].match(/\bvalue="([^"]*)"|\bvalue='([^']*)'/);
    if (!value) fail("RESOURCE_FORMAT", "board 卡片缺少 value。");
    let data;
    try {
      data = JSON.parse(decodeURIComponent(value[1] ?? value[2]));
    } catch {
      fail("RESOURCE_FORMAT", "board 卡片 value 无法解析。");
    }
    return { markup: m[0], index: m.index, data };
  });
}
export async function resourceCommand(r, action, target, o) {
  const ref = o.doc || o.input?.url || o.input?.doc_id;
  if (!ref)
    fail("INPUT", "画板操作需要 --doc 文档 URL；target 为卡片 id 或 src。");
  const d = await r.doc(String(ref), { book: o.book });
  if (d.format !== "lake") fail("FORMAT", "画板需要 Lake 文档。");
  const body = bodyOf(d),
    cards = boardCards(body);
  const matches = cards.filter(
    (c) => c.data.id === target || c.data.src === target,
  );
  if (action === "get") {
    if (!target)
      return r.result({
        doc_id: d.id,
        cards: cards.map((c) => c.data),
        sha256: hash(body),
      });
    if (matches.length !== 1)
      fail("AMBIGUOUS", "画板未唯一匹配，请使用卡片 id。");
    return r.result({ doc_id: d.id, ...matches[0].data, sha256: hash(body) });
  }
  checkHash(body, o.expectedSha256);
  let input = o.input?.value || o.input?.diagramData;
  if (o.dsl !== undefined) {
    try {
      input = JSON.parse(o.dsl);
    } catch {
      fail("INPUT", "--dsl 使用原生 diagramData JSON；参阅 Lake 画板模板。");
    }
  }
  if (!input || typeof input !== "object" || Array.isArray(input))
    fail("INPUT", "需要 --input 中的 value/diagramData 或 --dsl 原生 JSON。");
  const data = input.diagramData ? input : { diagramData: input };
  if (!data.diagramData?.body || typeof data.diagramData.body !== "object")
    fail("INPUT", "diagramData 需要 body 数组或对象。");
  if (o.body !== undefined)
    fail(
      "INPUT",
      "文本属于 diagramData 元素；请在原生 JSON 中修改以保留结构。",
    );
  let value, next;
  if (action === "create") {
    const types = {
      mindmap: "mindmap",
      flowchart: "flowchart",
      architecturediagram: "board",
      board: "board",
      uml: "uml",
    };
    if (!types[o.type || "board"]) fail("INPUT", "未知画板类型。");
    value = {
      id: randomUUID(),
      cardType: types[o.type || "board"],
      viewportOption: "adapt",
      ...data,
    };
    if (cards.some((c) => c.data.id === value.id))
      fail("INPUT", "卡片 ID 已存在。");
  } else {
    if (matches.length !== 1)
      fail("AMBIGUOUS", "画板未唯一匹配，请使用卡片 id。");
    value = { ...matches[0].data, ...data, id: matches[0].data.id };
    // 原生数据更新后清除旧静态快照，避免导出错误地显示旧图。
    if (!Object.hasOwn(data, "src")) delete value.src;
  }
  const markup =
    '<card type="block" name="board" value="' +
    encodeURIComponent(JSON.stringify(value)).replaceAll("'", "%27") +
    '"></card>';
  if (action === "create") {
    if (o.after) {
      const escaped = o.after.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(
        '<([a-z][\\w-]*)\\b[^>]*\\bid="' +
          escaped +
          '"[^>]*>[\\s\\S]*?<\\/\\1>',
        "g",
      );
      const anchors = [...body.matchAll(re)];
      if (anchors.length !== 1)
        fail("AMBIGUOUS", "插入锚点未唯一匹配完整 Lake 块。");
      const at = anchors[0].index + anchors[0][0].length;
      next = body.slice(0, at) + markup + body.slice(at);
    } else next = body + "\n" + markup;
  } else
    next =
      body.slice(0, matches[0].index) +
      markup +
      body.slice(matches[0].index + matches[0].markup.length);
  const after = await saveDoc(r, d, { format: "lake", body: next });
  return r.result(
    {
      doc_id: d.id,
      url: r.url(after),
      card: value,
      sha256: hash(bodyOf(after)),
    },
    "verified",
  );
}
