import test from "node:test";
import assert from "node:assert/strict";
import { Runtime } from "./runtime.mjs";
import { dispatch } from "./commands.mjs";
import { parse } from "./yuque.mjs";
import { saveDoc } from "./documents.mjs";
import { boardCards } from "./resources.mjs";
const session = {
  account: { id: 7, login: "tester" },
  cookies: { _yuque_session: "fixture", yuque_ctoken: "csrf" },
};
const ok = (data) =>
  new Response(JSON.stringify({ data }), {
    headers: { "content-type": "application/json" },
  });
function runtime(handler) {
  return new Runtime({
    sessionLoader: () => session,
    fetcher: async (url, init) => {
      assert.ok(!url.includes("/api/v2"));
      assert.equal(init.headers["X-Auth-Token"], undefined);
      if (url.endsWith("/api/mine")) return ok(session.account);
      return handler(
        new URL(url),
        init,
        init.body ? JSON.parse(init.body) : undefined,
      );
    },
  });
}
const doc = {
  id: 12,
  book_id: 2,
  format: "lake",
  body_lake: "<p>original</p>",
  updated_at: "a",
  draft_version: 0,
};
test("Open route and generic v2 paths are rejected before any network request", async () => {
  let calls = 0;
  const r = runtime(() => {
    calls++;
    return ok({});
  });
  await assert.rejects(r.request("open", "GET", "/api/v2/user"), {
    code: "ROUTE_REMOVED",
  });
  assert.throws(() => parse(["api", "open", "GET", "/api/v2/user"]), {
    code: "COMMAND",
  });
  await assert.rejects(r.request("web", "GET", "/api/v2/user"), {
    code: "PATH",
  });
  assert.equal(calls, 0);
});
test("search preserves related scope and advances p, stops on totalHits", async () => {
  const pages = [];
  const r = runtime((url) => {
    assert.equal(url.searchParams.get("tab"), "related");
    assert.equal(url.searchParams.get("scope"), "/");
    assert.equal(url.searchParams.has("offset"), false);
    const p = Number(url.searchParams.get("p"));
    pages.push(p);
    return ok({
      hits: Array.from({ length: 20 }, (_, i) => ({ id: (p - 1) * 20 + i })),
      totalHits: 40,
    });
  });
  const res = await dispatch(r, "search", "term", { all: true });
  assert.deepEqual(pages, [1, 2]);
  assert.equal(res.data.items.length, 40);
  assert.equal(res.data.complete, true);
  const scoped = runtime((url) => {
    assert.equal(url.searchParams.get("scope"), "owner/book");
    assert.equal(url.searchParams.has("tab"), false);
    return ok({ hits: [], totalHits: 0 });
  });
  await dispatch(scoped, "search", "term", {
    scope: "https://www.yuque.com/owner/book",
  });
});
test("unpublished draft blocks body overwrite before mutation", async () => {
  let writes = 0;
  const r = runtime((url, init) => {
    if (init.method !== "GET") writes++;
    return ok({
      ...doc,
      body_asl: doc.body_lake,
      body_draft_asl: "<p>unsaved work</p>",
    });
  });
  r.doc = async () => ({ ...doc });
  await assert.rejects(
    saveDoc(r, doc, { format: "lake", body: "<p>new</p>" }),
    { code: "CONFLICT" },
  );
  assert.equal(writes, 0);
});
test("successful draft save followed by rejected publish reports partial without replay", async () => {
  const writes = [];
  const r = runtime((url, init) => {
    if (init.method === "GET")
      return ok({
        ...doc,
        body_asl: doc.body_lake,
        body_draft_asl: doc.body_lake,
      });
    writes.push(url.pathname);
    if (url.pathname.endsWith("/publish"))
      return new Response(JSON.stringify({ error: true }), {
        status: 422,
        headers: { "content-type": "application/json" },
      });
    return ok({ id: 12 });
  });
  r.doc = async () => ({ ...doc });
  try {
    await saveDoc(r, doc, { format: "lake", body: "<p>next</p>" });
    assert.fail("must reject");
  } catch (e) {
    assert.equal(r.error(e).status, "partial");
    assert.equal(r.error(e).completed[0].path, "/api/docs/12/content");
  }
  assert.deepEqual(writes, ["/api/docs/12/content", "/api/docs/12/publish"]);
});
test("Markdown create converts before write and verifies converted Lake", async () => {
  const calls = [];
  const lake = '<h1 id="server-generated">heading</h1>';
  const r = runtime((url, init, body) => {
    calls.push([init.method, url.pathname]);
    if (url.pathname === "/api/mine/book_stacks")
      return ok([{ books: [{ id: 2 }] }]);
    if (url.pathname === "/api/docs/convert") {
      assert.deepEqual(body, {
        from: "markdown",
        to: "lake",
        content: "# heading",
      });
      return ok({ content: lake });
    }
    if (init.method === "POST") {
      assert.equal(body.format, "lake");
      assert.equal(body.body_asl, lake);
      return ok({ id: 12 });
    }
    return ok({
      id: 12,
      book_id: 2,
      title: "t",
      format: "lake",
      content: lake,
    });
  });
  const result = await dispatch(r, "doc create", "2", {
    title: "t",
    body: "# heading",
    format: "markdown",
    attach: false,
  });
  assert.equal(result.status, "verified");
  assert.deepEqual(
    calls.filter((x) => x[0] === "POST").map((x) => x[1]),
    ["/api/docs/convert", "/api/docs"],
  );
});
test("HTML update uses document endpoint and verifies exact body", async () => {
  let updated = false;
  const html = {
    ...doc,
    format: "html",
    body_lake: undefined,
    body_html: "<p>old</p>",
    content: "<p>old</p>",
  };
  const r = runtime((url, init, body) => {
    if (init.method === "GET")
      return ok({ ...html, body: "<p>old</p>", body_draft: "" });
    assert.equal(url.pathname, "/api/docs/12");
    assert.equal(body.body, "<p>new</p>");
    updated = true;
    return ok({ id: 12 });
  });
  r.doc = async () => (updated ? { ...html, body_html: "<p>new</p>" } : html);
  const after = await saveDoc(r, html, { format: "html", body: "<p>new</p>" });
  assert.equal(after.body_html, "<p>new</p>");
});
test("whole book collection is locally paginated without looping ignored offsets", async () => {
  let calls = 0;
  const r = runtime((url) => {
    calls++;
    assert.equal(url.searchParams.has("offset"), false);
    return ok(
      Array.from({ length: 3 }, (_, id) => ({
        id,
        user_id: 7,
        slug: String(id),
      })),
    );
  });
  const all = await dispatch(r, "book list", undefined, { all: true });
  assert.equal(all.data.complete, true);
  assert.equal(all.data.items.length, 3);
  assert.equal(calls, 1);
  const page = await dispatch(r, "book list", undefined, {
    offset: 1,
    limit: 1,
  });
  assert.deepEqual(
    page.data.items.map((x) => x.id),
    [1],
  );
  assert.deepEqual(page.data.next, { offset: 2 });
});
test("board update retains unknown card fields and all neighboring Lake markup", async () => {
  const card = {
    id: "board1",
    cardType: "flowchart",
    future: { retain: true },
    src: "https://cdn.example/old.png",
    diagramData: { body: [] },
  };
  const markup =
    '<card type="block" name="board" value="' +
    encodeURIComponent(JSON.stringify(card)) +
    '"></card>';
  let stored =
    '<p id="before">keep</p>' +
    markup +
    '<card name="future" value="opaque"></card><p>after</p>';
  const r = runtime((url, init, body) => {
    if (init.method === "GET")
      return ok({ ...doc, body_asl: stored, body_draft_asl: stored });
    if (url.pathname.endsWith("/content")) stored = body.body_asl;
    return ok({ id: 12 });
  });
  r.doc = async () => ({ ...doc, body_lake: stored });
  const res = await dispatch(r, "resource update", "board1", {
    doc: "12",
    input: { diagramData: { body: [{ id: "new", type: "geometry" }] } },
  });
  assert.equal(res.status, "verified");
  const next = boardCards(stored)[0];
  assert.deepEqual(next.data.future, { retain: true });
  assert.equal(next.data.src, undefined);
  assert.equal(
    stored.replace(next.markup, "CARD"),
    '<p id="before">keep</p>CARD<card name="future" value="opaque"></card><p>after</p>',
  );
});

