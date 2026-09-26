import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, test } from 'vitest';

test('重新生成保留人工修正与地点数据，结果可复现；错版规则拒绝覆盖产物', () => {
  const temporaryRoot = realpathSync(tmpdir());
  const fixture = mkdtempSync(join(temporaryRoot, 'campus-navigation-'));
  const root = resolve('.');
  const policyPath = join(fixture, 'assets/maps/campus-v20.navigation.json');
  const annotationPath = join(fixture, 'public/maps/campus-v20.annotations.json');
  const run = (script: string) => execFileSync(process.execPath, [join(root, 'tools/map', script)], { cwd: fixture, stdio: 'pipe' });
  try {
    mkdirSync(join(fixture, 'assets/maps'), { recursive: true });
    mkdirSync(join(fixture, 'public/maps'), { recursive: true });
    for (const file of ['assets/maps/campus-v20.navigation.json', 'public/maps/campus-v20.png', 'public/maps/campus-v20.annotations.json']) {
      copyFileSync(join(root, file), join(fixture, file));
    }
    const annotation = JSON.parse(readFileSync(annotationPath, 'utf8'));
    annotation.safePoints = [{ id: 'fixture-spawn', position: { x: 520, y: 780 }, usage: ['spawn'], verificationStatus: 'pending' }];
    annotation.collisionAreas = [{ id: 'fixture-block', reason: '保留后续手工标注', polygon: [{ x: 5, y: 5 }, { x: 10, y: 5 }, { x: 10, y: 10 }, { x: 5, y: 10 }] }];
    writeFileSync(annotationPath, JSON.stringify(annotation));
    run('extract-walkable.mjs');
    run('build-annotation.mjs');
    const result = JSON.parse(readFileSync(annotationPath, 'utf8'));
    expect(result.walkableAreas).toEqual(annotation.walkableAreas);
    for (const field of ['collisionAreas', 'safePoints', 'buildings', 'interactions', 'occluders', 'landmarks']) {
      expect(result[field], field).toEqual(annotation[field]);
    }
    const products = ['assets/maps/campus-v20.walkable.png', 'assets/maps/campus-v20.walkable-check.png', 'public/maps/campus-v20.annotations.json'];
    const before = products.map((p) => readFileSync(join(fixture, p)));
    run('extract-walkable.mjs');
    run('build-annotation.mjs');
    products.forEach((p, i) => expect(readFileSync(join(fixture, p)).equals(before[i]!)).toBe(true));

    const policy = JSON.parse(readFileSync(policyPath, 'utf8'));
    policy.imageSha256 = 'wrong-map';
    writeFileSync(policyPath, JSON.stringify(policy));
    expect(() => run('extract-walkable.mjs')).toThrow(/通行修正规则与底图不匹配/);
    products.forEach((p, i) => expect(readFileSync(join(fixture, p)).equals(before[i]!)).toBe(true));
  } finally {
    // 只清理由本测试创建、位于系统临时目录下的独立夹具。
    const resolvedFixture = realpathSync(fixture);
    if (!resolvedFixture.startsWith(temporaryRoot + sep) || !resolvedFixture.startsWith(join(temporaryRoot, 'campus-navigation-'))) {
      throw new Error('拒绝清理临时目录范围之外的路径');
    }
    rmSync(resolvedFixture, { recursive: true, force: true });
  }
}, 20_000);
