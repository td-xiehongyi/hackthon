import {defineConfig} from '@playwright/test';
import {fileURLToPath} from 'node:url';
export default defineConfig({
 testDir:fileURLToPath(new URL('../../../../tests/e2e/',import.meta.url)),
 testMatch:'added-characters.spec.ts',workers:1,
 outputDir:fileURLToPath(new URL('./live-browser-results/',import.meta.url)),
 use:{baseURL:'http://127.0.0.1:5215',channel:'msedge',viewport:{width:1440,height:1000}},
 reporter:[['list'],['json',{outputFile:fileURLToPath(new URL('./home-verification.json',import.meta.url))}]],
});
