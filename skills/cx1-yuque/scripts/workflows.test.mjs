import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";
import { Runtime, parseTarget, one, containsFields } from "./runtime.mjs";
import { parse, execute } from "./yuque.mjs";
import { dispatch } from "./commands.mjs";
import { positioned, positionedMany, sameTree, subtree } from "./documents.mjs";
import { markdownRows, rowChanges } from "./sheet.mjs";
const ok = (data) =>
  new Response(JSON.stringify({ data }), {
    headers: { "content-type": "application/json" },
  });
const session = {
  version: 1,
  account: { id: 7, login: "tester" },
  cookies: { _yuque_session: "s", yuque_ctoken: "c" },
};
function runtime(fetcher) {
  return new Runtime({
    fetcher: (url, req) =>
      url.endsWith("/api/mine")
        ? Promise.resolve(ok(session.account))
        : fetcher(url, req),
    sessionLoader: () => session,
  });
}
test("URL parsing and strict CLI inputs reject ambiguity before requests", () => {
  assert.deepEqual(parseTarget("https://www.yuque.com/a/b/c?x=y#header"), {
    type: "doc",
    book: "a/b",
    id: "c",
  });
  assert.throws(() => parseTarget("https://evil.example/a/b/c"), {
    code: "TARGET",
  });
  assert.throws(
    () =>
      one(
        [
          { id: "a", name: "same" },
          { id: "b", name: "same" },
        ],
        "same",
      ),
    { code: "AMBIGUOUS" },
  );
  assert.throws(() => parse(["doc", "create", "a/b", "--titel", "oops"]), {
    code: "INPUT",
  });
  assert.throws(() => parse(["doc", "read", "1", "--raw"]), { code: "INPUT" });
  assert.throws(
    () => parse(["toc", "move", "a/b", "--node", "x", "--node", "y"]),
    { code: "INPUT" },
  );
  assert.equal(
    parse([
      "doc",
      "create",
      "a/b",
      "--no-attach",
      "--body",
      "ok",
      "--title",
      "t",
    ]).o.attach,
    false,
  );
  assert.deepEqual(
    parse(["sheet", "set", "1", "--cells", '{"AA3":42}']).o.cells,
    { AA3: 42 },
  );
  assert.equal(
    parse(["doc", "patch", "1", "--expected-sha256", "abc"]).o.expectedSha256,
    "abc",
  );
});
test("pagination keeps pins, advances by returned count and fails on stalled pages", async () => {
  const urls = [];
  const r = runtime(async (url) => {
    urls.push(url);
    return ok(
      url.includes("offset=1")
        ? { notes: [{ id: 2 }], has_more: false }
        : { pin_notes: [{ id: 9 }], notes: [{ id: 1 }], has_more: true },
    );
  });
  const res = await r.pages(
    "web",
    "/api/modules/note/notes/NoteController/index",
    { limit: 20 },
    "offset",
    true,
  );
  assert.deepEqual(
    res.items.map((x) => x.id),
    [9, 1, 2],
  );
  assert.equal(res.complete, true);
  assert.match(urls[1], /offset=1/);
  const stuck = runtime(async () => ok([{ id: 1 }]));
  await assert.rejects(stuck.pages("web", "/api/zsearch", {}, "page", true), {
    code: "PAGINATION_STALLED",
  });
});
test("GET-only batch uses Web session and reuses auth once", async () => {
  let count = 0;
  const r = new Runtime({
    sessionLoader: () => session,
    fetcher: async () => {
      count++;
      return ok({ id: 7, login: "tester" });
    },
  });
  const result = await execute(r, {
    name: "batch",
    o: {
      input: [
        { id: "a", command: "user me" },
        { id: "b", command: "user me" },
      ],
    },
  });
  assert.equal(result.status, "completed");
  assert.equal(count, 1);
});
test("Web workflows validate one session per process without using unrelated Open token", async () => {
  let count = 0;
  const r = new Runtime({
    sessionLoader: () => session,
    fetcher: async (url, req) => {
      assert.equal(req.headers["X-Auth-Token"], undefined);
      if (url.endsWith("/api/mine")) {
        count++;
        return ok(session.account);
      }
      return ok([]);
    },
  });
  await r.preflightWeb();
  await r.preflightWeb();
  assert.equal(count, 1);
});
test("mixed account mismatch prevents mutation", async () => {
  const requests = [];
  const r = new Runtime({
    sessionLoader: () => session,
    fetcher: async (url, req) => {
      requests.push(req.method);
      return ok({ id: 8, login: "other" });
    },
  });
  await assert.rejects(r.preflightWeb(), { code: "ACCOUNT_MISMATCH" });
  assert.ok(requests.every((x) => x === "GET"));
});
test("known successful write followed by unknown failure retains journal and does not retry", async () => {
  let calls = 0;
  const r = runtime(async () => {
    if (++calls === 1) return ok({ id: 123 });
    throw new Error("secret in network exception");
  });
  await r.request("web", "POST", "/api/docs", { title: "test" });
  try {
    await r.request("web", "PUT", "/api/docs/123", {});
    assert.fail();
  } catch (e) {
    const result = r.error(e);
    assert.equal(result.status, "unknown");
    assert.equal(result.completed[0].id, 123);
    assert.equal(calls, 2);
    assert.ok(!JSON.stringify(result).includes("secret"));
  }
});
test("500 mutation outcome is unknown and not automatically replayed", async () => {
  const r = runtime(
    async () =>
      new Response(JSON.stringify({ error: "failure" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
  );
  try {
    await r.request("web", "POST", "/api/docs", {});
    assert.fail();
  } catch (e) {
    assert.equal(r.error(e).status, "unknown");
  }
});
test("document stale content stops before PUT; patches require a unique exact match", async () => {
  let puts = 0,
    gets = 0;
  const r = runtime(async (_url, req) => {
    if (_url.endsWith("/api/mine/book_stacks"))
      return ok([{ books: [{ id: 2 }] }]);
    if (req.method === "PUT") puts++;
    return ok({
      id: 12,
      book_id: 2,
      title: "t",
      format: "lake",
      updated_at: ++gets === 1 ? "a" : "b",
      content: "<p>old</p>",
    });
  });
  await assert.rejects(
    dispatch(r, "doc patch", "12", {
      book: "2",
      input: { edits: [{ find: "old", replace: "new" }] },
    }),
    { code: "CONFLICT" },
  );
  assert.equal(puts, 0);
  const r2 = runtime(async (url) =>
    url.endsWith("/api/mine/book_stacks")
      ? ok([{ books: [{ id: 2 }] }])
      : ok({ id: 12, book_id: 2, format: "lake", content: "<p>x x</p>" }),
  );
  await assert.rejects(
    dispatch(r2, "doc patch", "12", {
      book: "2",
      input: { edits: [{ find: "x", replace: "y" }] },
    }),
    { code: "AMBIGUOUS" },
  );
});
test("Web create workflow attaches and verifies document with one mutation per stage", async () => {
  const calls = [];
  const d = {
    id: 12,
    book_id: 2,
    format: "lake",
    title: "t",
    content: "<p>ok</p>",
  };
  const r = runtime(async (url, req) => {
    calls.push([req.method, url]);
    if (url.endsWith("/api/mine/book_stacks"))
      return ok([{ books: [{ id: 2 }] }]);
    if (url.includes("/api/catalog_nodes?"))
      return ok([{ uuid: "n", id: 12, parent_uuid: "" }]);
    return ok(d);
  });
  const res = await dispatch(r, "doc create", "2", {
    title: "t",
    body: "<p>ok</p>",
    format: "lake",
  });
  assert.equal(res.status, "verified");
  assert.equal(calls.filter((x) => x[0] === "POST").length, 2);
  assert.equal(calls.filter((x) => x[0] === "PUT").length, 0);
});
test("catalog positioning verifies adjacency and subtree relationships", () => {
  const nodes = [
    { uuid: "p", parent_uuid: "" },
    { uuid: "a", parent_uuid: "p" },
    { uuid: "b", parent_uuid: "p" },
    { uuid: "c", parent_uuid: "p" },
  ];
  assert.equal(positioned(nodes, "b", "a", "moveAfter"), true);
  assert.equal(positioned(nodes, "c", "a", "moveAfter"), false);
  assert.equal(positioned(nodes, "a", "p", "prependChild"), true);
  assert.equal(positioned(nodes, "b", "p", "appendChild"), false);
  assert.equal(subtree(nodes, "p").length, 4);
});
test("server-enriched field options do not hide a changed value", () => {
  assert.equal(
    containsFields(
      { options: [{ id: "a", value: "x", color: "" }] },
      { options: [{ id: "a", value: "x" }] },
    ),
    true,
  );
  assert.equal(
    containsFields(
      { options: [{ id: "a", value: "y", color: "" }] },
      { options: [{ id: "a", value: "x" }] },
    ),
    false,
  );
});
test("Markdown sheet input preserves numeric-looking strings and escaped pipes", () => {
  assert.deepEqual(
    markdownRows("| Code | Value |\n| --- | --- |\n| 001 | a\\|b |"),
    [
      ["Code", "Value"],
      ["001", "a|b"],
    ],
  );
  assert.deepEqual(rowChanges([[1, 2]], 3), { A4: 1, B4: 2 });
});
test("batch rejects all invalid commands before starting any request", async () => {
  let count = 0;
  const r = runtime(async () => {
    count++;
    return ok({});
  });
  await assert.rejects(
    execute(r, {
      name: "batch",
      o: {
        input: [
          {
            id: "a",
            command: "doc create",
            target: "a/b",
            options: { title: "t", body: "x" },
          },
          { id: "b", command: "unknown" },
        ],
      },
    }),
    { code: "COMMAND" },
  );
  assert.equal(count, 0);
});
test("rate limit remains an explicit terminal result without replay", async () => {
  let count = 0;
  const r = runtime(async () => {
    count++;
    return new Response("{}", {
      status: 429,
      headers: { "content-type": "application/json", "retry-after": "60" },
    });
  });
  await assert.rejects(
    r.request("web", "POST", "/api/modules/note/notes/NoteController/index", {
      body: "x",
    }),
    { code: "RATE_LIMIT" },
  );
  assert.equal(count, 1);
  assert.equal(r.pending, null);
});

test("batch positions and copied tree topology cannot pass on membership alone", () => {
  const rows = [
    { uuid: "p", parent_uuid: "" },
    { uuid: "a", parent_uuid: "p" },
    { uuid: "b", parent_uuid: "p" },
    { uuid: "c", parent_uuid: "p" },
  ];
  assert.equal(positionedMany(rows, ["a", "b"], "p", "prependChild"), true);
  assert.equal(positionedMany(rows, ["a", "c"], "p", "prependChild"), false);
  assert.equal(positionedMany(rows, ["a", "b"], "p", "appendChild"), false);
  const tree = [
    { uuid: "p", type: "TITLE", title: "root", parent_uuid: "" },
    { uuid: "a", type: "DOC", title: "child", parent_uuid: "p" },
  ];
  assert.equal(
    sameTree(tree, [
      { uuid: "x", type: "TITLE", title: "root", parent_uuid: "other" },
      { uuid: "y", type: "DOC", title: "child", parent_uuid: "x" },
    ]),
    true,
  );
  assert.equal(
    sameTree(tree, [
      { uuid: "x", type: "TITLE", title: "root", parent_uuid: "other" },
      { uuid: "y", type: "DOC", title: "child", parent_uuid: "other" },
    ]),
    false,
  );
});

test("CLI runs through installed symlinks instead of silently skipping main", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yuque-cli-link-")),
    link = path.join(dir, "yuque.mjs");
  try {
    fs.symlinkSync(
      fileURLToPath(new URL("./yuque.mjs", import.meta.url)),
      link,
    );
    const p = spawnSync(
      process.execPath,
      [link, "url", "parse", "https://www.yuque.com/owner/book"],
      { encoding: "utf8" },
    );
    assert.equal(p.status, 0, p.stderr);
    assert.equal(JSON.parse(p.stdout).data.book, "owner/book");
  } finally {
    fs.unlinkSync(link);
    fs.rmdirSync(dir);
  }
});
