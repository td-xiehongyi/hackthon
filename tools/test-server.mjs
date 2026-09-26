import { mkdirSync, mkdtempSync } from 'node:fs';
import path from 'node:path';

// 每次浏览器测试使用新的目录，绝不读写 data/ 或其他开发目录。
const root = path.resolve('.cache');
mkdirSync(root, { recursive: true });
process.env.CAMPUS_DATA_ROOT = mkdtempSync(path.join(root, 'e2e-'));
process.env.CAMPUS_PORT = '8788';
process.env.CAMPUS_ALLOWED_ORIGINS = 'http://127.0.0.1:5175,http://127.0.0.1:8788';
process.env.CAMPUS_IMAGE_POLICY = 'dev';
await import('../server/index.ts');
