// Rendu des vues HURAVA V1 depuis les GLB (Playwright + three.js r128, rendu logiciel).
// Usage : node tools/render.js [out] [vue]   (depuis cad/hurava_v1)
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
(async () => {
  const out = path.resolve(process.argv[2] || 'out'); const only = process.argv[3];
  const tools = __dirname; fs.mkdirSync(path.join(out, 'views'), { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1100 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  const jobs = [['front','closed'],['rear','closed'],['left','closed'],['right','closed'],['top','closed'],['bottom','closed'],
    ['iso','closed'],['iso_open','open90'],['iso_rear','closed'],['exploded','exploded'],['hitch','closed']];
  for (const [v, f] of jobs) {
    if (only && v !== only) continue;
    await p.goto(`file://${tools}/render.html?view=${v}&file=${out}/glb/hurava_v1_${f}.glb`);
    await p.waitForFunction(() => document.title === 'done', { timeout: 180000 });
    await p.screenshot({ path: path.join(out, 'views', `${v}.png`) });
    console.log('vue', v);
  }
  await b.close();
})();
