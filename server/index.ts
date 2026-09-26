import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';

const config = loadConfig();
const app = buildApp(config);

if (config.imagePolicy === 'configured') {
  console.warn('[campus-server] 开发测试配置：图片政策由环境变量启用（非用户确认政策）。');
}

app
  .listen({ port: config.port, host: config.host })
  .then(() => {
    console.log(`[campus-server] 本机数据服务已启动：http://${config.host}:${config.port}`);
  })
  .catch((err: Error) => {
    console.error('[campus-server] 启动失败（端口占用或配置错误）：', err.message);
    process.exit(1);
  });
