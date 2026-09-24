import http from "node:http";
import { randomBytes } from "node:crypto";
import { importSession, fail, Failure } from "./core.mjs";
export async function receive(login, expiresAt) {
  if (!login) fail("INPUT", "必须指定 --account LOGIN。");
  const nonce = randomBytes(24).toString("hex");
  return new Promise((resolve, reject) => {
    let busy = false;
    const server = http.createServer(async (req, res) => {
      const origin = req.headers.origin;
      if (origin && origin !== "https://www.yuque.com") {
        res.writeHead(403);
        res.end();
        return;
      }
      if (req.url !== `/${nonce}`) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.setHeader("Access-Control-Allow-Origin", "https://www.yuque.com");
      res.setHeader("Access-Control-Allow-Private-Network", "true");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }
      if (req.method !== "POST" || busy) {
        res.writeHead(405);
        res.end();
        return;
      }
      busy = true;
      try {
        let raw = "";
        for await (const chunk of req) {
          raw += chunk;
          if (Buffer.byteLength(raw) > 16384) throw Error("size");
        }
        clearTimeout(timer);
        const result = await importSession(raw, login, expiresAt);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end('{"imported":true}');
        clearTimeout(timer);
        server.close();
        resolve(result);
      } catch (e) {
        res.writeHead(400);
        res.end('{"imported":false}');
        clearTimeout(timer);
        server.close();
        reject(e);
      }
    });
    const timer = setTimeout(() => {
      server.closeAllConnections();
      server.close();
      reject(
        new Failure(
          "SESSION_RECEIVE_TIMEOUT",
          "120 秒内未完成导入；入口已关闭，需要时重新显式启动。",
        ),
      );
    }, 120000);
    server.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    server.listen(0, "127.0.0.1", () =>
      process.stderr.write(
        JSON.stringify({
          receiveUrl: `http://127.0.0.1:${server.address().port}/${nonce}`,
          expiresInSeconds: 120,
          account: login,
        }) + "\n",
      ),
    );
  });
}
