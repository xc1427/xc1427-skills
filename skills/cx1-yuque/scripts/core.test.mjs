import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  Client,
  parseCookie,
  safePath,
  importSession,
  loadSession,
  downloadExport,
} from "./core.mjs";
import { prepare } from "./operations.mjs";
import { blank, unpack, pack, patch, coordinates } from "./sheet.mjs";
const cookie =
  "_yuque_session=fixture-session; yuque_ctoken=fixture-csrf; irrelevant=discard";
const session = {
  account: { id: 1, login: "fixture" },
  cookies: parseCookie(cookie),
};
const json = (j, status = 200) =>
  new Response(JSON.stringify(j), {
    status,
    headers: { "content-type": "application/json" },
  });
test("Cookie parser keeps only auth and rejects ambiguous input", () => {
  assert.deepEqual(Object.keys(parseCookie(cookie)), [
    "_yuque_session",
    "yuque_ctoken",
  ]);
  for (const value of [
    "bad",
    cookie + "\nmore=secret",
    cookie + "; yuque_ctoken=duplicate",
    "_yuque_session=only",
  ])
    assert.throws(() => parseCookie(value));
});
test("credentials cannot route off origin or across API modes", () => {
  for (const p of [
    "https://example.com/api/x",
    "//example.com/api/x",
    "/api/../evil",
    "/api/%2e%2e/evil",
    "/api/x#foo",
  ])
    assert.throws(() => safePath(p, "web"));
  assert.throws(() => safePath("/api/v2/user", "web"));
  assert.throws(() => safePath("/api/mine", "open"));
  assert.equal(
    safePath("/api/v2/user", "open"),
    "https://www.yuque.com/api/v2/user",
  );
});
test("web account preflight prevents wrong-account mutations", async () => {
  let calls = 0;
  const c = new Client({
    mode: "web",
    session,
    fetcher: async () => {
      calls++;
      return json({ data: { id: 2, login: "different" } });
    },
  });
  await assert.rejects(c.request("PUT", "/api/docs/1", {}), {
    code: "ACCOUNT_MISMATCH",
  });
  assert.equal(calls, 1);
});
test("redirect, HTML, business errors fail without retry", async () => {
  for (const response of [
    new Response("", { status: 302 }),
    new Response("login", { headers: { "content-type": "text/html" } }),
    json({ success: false }),
    json({ data: { success: false } }),
    json({ error: "secret" }),
  ]) {
    let calls = 0;
    const c = new Client({
      mode: "open",
      token: "fixture",
      fetcher: async () => {
        calls++;
        return response;
      },
    });
    await assert.rejects(c.request("POST", "/api/v2/repos/1/docs", {}));
    assert.equal(calls, 1);
  }
});
test("network failures do not retry mutations or echo transport errors", async () => {
  let calls = 0;
  const c = new Client({
    mode: "open",
    token: "fixture",
    fetcher: async () => {
      calls++;
      throw Error("credential");
    },
  });
  await assert.rejects(
    c.request("PUT", "/api/v2/repos/1/docs/2", {}),
    (e) => e.code === "NETWORK_UNKNOWN" && !e.message.includes("credential"),
  );
  assert.equal(calls, 1);
});
test("multipart leaves boundary generation to fetch and validates session first", async () => {
  const calls = [];
  const c = new Client({
    mode: "web",
    session,
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return json({ data: { id: 1, login: "fixture" } });
    },
  });
  const f = new FormData();
  f.append("file", new Blob(["test"]), "test.txt");
  await c.request("POST", "/api/upload/attach", f);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].init.headers["Content-Type"], undefined);
  assert.equal(calls[1].init.redirect, "manual");
});
test("session import identity failure preserves existing file, successful import private", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yuque-test-"));
  fs.chmodSync(dir, 0o700);
  const file = path.join(dir, "session.json");
  try {
    await importSession(cookie, "fixture", null, {
      file,
      fetcher: async () => json({ data: { id: 1, login: "fixture" } }),
    });
    const before = fs.readFileSync(file, "utf8");
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    assert.equal(loadSession(file).account.id, 1);
    await assert.rejects(
      importSession(cookie, "wrong", null, {
        file,
        fetcher: async () => json({ data: { id: 1, login: "fixture" } }),
      }),
    );
    assert.equal(fs.readFileSync(file, "utf8"), before);
    fs.chmodSync(file, 0o644);
    assert.throws(() => loadSession(file), { code: "SESSION_PERMISSIONS" });
  } finally {
    fs.unlinkSync(file);
    fs.rmdirSync(dir);
  }
});
test("sheet patch preserves unknown workbook/sheet/cell structures outside target", () => {
  const d = unpack(blank([["header"], ["old"]]));
  d.extension = { future: true };
  d.sheet[0].data[0][0].unknown = { x: 1 };
  d.sheet[0].data[1][0].s = 0;
  d.sheet[0].vStore = { style: ["f0"] };
  d.refChain = { keep: true };
  const after = unpack(patch(pack(d), 0, { A2: "new", AA3: 42 }));
  assert.equal(after.sheet[0].data[1][0].v, "new");
  assert.equal(after.sheet[0].data[1][0].s, 0);
  assert.equal(after.sheet[0].data[2][26].v, 42);
  const expected = structuredClone(d);
  expected.sheet[0].data[1][0].v = "new";
  expected.sheet[0].data[2] = { 26: { v: 42 } };
  expected.sheet[0].colCount = 27;
  assert.deepEqual(after, expected);
});
test("sheet refuses ambiguous target cells and invalid references before write", () => {
  const d = unpack(blank([["original"]]));
  d.sheet[0].data[0][0].r = [{ t: 0, e: 3 }];
  assert.throws(() => patch(pack(d), 0, { A1: "new" }), {
    code: "COMPLEX_CELL",
  });
  for (const r of ["A0", "A-1", "1A", "A99999999999"])
    assert.throws(() => coordinates(r));
  assert.throws(() => patch(blank(), 0, { A1: "=SUM(A2:A4)" }), {
    code: "FORMULA",
  });
  assert.throws(() => patch(blank(), -1, { A1: 1 }), { code: "SHEET_INDEX" });
});
test("null clears value without losing style/note", () => {
  const d = unpack(blank([["value"]]));
  d.sheet[0].data[0][0] = { v: "value", s: 1, n: "note" };
  assert.deepEqual(
    unpack(patch(pack(d), 0, { A1: null })).sheet[0].data[0][0],
    { s: 1, n: "note" },
  );
});
test("correct public data-table write envelopes and deletion methods", () => {
  const r = prepare("table.record.remove", {
    docId: 1,
    sheetId: "s",
    viewId: "v",
    recordIds: ["r"],
  });
  assert.equal(r.method, "DELETE");
  assert.deepEqual(r.body.recordIds, ["r"]);
  assert.equal(r.body.type, "GRID");
  assert.throws(() =>
    prepare("table.content.put", {
      docId: 1,
      sheetId: "s",
      recordId: "r",
      content: "wrong",
    }),
  );
  assert.throws(() =>
    prepare("table.view.create", {
      docId: 1,
      sheetId: "s",
      viewId: "v",
      data: { id: "other" },
    }),
  );
});
test("catalog operations require explicit subtree semantics and valid batch position", () => {
  assert.throws(() =>
    prepare("toc.move", {
      book_id: 1,
      target_book_id: 2,
      node_uuid: "n",
      action: "appendChild",
    }),
  );
  assert.throws(() =>
    prepare("toc.batch", {
      book_id: 1,
      node_uuids: ["n"],
      batch_action: "batchCopy",
      target_book_id: 2,
      transfer_action: "bad",
      insert_to_catalog: true,
    }),
  );
  const r = prepare("toc.attach", {
    book_id: 1,
    ids: [2],
    action: "appendChild",
  });
  assert.equal(r.method, "POST");
  assert.equal(r.path, "/api/docs/add_to_catalog");
});

