import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fail } from "./core.mjs";
// 仅在调用者明确请求 official 时查最新版，安装固定版本后执行；绝不修改全局 npm。
export function official(
  args,
  { directory = path.resolve(".yuque-tools/official-cli") } = {},
) {
  const dir = path.resolve(directory);
  const npm = (a) => {
    const p = spawnSync("npm", a, {
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
      timeout: 180000,
    });
    if (p.error || p.status !== 0)
      fail(
        "FALLBACK_INSTALL",
        "局部官方 CLI 查询/安装失败；检查 npm registry 和网络。",
      );
    return p.stdout.trim();
  };
  const version = JSON.parse(
    npm(["view", "yuque-open-cli", "dist-tags.latest", "--json"]),
  );
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+[-\w.]*$/.test(version))
    fail("FALLBACK_VERSION", "registry 未返回有效版本。");
  fs.mkdirSync(dir, { recursive: true });
  const pkg = path.join(dir, "node_modules/yuque-open-cli/package.json");
  let installed;
  try {
    installed = JSON.parse(fs.readFileSync(pkg, "utf8")).version;
  } catch {}
  if (installed !== version)
    npm([
      "install",
      "--prefix",
      dir,
      "--no-audit",
      "--no-fund",
      "--ignore-scripts",
      "--save-exact",
      `yuque-open-cli@${version}`,
    ]);
  const meta = JSON.parse(fs.readFileSync(pkg, "utf8")),
    bin =
      typeof meta.bin === "string"
        ? meta.bin
        : meta.bin?.yuque || Object.values(meta.bin || {})[0];
  if (!bin) fail("FALLBACK_BIN", "官方包未提供 CLI 入口。");
  process.stderr.write(
    JSON.stringify({ route: "official-fallback", version, directory: dir }) +
      "\n",
  );
  // 官方 CLI 独立输出，不冒充本工具 verified；Token 仅经环境传递。
  const p = spawnSync(
    process.execPath,
    [path.resolve(path.dirname(pkg), bin), ...args],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        YUQUE_TOKEN:
          process.env.YUQUE_TOKEN || process.env.YUQUE_PERSONAL_TOKEN || "",
      },
    },
  );
  if (p.error) fail("FALLBACK_EXEC", "官方 CLI 启动失败。");
  process.exitCode = p.status ?? 1;
}
