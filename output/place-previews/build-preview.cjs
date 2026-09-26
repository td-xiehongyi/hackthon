const fs = require('node:fs');
const path = require('node:path');
const base = __dirname;
const project = path.resolve(base, '../..');
const embed = (relativePath, mime) => `data:${mime};base64,${fs.readFileSync(path.join(project, relativePath)).toString('base64')}`;
let html = fs.readFileSync(path.join(base, 'preview.template.html'), 'utf8');
html = html.replace('<script src="preview.js"></script>', `<script>\n${fs.readFileSync(path.join(base, 'preview.js'), 'utf8')}\n</script>`);
const images = {
  __MAP_IMAGE__: embed('output/中南大学像素校园-最终地图.png', 'image/png'),
  __TEACHING_IMAGE__: embed('assets/references/xiaoxiang-teaching-a.jpg', 'image/jpeg'),
  __LIBRARY_IMAGE__: embed('assets/references/xiaoxiang-library.jpg', 'image/jpeg'),
  __STADIUM_IMAGE__: embed('assets/references/xiaoxiang-stadium-2026.jpg', 'image/jpeg'),
  __SCENE_TEACHING__: embed('output/place-previews/scenes/teaching.png', 'image/png'),
  __SCENE_LIBRARY__: embed('output/place-previews/scenes/library.png', 'image/png'),
  __SCENE_STADIUM__: embed('output/place-previews/scenes/stadium.png', 'image/png')
};
for (const [token, data] of Object.entries(images)) html = html.replaceAll(token, data);
if (/__(MAP|TEACHING|LIBRARY|STADIUM)_IMAGE__|__SCENE_(TEACHING|LIBRARY|STADIUM)__/.test(html)) throw new Error('Unresolved image placeholder');
const output = path.join(base, '中南大学像素校园-地点交互预览.html');
fs.writeFileSync(output, html, 'utf8');
console.log(JSON.stringify({output, bytes:fs.statSync(output).size, standalone:true}, null, 2));
