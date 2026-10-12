import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

function run(source, host) {
  const env = { ...process.env, YUQUE_HOST: host };
  delete env.YUQUE_SESSION_FILE;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", source], {
    cwd: new URL(".", import.meta.url),
    env,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test("space credentials stay on their bound host through search and document reads", () => {
  run(`
    import assert from 'node:assert/strict';
    import { Runtime } from './runtime.mjs';
    import { dispatch } from './commands.mjs';
    import { ORIGIN, sessionPath } from './core.mjs';
    assert.equal(ORIGIN, 'https://fixture-space.yuque.com');
    assert.ok(sessionPath().endsWith('/session-fixture-space.yuque.com.json'));
    const requests = [];
    const session = {
      origin: ORIGIN, account: {id: 7, login: 'fixture'},
      cookies: {_yuque_session: 'fixture', yuque_ctoken: 'csrf'}
    };
    const r = new Runtime({sessionLoader: () => session, fetcher: async (url, init) => {
      const u = new URL(url);
      assert.equal(u.origin, ORIGIN);
      requests.push(u);
      assert.equal(init.redirect, 'manual');
      if (u.pathname.startsWith('/api/')) {
        assert.equal(init.headers.Origin, ORIGIN);
        assert.equal(init.headers.Referer, ORIGIN + '/');
      }
      let data;
      if (u.pathname === '/api/mine') data = session.account;
      else if (u.pathname === '/api/zsearch') {
        assert.equal(u.searchParams.get('scope'), 'team/book');
        data = {hits: [{id: 12, title: 'NAS'}], totalHits: 1};
      } else if (u.pathname === '/team/book') {
        const payload = encodeURIComponent(JSON.stringify({book: {id: 2}}));
        return new Response('JSON.parse(decodeURIComponent("' + payload + '"))', {
          headers: {'content-type': 'text/html'}
        });
      } else if (u.pathname === '/api/docs/nas') {
        assert.equal(u.searchParams.get('book_id'), '2');
        data = {id:12, book_id:2, slug:'nas', title:'NAS', format:'lake', content:'<p>正文</p>'};
      } else throw Error('Unexpected request: ' + url);
      return new Response(JSON.stringify({data}), {headers: {'content-type': 'application/json'}});
    }});
    const found = await dispatch(r, 'search', 'nas', {scope: ORIGIN + '/team/book'});
    assert.equal(found.data.items[0].id, 12);
    const read = await dispatch(r, 'doc read', ORIGIN + '/team/book/nas', {format:'lake'});
    assert.equal(read.data.body, '<p>正文</p>');
    assert.equal(read.data.url, ORIGIN + '/team/book/nas');
    assert.equal(requests.filter(u => u.pathname === '/api/mine').length, 1);
  `, "https://fixture-space.yuque.com");
});

test("space selection rejects foreign and legacy main-site sessions before network", () => {
  run(`
    import assert from 'node:assert/strict';
    import {Client, loadSession} from './core.mjs';
    import {parseTarget} from './runtime.mjs';
    import fs from 'node:fs';
    import os from 'node:os';
    import path from 'node:path';
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yuque-space-'));
    const file = path.join(dir, 'session.json');
    try {
      for (const origin of [undefined, 'https://other-space.yuque.com']) {
        const session = {version:1, origin, account:{id:1, login:'fixture'},
          cookies:{_yuque_session:'fixture', yuque_ctoken:'csrf'}};
        fs.writeFileSync(file, JSON.stringify(session), {mode:0o600});
        assert.throws(() => loadSession(file), {code:'SESSION_ORIGIN'});
        assert.throws(() => new Client({session, fetcher:()=>{throw Error('must not fetch')}}),
          {code:'SESSION_ORIGIN'});
      }
      assert.throws(() => parseTarget('https://www.yuque.com/team/book/nas'), {code:'TARGET'});
    } finally { fs.unlinkSync(file); fs.rmdirSync(dir); }
  `, "https://fixture-space.yuque.com");
});

test("host validation rejects credential exfiltration destinations and keeps main-site compatibility", () => {
  run(`
    import assert from 'node:assert/strict';
    import {normalizeOrigin, sessionPath, Client, safePath} from './core.mjs';
    for (const host of ['http://fixture.yuque.com', 'https://yuque.com.evil.test',
      'https://fixture.yuque.com.evil.test', 'https://user@fixture.yuque.com',
      'https://fixture.yuque.com:8443', 'https://fixture.yuque.com/path',
      'https://fixture.yuque.com?x=1', 'https://nested.fixture.yuque.com'])
      assert.throws(() => normalizeOrigin(host), {code:'HOST'});
    assert.ok(sessionPath().endsWith('/session.json'));
    const c = new Client({session:{account:{id:1,login:'fixture'},
      cookies:{_yuque_session:'fixture',yuque_ctoken:'csrf'}}, fetcher:async(url)=>{
        assert.equal(url,'https://www.yuque.com/api/mine');
        return new Response(JSON.stringify({data:{id:1,login:'fixture'}}),
          {headers:{'content-type':'application/json'}});
      }});
    await c.check();
    assert.throws(() => safePath('/api/v2/user','web'), {code:'PATH'});
  `, "https://www.yuque.com");
});

test("empty host defaults to main and invalid host returns a JSON CLI error", () => {
  for (const host of ["", "http://fixture.yuque.com", "https://evil.test"]) {
    const result = spawnSync(process.execPath, ["yuque.mjs", "--help"], {
      cwd: new URL(".", import.meta.url),
      env: { ...process.env, YUQUE_HOST: host, YUQUE_SESSION_FILE: "/unused-fixture" },
      encoding: "utf8",
    });
    if (!host) {
      assert.equal(result.status, 0);
      assert.equal(result.stderr, "");
      assert.match(result.stdout, /YUQUE_HOST/);
    } else {
      assert.equal(result.status, 1);
      assert.equal(result.stdout, "");
      assert.equal(JSON.parse(result.stderr).error, "HOST");
      assert.doesNotMatch(result.stderr, /at |evil\.test/);
    }
  }
});

test("custom session path keeps origin binding and import refuses foreign-file replacement", () => {
  run(`
    import assert from 'node:assert/strict';
    import fs from 'node:fs';
    import os from 'node:os';
    import path from 'node:path';
    import {ORIGIN, importSession, loadSession, sessionPath} from './core.mjs';
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yuque-import-test-'));
    const file = path.join(dir, 'custom.json');
    process.env.YUQUE_SESSION_FILE = file;
    const old = {version:1, account:{id:7,login:'fixture'},
      cookies:{_yuque_session:'fixture',yuque_ctoken:'csrf'}};
    const fetcher = async (url, init) => {
      assert.equal(new URL(url).origin, ORIGIN);
      assert.equal(init.redirect, 'manual');
      return new Response(JSON.stringify({data:old.account}),
        {headers:{'content-type':'application/json'}});
    };
    try {
      assert.equal(sessionPath(), file);
      for (const origin of [undefined, 'https://other-space.yuque.com']) {
        const original = JSON.stringify({...old, origin});
        fs.writeFileSync(file, original, {mode:0o600});
        assert.throws(() => loadSession(), {code:'SESSION_ORIGIN'});
        await assert.rejects(importSession('_yuque_session=fixture; yuque_ctoken=csrf',
          'fixture', undefined, {fetcher}), {code:'SESSION_ORIGIN'});
        assert.equal(fs.readFileSync(file,'utf8'), original);
      }
      fs.unlinkSync(file);
      await importSession('_yuque_session=fixture; yuque_ctoken=csrf',
        'fixture', undefined, {fetcher});
      assert.equal(loadSession().origin, ORIGIN);
      await importSession('_yuque_session=fixture; yuque_ctoken=csrf',
        'fixture', undefined, {fetcher});
      assert.equal(loadSession().account.login, 'fixture');
    } finally { fs.unlinkSync(file); fs.rmdirSync(dir); }
  `, "https://fixture-space.yuque.com");
});

test("receiver accepts space preflight and rejects foreign origins without importing", () => {
  run(`
    import assert from 'node:assert/strict';
    import {receive} from './receiver.mjs';
    import {ORIGIN} from './core.mjs';
    let handler, url, closed = false, imports = 0;
    const server = {
      on(){}, address(){return {port:12345}}, close(){closed = true},
      listen(port, host, callback){ assert.equal(host,'127.0.0.1'); callback(); }
    };
    const completion = receive('fixture', undefined, {
      createServer(fn){handler = fn; return server},
      report(message){url = new URL(JSON.parse(message).receiveUrl).pathname},
      importer:async()=>{imports++; return {verified:true}}
    });
    async function request(origin, method) {
      const res = {headers:{}, setHeader(k,v){this.headers[k]=v},
        writeHead(status){this.status=status}, end(){}};
      const req = {headers:{origin},url,method,
        async *[Symbol.asyncIterator](){yield 'fixture-only'}};
      await handler(req,res);
      return res;
    }
    for (const foreign of ['https://www.yuque.com','https://other-space.yuque.com']) {
      const res = await request(foreign,'POST');
      assert.equal(res.status,403);
      assert.equal(res.headers['Access-Control-Allow-Origin'],undefined);
    }
    const preflight = await request(ORIGIN,'OPTIONS');
    assert.equal(preflight.status,204);
    assert.equal(preflight.headers['Access-Control-Allow-Origin'],ORIGIN);
    assert.equal(imports,0);
    const res = await request(ORIGIN,'POST');
    assert.equal(res.status,200);
    assert.equal(imports,1);
    assert.equal((await completion).verified,true);
    assert.equal(closed,true);
  `, "https://fixture-space.yuque.com");
});

test("space short links and downloads stop foreign redirects and strip auth for OSS", () => {
  run(`
    import assert from 'node:assert/strict';
    import fs from 'node:fs';
    import os from 'node:os';
    import path from 'node:path';
    import {Client, ORIGIN, downloadExport} from './core.mjs';
    import {Runtime} from './runtime.mjs';
    import {dispatch} from './commands.mjs';
    const session = {origin:ORIGIN,account:{id:7,login:'fixture'},
      cookies:{_yuque_session:'fixture',yuque_ctoken:'csrf'}};
    const ok = data => new Response(JSON.stringify({data}),
      {headers:{'content-type':'application/json'}});
    for (const foreign of ['https://www.yuque.com','https://other-space.yuque.com']) {
      const calls = [];
      const r = new Runtime({sessionLoader:()=>session, fetcher:async(url,init)=>{
        calls.push(url); assert.equal(new URL(url).origin,ORIGIN);
        assert.equal(init.redirect,'manual');
        return new URL(url).pathname === '/api/mine' ? ok(session.account) :
          new Response(null,{status:302,headers:{location:foreign+'/team/book/doc'}});
      }});
      await assert.rejects(dispatch(r,'doc read',ORIGIN+'/go/doc/12',{}), {code:'TARGET'});
      assert.equal(calls.length,2);
      const c = await r.webClient();
      await assert.rejects(downloadExport(c,ORIGIN+'/attachments/export','/unused-fixture','lake'),
        {code:'DOWNLOAD_ORIGIN'});
      assert.equal(calls.length,3);
      await assert.rejects(downloadExport(c,foreign+'/attachments/export','/unused-fixture','lake'),
        {code:'DOWNLOAD_ORIGIN'});
      assert.equal(calls.length,3);
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(),'yuque-download-test-'));
    const file = path.join(dir,'export.lake');
    const calls = [];
    const c = new Client({session,fetcher:async(url,init)=>{
      calls.push(url); assert.equal(init.redirect,'manual');
      if(new URL(url).pathname === '/api/mine') return ok(session.account);
      if(new URL(url).origin === ORIGIN) {
        assert.ok(init.headers.Cookie);
        return new Response(null,{status:302,headers:{location:
          'https://lark-temp.oss-cn-hangzhou.aliyuncs.com/fixture'}});
      }
      assert.equal(init.headers,undefined);
      return new Response('<!doctype lake><p>fixture</p>');
    }});
    try {
      await downloadExport(c,ORIGIN+'/team/book/doc/lake',file,'lake');
      assert.equal(calls.length,3);
      assert.equal(fs.readFileSync(file,'utf8'),'<!doctype lake><p>fixture</p>');
    } finally {if(fs.existsSync(file))fs.unlinkSync(file); fs.rmdirSync(dir)}
  `, "https://fixture-space.yuque.com");
});

test("space note URL can be reused and GET batch checks the account once", () => {
  run(`
    import assert from 'node:assert/strict';
    import {ORIGIN} from './core.mjs';
    import {Runtime} from './runtime.mjs';
    import {execute} from './yuque.mjs';
    const session = {origin:ORIGIN,account:{id:7,login:'fixture'},
      cookies:{_yuque_session:'fixture',yuque_ctoken:'csrf'}};
    let checks = 0;
    const r = new Runtime({sessionLoader:()=>session,fetcher:async(url,init)=>{
      assert.equal(new URL(url).origin,ORIGIN);
      assert.equal(init.redirect,'manual');
      let data;
      if(new URL(url).pathname === '/api/mine'){checks++;data=session.account}
      else if(new URL(url).pathname.endsWith('/index')) data = {notes:[{id:12,slug:'fixture'}],has_more:false};
      else data = {id:12,slug:'fixture',content:{source:'<p>fixture</p>'}};
      return new Response(JSON.stringify({data}),{headers:{'content-type':'application/json'}});
    }});
    const result = await execute(r,{name:'batch',o:{input:[
      {id:'first',command:'note get',target:'12'},
      {id:'second',command:'note get',target:'$results.first.data.url'}
    ]}});
    assert.equal(result.data.first.data.url,ORIGIN+'/r/note/fixture');
    assert.equal(result.data.second.data.url,ORIGIN+'/r/note/fixture');
    assert.equal(checks,1);
  `, "https://fixture-space.yuque.com");
});

test("space Markdown export rejects foreign URLs and does not follow redirects", () => {
  run(`
    import assert from 'node:assert/strict';
    import fs from 'node:fs';
    import os from 'node:os';
    import path from 'node:path';
    import {ORIGIN} from './core.mjs';
    import {Runtime} from './runtime.mjs';
    import {exportDocument} from './documents.mjs';
    const dir = fs.mkdtempSync(path.join(os.tmpdir(),'yuque-markdown-test-'));
    const file = path.join(dir,'export.md');
    const session = {origin:ORIGIN,account:{id:7,login:'fixture'},
      cookies:{_yuque_session:'fixture',yuque_ctoken:'csrf'}};
    try {
      for (const foreign of ['https://www.yuque.com','https://other-space.yuque.com']) {
        for (const redirect of [false,true]) {
          let reads = 0;
          const r = new Runtime({sessionLoader:()=>session, fetcher:async(url,init)=>{
            assert.equal(new URL(url).origin,ORIGIN);
            assert.equal(init.redirect,'manual');
            if(new URL(url).pathname.endsWith('/markdown')) {
              reads++;
              return new Response(null,{status:302,headers:{location:foreign+'/team/book/doc/markdown'}});
            }
            const data = new URL(url).pathname === '/api/mine' ? session.account :
              {state:'success',url:(redirect ? ORIGIN : foreign)+'/team/book/doc/markdown'};
            return new Response(JSON.stringify({data}),{headers:{'content-type':'application/json'}});
          }});
          await assert.rejects(exportDocument(r,{id:12},'markdown',file),
            {code:redirect ? 'DOWNLOAD_CONTENT' : 'DOWNLOAD_ORIGIN'});
          assert.equal(reads,redirect ? 1 : 0);
          assert.equal(fs.existsSync(file),false);
        }
      }
    } finally {fs.rmdirSync(dir)}
  `, "https://fixture-space.yuque.com");
});
