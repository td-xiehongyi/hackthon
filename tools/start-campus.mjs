import { createHash } from 'node:crypto';
import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = realpathSync(fileURLToPath(new URL('..', import.meta.url)));
const port = 5176;
const apiPort = 8789;
const url = `http://127.0.0.1:${port}/`;
const identityPath = '/__campus_launcher';
const project = createHash('sha256').update(root.toLowerCase()).digest('hex');
const identity = { project, pid: process.pid, apiPort };
const noOpen = process.argv.includes('--no-open');
const checkOnly = process.argv.includes('--check');
let api;
let frontend;
let closing = false;

async function readIdentity(base) {
  try {
    const response = await fetch(new URL(identityPath, base), { signal: AbortSignal.timeout(1500) });
    return response.ok ? await response.json() : null;
  } catch { return null; }
}

function openBrowser() {
  if (noOpen || checkOnly) return;
  const browser = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], {
    detached: true, stdio: 'ignore', windowsHide: true,
  });
  browser.on('error', () => console.log(`浏览器未能自动打开，请手动访问 ${url}`));
  browser.unref();
}

async function close() {
  if (closing) return;
  closing = true;
  await frontend?.close();
  await api?.close();
}

async function main() {
  if (Number(process.versions.node.split('.')[0]) !== 24) {
    throw new Error(`需要 Node.js 24，当前为 ${process.versions.node}。请安装 Node.js 24 后重试。`);
  }
  process.chdir(root);
  if (!existsSync(path.join(root, 'node_modules/vite/package.json')) ||
      !existsSync(path.join(root, 'node_modules/fastify/package.json'))) {
    throw new Error(`尚未安装项目依赖。请在此目录打开终端执行 npm ci：\n${root}`);
  }

  const [current, backend] = await Promise.all([
    readIdentity(url), readIdentity(`http://127.0.0.1:${apiPort}/`),
  ]);
  if (current?.project === project && backend?.project === project &&
      current.pid === backend.pid && current.apiPort === apiPort) {
    console.log(`本项目已经运行：${url}`);
    openBrowser();
    return;
  }
  if (checkOnly) throw new Error('本项目尚未由一键脚本启动，或两个服务未同时就绪。');

  // 固定到当前 checkout，不继承其他项目的端口、数据目录或图片测试政策。
  process.env.CAMPUS_API_PORT = String(apiPort);
  const [{ buildApp }, { loadConfig }, { createServer }] = await Promise.all([
    import('../server/app.ts'), import('../server/config.ts'), import('vite'),
  ]);
  api = buildApp(loadConfig({
    CAMPUS_HOST: '127.0.0.1', CAMPUS_PORT: String(apiPort),
    CAMPUS_DATA_ROOT: path.join(root, 'data'),
    CAMPUS_ALLOWED_ORIGINS: `${url.slice(0, -1)},http://127.0.0.1:${apiPort}`,
  }));
  api.get(identityPath, async () => identity);
  await api.listen({ host: '127.0.0.1', port: apiPort });

  frontend = await createServer({
    root,
    server: { host: '127.0.0.1', port, strictPort: true },
    plugins: [{
      name: 'campus-launcher-identity',
      configureServer(server) {
        server.middlewares.use(identityPath, (_request, response) => {
          response.setHeader('Content-Type', 'application/json');
          response.setHeader('Cache-Control', 'no-store');
          response.end(JSON.stringify(identity));
        });
      },
    }],
  });
  await frontend.listen();
  console.log(`\n中南大学像素校园已启动\n\n校园地图：${url}\n交互测试：${url}?scene=dev-playground\n数据目录：${path.join(root, 'data')}\n\n图片上传政策尚未配置，暂不可上传。\n保留此窗口；按 Ctrl+C 或关闭此窗口停止服务。\n`);
  openBrowser();
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGBREAK']) {
    process.once(signal, () => { void close().then(() => process.exit(0)); });
  }
}

main().catch(async (error) => {
  console.error(`\n启动失败：${error.message}`);
  if (error.code === 'EADDRINUSE' || /port.*in use/i.test(error.message)) {
    console.error(`端口 ${port} 或 ${apiPort} 已被其他服务占用。请先关闭对应服务，再双击启动；脚本不会结束其他程序。`);
  }
  await close();
  process.exitCode = 1;
});
