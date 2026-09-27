import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';

const config = loadConfig();
const app = buildApp(config);

if (config.imagePolicy === 'configured') {
  console.log(`[campus-server] 地点相册已启用，单张最大 ${config.maxFileBytes / 1024 / 1024} MB，照片保存在本机。`);
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