test("team book identity survives mutation cache invalidation for write readback", async () => {
  let reads = 0;
  const r = runtime((url, init) => {
    if (url.pathname === "/team/library") {
      reads++;
      return new Response(
        'JSON.parse(decodeURIComponent("' +
          encodeURIComponent(
            JSON.stringify({ book: { id: 99, slug: "library" } }),
          ) +
          '"))',
        { headers: { "content-type": "text/html" } },
      );
    }
    if (url.pathname === "/api/docs/12")
      return ok({ id: 12, book_id: 99, format: "lake", content: "<p>ok</p>" });
    assert.fail("must not require personal book stacks");
  });
  const b = await r.book("team/library");
  await r.request("web", "PUT", "/api/docs/12", { title: "updated" });
  const after = await r.doc("12", { book: String(b.id), fresh: true });
  assert.equal(after.book.namespace, "team/library");
  assert.equal(reads, 2);
});

test("other user's libraries combine invitations and public stacks without leaking own or group rows", async () => {
  const r = runtime((url) => {
    if (url.pathname === "/api/books")
      return ok([
        { id: 1, user_id: 7, slug: "mine" },
        { id: 2, user_id: 77, slug: "team" },
      ]);
    if (url.pathname === "/api/mine/collaborate_books")
      return ok([{ id: 3, user_id: 8, slug: "private" }]);
    if (url.pathname === "/api/groups/8/homepage_public")
      return ok([
        { placements: [{ blocks: [{ type: "publicPageBookStack", id: 9 }] }] },
      ]);
    if (url.pathname === "/api/book_stack_maps")
      return ok([
        { id: 4, user_id: 8, slug: "public" },
        { id: 3, user_id: 8, slug: "private" },
      ]);
    assert.fail(url.pathname);
  });
  const result = await dispatch(r, "book list", "8", { all: true });
  assert.deepEqual(
    result.data.items.map((b) => b.id),
    [3, 4],
  );
  assert.equal(result.data.complete, true);
});