test("export redirect strips auth and rejects HTML downloads", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yuque-download-"));
  const file = path.join(dir, "test.xlsx");
  try {
    let calls = 0;
    const c = new Client({
      mode: "web",
      session,
      fetcher: async (url, init) => {
        calls++;
        if (calls === 1) return json({ data: { id: 1, login: "fixture" } });
        if (calls === 2)
          return new Response("", {
            status: 302,
            headers: {
              location:
                "https://lark-temp.oss-cn-hangzhou.aliyuncs.com/fixture.xlsx",
            },
          });
        assert.equal(init.headers, undefined);
        return new Response(new Uint8Array([80, 75, 3, 4, 0]));
      },
    });
    await downloadExport(c, "/attachments/fixture.xlsx", file, "excel");
    assert.equal(fs.statSync(file).size, 5);
    fs.unlinkSync(file);
    const c2 = new Client({
      mode: "web",
      session,
      fetcher: async (url) =>
        url.endsWith("/api/mine")
          ? json({ data: { id: 1, login: "fixture" } })
          : new Response("<html>login</html>", {
              headers: { "content-type": "text/html" },
            }),
    });
    await assert.rejects(
      downloadExport(c2, "/attachments/fixture.xlsx", file, "excel"),
      { code: "DOWNLOAD_CONTENT" },
    );
    assert.equal(fs.existsSync(file), false);
  } finally {
    fs.rmdirSync(dir);
  }
});
