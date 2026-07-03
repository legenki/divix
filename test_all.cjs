// test_all.cjs — Automated console error checker for all workspaces.
const puppeteer = require('puppeteer');

const WORKSPACES = ['divix', 'difuso', 'bandada', 'deriva', 'sondeo', 'clon'];
const BASE_URL = 'http://localhost:3001/divix/';
const WAIT_MS = 8000;
const SCREENSHOT_DIR = '/Users/andy/.gemini/antigravity/brain/853399b6-d641-4447-8deb-3c27042ebc33';

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  const allLogs = {};
  const allErrors = {};

  page.on('console', (msg) => {
    const ws = page.__currentWS || 'unknown';
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      if (!allErrors[ws]) allErrors[ws] = [];
      allErrors[ws].push(`[${type.toUpperCase()}] ${msg.text()}`);
    }
  });

  page.on('pageerror', (err) => {
    const ws = page.__currentWS || 'unknown';
    if (!allErrors[ws]) allErrors[ws] = [];
    allErrors[ws].push(`[EXCEPTION] ${err.message}`);
  });

  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));

  for (const ws of WORKSPACES) {
    page.__currentWS = ws;
    if (!allErrors[ws]) allErrors[ws] = [];
    console.log(`\n=== Testing: ${ws} ===`);

    await page.click(`#tab-${ws}`);
    await new Promise(r => setTimeout(r, WAIT_MS));

    // Take screenshot
    const ssPath = `${SCREENSHOT_DIR}/test_${ws}.png`;
    await page.screenshot({ path: ssPath });
    console.log(`  Screenshot: ${ssPath}`);

    // Check canvas and state
    const info = await page.evaluate((wsName) => {
      const el = document.getElementById(`${wsName}-canvas`);
      const c = el ? el.querySelector('canvas') : null;
      const info = {
        hasContainer: !!el,
        hasCanvas: !!c,
        canvasW: c ? c.width : 0,
        canvasH: c ? c.height : 0,
        clientW: el ? el.clientWidth : 0,
        clientH: el ? el.clientHeight : 0,
      };
      return info;
    }, ws);

    console.log(`  Canvas info:`, JSON.stringify(info));

    if (allErrors[ws].length > 0) {
      console.log(`  ERRORS/WARNINGS:`);
      allErrors[ws].forEach(e => console.log(`    ${e}`));
    } else {
      console.log(`  No errors.`);
    }
  }

  await browser.close();
  
  console.log('\n\n=== SUMMARY ===');
  for (const ws of WORKSPACES) {
    const errs = allErrors[ws] || [];
    const status = errs.length === 0 ? '✓ OK' : `✗ ${errs.length} error(s)`;
    console.log(`  ${ws}: ${status}`);
    if (errs.length > 0) {
      errs.forEach(e => console.log(`    ${e}`));
    }
  }
})().catch(console.error);
