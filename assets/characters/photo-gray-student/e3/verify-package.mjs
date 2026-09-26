import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { decodePng } from '../../../../tools/map/png.mjs';
import { validateManifest } from '../../../../src/game/character/manifest.ts';

const dir = new URL('./', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', dir), 'utf8'));
const errors = validateManifest(manifest);
if (errors.length) throw Error(errors.join('; '));
if (manifest.characterId !== 'photo-gray-student') throw Error('Unexpected character identity');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const images = new Map();
const sources = [];
for (const filename of ['walk-cycle.png', 'ride-cycle.png', 'manifest.json']) {
  const bytes = readFileSync(new URL(filename, dir));
  const original = readFileSync(new URL('../e2/' + filename, dir));
  const matchesApprovedE2 = sha(bytes) === sha(original);
  if (!matchesApprovedE2) throw Error(filename + ' differs from approved E2');
  sources.push({ filename, bytes: bytes.length, sha256: sha(bytes), matchesApprovedE2 });
}
const pngChecks = manifest.sheets.map(sheet => {
  const im = decodePng(readFileSync(new URL(sheet.url, dir)));
  if (im.width !== sheet.width || im.height !== sheet.height || im.channels !== 4) throw Error('PNG mismatch');
  images.set(sheet.id, im);
  let transparent = 0, partial = 0, opaque = 0;
  for (let p = 3; p < im.data.length; p += 4) {
    const a = im.data[p];
    if (a === 0) transparent++; else if (a === 255) opaque++; else partial++;
  }
  if (!transparent) throw Error('PNG lacks transparent background');
  return { file: sheet.url, width: im.width, height: im.height, transparent, partial, opaque };
});
const states = manifest.clips.map(clip => {
  const frames = clip.frames.map(f => {
    const im = images.get(f.sheetId), r = f.rect;
    let pixels = 0, edgePixels = 0;
    for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) {
      if (im.data[((r.y+y)*im.width+r.x+x)*4+3] > 180) {
        pixels++;
        if (x===0 || y===0 || x===r.width-1 || y===r.height-1) edgePixels++;
      }
    }
    if (!pixels || edgePixels) throw Error('Empty or clipped frame');
    return { subjectPixels: pixels, edgePixels, anchor: f.anchor, durationMs: f.durationMs };
  });
  return { mode: clip.mode, facing: clip.facing, action: clip.action, frames };
});
const report = {
  stage: 'E3', version: '0.3.0-rc.1', status: 'integration-candidate',
  manifestProblems: errors, stateCount: states.length,
  frameReferences: states.reduce((n,s)=>n+s.frames.length,0), sources, pngChecks, states,
  limitations: ['Weak alpha edges retained from approved E2.', 'Visual ground jitter and real map occlusion require integration review.', 'No homepage or selection-menu integration.'],
};
writeFileSync(new URL('package-check.json', dir), JSON.stringify(report,null,2)+'\n');
const files = ['walk-cycle.png','ride-cycle.png','manifest.json','SOURCE.md','PROMPTS.md'];
const checksums = files.map(file => ({ file, sha256: sha(readFileSync(new URL(file,dir))) }));
writeFileSync(new URL('VERSION.json',dir), JSON.stringify({
  characterId:manifest.characterId,version:report.version,status:report.status,
  appearanceApproved:true,animationSampleApproved:true,fullAcceptance:false,
  recommendedUniformScale:0.10,files:checksums,
},null,2)+'\n');
console.log(JSON.stringify({states:report.stateCount,frameReferences:report.frameReferences,
  matchedApprovedFiles:sources.length,pngChecks,status:report.status}));
