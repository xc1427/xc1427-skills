import { fail } from "./core.mjs";
import { parseTarget, describeUrl } from "./runtime.mjs";
import { document, catalog } from "./documents.mjs";
import { webCommand } from "./web-commands.mjs";
import { sheetCommand } from "./sheets.mjs";
import { tableCommand } from "./tables.mjs";
import { extras } from "./extras.mjs";
// 命令表同时约束解析、帮助与批处理，避免拼写错误静默忽略。
export const commands = {
  "auth status": "",
  ping: "",
  "user me": "raw",
  "user groups": "role offset all",
  "user books": "input",
  "user recent": "input offset limit",
  "book list": "group offset limit type filterByAbility all raw",
  "book get": "",
  "book create": "name slug description public group input",
  "book update": "name slug description public input",
  "book delete": "yes",
  search: "type scope creator page all raw",
  "search web": "type scope creator page input",
  "doc list": "offset limit all raw",
  "doc read": "book format page pageSize",
  "doc inspect": "book raw",
  "doc create": "title slug body format public attach target position",
  "doc update":
    "book title slug body format public expectedSha256 replaceFormat",
  "doc append": "book body format expectedSha256",
  "doc patch": "book input expectedSha256",
  "doc delete": "book yes",
  "doc publish": "book force notify",
  "doc copy": "book to target position",
  "doc move": "book to target position",
  "doc export": "book type download",
  "doc versions": "book",
  "doc version": "",
  "toc list": "via",
  "toc tree": "via",
  "toc add": "title url target openWindow via",
  "toc edit": "node title url openWindow visible via",
  "toc move": "node target position via",
  "toc remove": "node withChildren via",
  "toc destroy": "node withChildren yes",
  "toc attach": "doc target position via",
  "toc copy": "node to target position withChildren",
  "toc transfer": "node to target position withChildren",
  "toc batch": "input yes",
  "note list": "page offset limit status all via q filterType order",
  "note get": "via",
  "note create": "body",
  "note update": "body format input status expectedSha256 via",
  "note tags": "input",
  "note tag-stats": "input",
  "comment list": "book offset limit input",
  "comment create": "book body format input",
  "mark list": "offset limit type input",
  "mark tags": "input",
  "attachment upload": "file",
  "attachment add": "file book expectedSha256",
  "sheet create": "title body rows input",
  "sheet read": "book sheet via",
  "sheet inspect": "book",
  "sheet set": "book sheet cells input expectedSha256",
  "sheet write": "book sheet body rows input expectedSha256",
  "sheet append": "book sheet body rows input expectedSha256",
  "sheet export": "book type download",
  "table read": "book sheet page pageSize",
  "table schema": "book sheet view raw",
  "table records": "book sheet view",
  "table record add": "book sheet view values input",
  "table record set": "book sheet view record values input",
  "table record remove": "book sheet view record yes",
  "table record bulk": "book sheet view input",
  "table content get": "book sheet view record",
  "table content set": "book sheet view record body input",
  "table field add": "book sheet view name type options input",
  "table field set": "book sheet view field name type options input",
  "table field remove": "book sheet view field yes",
  "table view add":
    "book sheet view name type groupBy dateField endField titleField input",
  "table view set": "book sheet view name type input",
  "table view remove": "book sheet view yes",
  "group members": "offset role all",
  "group member-set": "user role yes",
  "group member-remove": "user yes",
  "stats group": "input",
  "stats members": "offset limit input",
  "stats books": "offset limit input",
  "stats docs": "offset limit input",
  "resource get": "doc book input",
  "resource create": "doc book type dsl after input expectedSha256",
  "resource update": "doc book dsl body input expectedSha256",
  "url parse": "",
  resolve: "book",
  "session import": "account expires",
  "session receive": "account expires",
  "session status": "",
  "session forget": "",
  batch: "input",
  "api web": "input",
};
export function validate(name, o) {
  if (!(name in commands)) fail("COMMAND", "未知命令；运行 help。");
  if (
    o.input !== undefined &&
    (!o.input ||
      typeof o.input !== "object" ||
      (name !== "batch" && Array.isArray(o.input)))
  )
    fail("INPUT", "input 必须是 JSON 对象（batch 使用数组）。");
  const allowed = new Set((commands[name] + " output text").split(" "));
  for (const key of Object.keys(o))
    if (!allowed.has(key))
      fail(
        "INPUT",
        `${name} 不接受 --${key.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}。`,
      );
}
export async function dispatch(r, name, target, o = {}) {
  validate(name, o);
  if (o.via && o.via !== "web")
    fail("INPUT", "仅支持 --via web；Open API 已移除。");
  const parts = name.split(" "),
    [group, action] = parts;
  if (name === "url parse") return r.result(describeUrl(target));
  if (name === "resolve") {
    const p = parseTarget(target);
    return r.result(
      p.type === "book"
        ? await r.book(target)
        : await r.doc(target, { book: o.book }),
    );
  }
  if (group === "api") {
    const [method, path] = target;
    if (!method || !path) fail("INPUT", "api web METHOD /api/...");
    if (action === "web") await r.preflightWeb();
    return r.result(
      await r.request(action, method.toUpperCase(), path, o.input),
      method.toUpperCase() === "GET" ? "read" : "submitted",
    );
  }
  if (group === "toc") return catalog(r, action, target, o);
  if (group === "doc" && action !== "list")
    return document(r, action, target, o);
  if (group === "sheet") return sheetCommand(r, action, target, o);
  if (group === "table")
    return tableCommand(r, parts.slice(1).join("."), target, o);
  if (
    ["comment", "attachment", "mark"].includes(group) ||
    [
      "user books",
      "user recent",
      "note tags",
      "note tag-stats",
      "search web",
    ].includes(name)
  )
    return extras(r, group, action, target, o);
  return webCommand(r, group, action, target, o);
}
