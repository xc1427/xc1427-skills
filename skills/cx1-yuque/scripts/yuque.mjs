#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  fail,
  importSession,
  loadSession,
  sessionPath,
  Client,
} from "./core.mjs";
import { Runtime } from "./runtime.mjs";
import { commands, validate, dispatch } from "./commands.mjs";
import { receive } from "./receiver.mjs";
const booleans = new Set(
  "yes all raw text group attach withChildren replaceFormat force notify".split(
    " ",
  ),
);
const numbers = new Set(
  "public offset limit page pageSize role status openWindow visible".split(" "),
);
const jsonFlags = new Set("input rows cells values options".split(" "));
const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
function read(file) {
  try {
    return fs.readFileSync(file === "-" ? 0 : file, "utf8");
  } catch {
    fail("INPUT", "输入文件无法读取。");
  }
}
function json(text) {
  try {
    return JSON.parse(text);
  } catch {
    fail("INPUT", "JSON 无法解析。");
  }
}
export function parse(argv) {
  const args = [...argv],
    words = [];
  while (args.length && !args[0].startsWith("--")) words.push(args.shift());
  let name;
  for (let n = Math.min(3, words.length); n > 0; n--) {
    const candidate = words.slice(0, n).join(" ");
    if (candidate in commands) {
      name = candidate;
      words.splice(0, n);
      break;
    }
  }
  if (!name) fail("COMMAND", "未知命令；使用 help。");
  const target = name.startsWith("api ") ? words : words.shift();
  if (!name.startsWith("api ") && words.length)
    fail("INPUT", "只接受一个位置参数；空格文本请引用。");
  const o = {};
  while (args.length) {
    let k = args.shift();
    if (!/^--[a-z][a-z0-9-]*$/.test(k)) fail("INPUT", "参数使用 --key value。");
    let raw = k.slice(2),
      negative = raw.startsWith("no-");
    if (negative) raw = raw.slice(3);
    const file = raw.endsWith("-file");
    if (file) raw = raw.slice(0, -5);
    const key = camel(raw);
    if (Object.hasOwn(o, key)) fail("INPUT", `重复参数 ${k}。`);
    let value;
    if (booleans.has(key) && !file) {
      value = !negative;
      if (args[0] === "true" || args[0] === "false")
        value = args.shift() === "true";
    } else {
      if (negative) fail("INPUT", `无效布尔参数 ${k}。`);
      value = args.shift();
      if (value === undefined || value.startsWith("--"))
        fail("INPUT", `${k} 缺少值。`);
      if (file || key === "input") value = read(value);
      if (jsonFlags.has(key)) value = json(value);
      if (numbers.has(key)) {
        value = Number(value);
        if (!Number.isInteger(value) || (key !== "status" && value < 0))
          fail("INPUT", `${k} 需要整数。`);
      }
    }
    o[key] = value;
  }
  validate(name, o);
  if (o.input !== undefined && (!o.input || typeof o.input !== "object"))
    fail("INPUT", "--input 必须为 JSON 对象或 batch 数组。");
  for (const file of [o.output, o.download].filter(Boolean)) {
    if (fs.existsSync(file))
      fail("OUTPUT_EXISTS", "输出文件已存在；尚未发送请求。");
    fs.accessSync(path.dirname(path.resolve(file)), fs.constants.W_OK);
  }
  return { name, target, o };
}
function output(result, o) {
  const text = o.text
    ? (typeof result.data?.body === "string"
        ? result.data.body
        : typeof result.data?.markdown === "string"
          ? result.data.markdown
          : JSON.stringify(result.data, null, 2)) + "\n"
    : JSON.stringify(result, null, 2) + "\n";
  if (o.output) fs.writeFileSync(o.output, text, { mode: 0o600, flag: "wx" });
  else process.stdout.write(text);
}
function references(value, results) {
  if (typeof value === "string" && value.startsWith("$results.")) {
    let got = results;
    for (const part of value.slice(9).split(".")) {
      if (!got || !Object.hasOwn(got, part))
        fail("BATCH_REF", "无法解析 batch 结果引用。");
      got = got[part];
    }
    return typeof got === "number" ? String(got) : got;
  }
  if (Array.isArray(value)) return value.map((v) => references(v, results));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, references(v, results)]),
    );
  return value;
}
export async function execute(r, { name, target, o }) {
  if (name.startsWith("session ")) {
    const action = name.split(" ")[1];
    let result;
    if (action === "import") {
      if (process.stdin.isTTY)
        fail("INPUT", "Cookie 只接受 stdin；不要放在参数中。");
      result = await importSession(read("-"), o.account, o.expires);
    }
    if (action === "receive") result = await receive(o.account, o.expires);
    if (action === "status") {
      const s = loadSession(),
        c = new Client({ mode: "web", session: s });
      result = {
        account: await c.check(),
        importedAt: s.importedAt,
        expiresAt: s.expiresAt || null,
      };
    }
    if (action === "forget") {
      if (fs.existsSync(sessionPath())) fs.unlinkSync(sessionPath());
      result = { forgotten: true, browserLoggedOut: false };
    }
    return r.result(result, action === "status" ? "read" : "verified");
  }
  if (name === "batch") {
    const steps = o.input;
    if (!Array.isArray(steps) || !steps.length || steps.length > 100)
      fail("INPUT", "batch 输入为 1–100 个 {id,command,target,options} 对象。");
    const ids = new Set();
    for (const s of steps) {
      if (
        !s.id ||
        ids.has(s.id) ||
        ["__proto__", "constructor", "prototype"].includes(s.id)
      )
        fail("INPUT", "batch id 必须唯一。");
      ids.add(s.id);
      if (!s.command || /^(batch|session|official|api)/.test(s.command))
        fail("INPUT", "batch 仅接受业务命令。");
      validate(s.command, s.options || {});
    }
    const results = Object.create(null);
    for (const s of steps) {
      try {
        const target = references(s.target, results),
          options = references(s.options || {}, results);
        const before = r.steps.length;
        const result = await dispatch(r, s.command, target, options);
        delete result.completed;
        results[s.id] = {
          ...result,
          ...(r.steps.length > before
            ? { completed: r.steps.slice(before) }
            : {}),
        };
      } catch (e) {
        e.details = { ...e.details, failedStep: s.id, results };
        throw e;
      }
    }
    return r.result(results, "completed");
  }
  return dispatch(r, name, target, o);
}
export async function main(argv = process.argv.slice(2)) {
  if (!argv.length || ["help", "--help", "-h"].includes(argv[0])) {
    process.stdout.write(
      "cx1-yuque — 自有 CLI，Node >=22，无运行时 npm 依赖\n用法: yuque.sh COMMAND [URL/ID] [--key value]\n\n" +
        Object.entries(commands)
          .map(
            ([k, v]) =>
              k +
              (v
                ? "  [" +
                  v
                    .replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())
                    .split(" ")
                    .map((x) => "--" + x)
                    .join(" ") +
                  "]"
                : ""),
          )
          .join("\n") +
        "\n\n文件输入: --body-file/--dsl-file/--rows-file/--cells-file/--values-file/--options-file；--input JSON_FILE\n所有命令支持 --output NEW_FILE；读取 --text。默认 JSON。布尔用 --flag/--no-flag。\nbatch --input STEPS.json 共享进程、账号校验与对象缓存。\n",
    );
    return;
  }
  if (argv[0] === "official")
    fail(
      "ROUTE_REMOVED",
      "已移除 Open API 官方 CLI 兜底；使用 Web API 或 Chrome 核验。",
    );
  const r = new Runtime();
  let o = {};
  try {
    const parsed = parse(argv);
    o = parsed.o;
    output(await execute(r, parsed), o);
  } catch (e) {
    process.stderr.write(JSON.stringify(r.error(e)) + "\n");
    process.exitCode = 1;
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href
)
  main().catch((e) => {
    process.stderr.write(
      JSON.stringify({
        status: "failed",
        error: e.code || "LOCAL_ERROR",
        message: e.code ? e.message : "本地运行失败。",
      }) + "\n",
    );
    process.exitCode = 1;
  });
