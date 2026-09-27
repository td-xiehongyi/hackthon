import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, test } from 'vitest';

const extensionRoot = 'tools/csu-schedule-extension/';

test('扩展向一键启动的 5176 页面转交课表，并拒绝其他来源', async () => {
  const deliveries: number[] = [];
  let queriedUrls: string[] = [];
  const chrome = {
    runtime: { onMessage: { addListener() {} } },
    tabs: {
      query: async ({ url }: { url: string[] }) => {
        queriedUrls = url;
        return [
          { id: 1, url: 'http://127.0.0.1:5176/#teaching' },
          { id: 2, url: 'http://localhost:5176/#teaching' },
          { id: 3, url: 'https://example.com:5176/#teaching' },
          { id: 4, url: 'http://127.0.0.1:9999/#teaching' },
        ];
      },
      sendMessage: async (id: number) => { deliveries.push(id); },
    },
  };
  const source = readFileSync(`${extensionRoot}background.js`, 'utf8');
  const count = await runInNewContext(`${source}\nrelayToOpenApps({ courses: [] });`, { chrome });
  expect(count).toBe(2);
  expect(deliveries).toEqual([1, 2]);
  expect(queriedUrls).toContain('http://127.0.0.1:5176/*');
  expect(queriedUrls).toContain('http://localhost:5176/*');
});

test('一键启动地址注册扩展内容脚本与主机权限', () => {
  const manifest = JSON.parse(readFileSync(`${extensionRoot}manifest.json`, 'utf8'));
  const appScript = manifest.content_scripts.find((entry: { js: string[] }) => entry.js.includes('app-content.js'));
  for (const host of ['127.0.0.1', 'localhost']) {
    expect(manifest.host_permissions).toContain(`http://${host}:5176/*`);
    expect(appScript.matches).toContain(`http://${host}:5176/*`);
  }
});
