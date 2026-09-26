/**
 * 本机服务入口。
 *
 *   npm run server:init   首次建立 data/ 下的空公共内容与空相册（已有数据时拒绝）
 *   npm run server        正式启动：图片政策保持 pending（用户尚未确认，D-13）
 *   npm run server:dev    开发联调：启用“开发测试配置”图片政策，启动时醒目提示
 *
 * 只监听 127.0.0.1:8787，端口占用时直接报错，不换端口。
 * 数据目录固定为项目根下的 data/（可用 CSU_DATA_DIR 覆盖，供测试与独立 worktree 使用）。
 */

import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import type { ImagePolicy } from '../src/shared/contracts.ts';
import { buildServer } from './app.ts';
import { ApiFailure } from './errors.ts';
import { Storage } from './storage.ts';

const PROJECT_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DATA_DIR = process.env.CSU_DATA_DIR ? resolve(process.env.CSU_DATA_DIR) : resolve(PROJECT_ROOT, 'data');
const HOST = '127.0.0.1';
const PORT = Number(process.env.CSU_API_PORT ?? 8787);
const WEB_ORIGIN = 'http://127.0.0.1:5173';

/** 开发测试配置：**不是用户确认的图片政策**，仅供联调。 */
export const DEV_TEST_IMAGE_POLICY: ImagePolicy = {
  status: 'configured',
  acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  maxFileBytes: 10 * 1024 * 1024,
  maxAlbumBytes: null,
  maxAlbumCount: null,
};

const args = new Set(process.argv.slice(2));
const storage = new Storage(DATA_DIR);

if (args.has('--init')) {
  try {
    const result = await storage.init();
    console.log(result === 'created' ? `已初始化本机数据目录：${DATA_DIR}` : `数据目录已初始化过，未做改动：${DATA_DIR}`);
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
  process.exit(0);
}

try {
  await storage.open();
} catch (error) {
  console.error(error instanceof ApiFailure ? error.message : `无法打开本机数据目录：${(error as Error).message}`);
  process.exit(1);
}

const devPolicy = args.has('--dev-image-policy');
const app = await buildServer({
  storage,
  imagePolicy: devPolicy ? DEV_TEST_IMAGE_POLICY : { status: 'pending' },
  allowedOrigins: [WEB_ORIGIN],
  // 开发时经 Vite 代理转发，Host 保留为 5173；直连 API 时为 8787。
  allowedHosts: [`${HOST}:5173`, `${HOST}:${PORT}`],
});

try {
  await app.listen({ host: HOST, port: PORT });
} catch (error) {
  console.error(`无法监听 ${HOST}:${PORT}：${(error as Error).message}（端口被占用时请先停止已有服务，不会自动换端口）`);
  process.exit(1);
}
console.log(`本机数据服务已启动：http://${HOST}:${PORT}，数据目录 ${DATA_DIR}`);
console.log(
  devPolicy
    ? '⚠ 图片政策：开发测试配置（JPEG/PNG/WebP，单张 ≤ 10 MB），非用户确认政策，不得写入正式验收结论。'
    : '图片政策：待配置（pending）。相册可读取，上传将返回 IMAGE_POLICY_PENDING。',
);
