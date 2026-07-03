const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[PAGE_${msg.type().toUpperCase()}]`, msg.text());
    }
  });

  const tools = ['divix', 'difuso', 'deriva', 'sondeo', 'bandada', 'clon'];

  await page.goto('http://localhost:3001/divix/', { waitUntil: 'networkidle0' });

  for (const tool of tools) {
    console.log(`Testing ${tool}...`);
    // Click the tab
    await page.click(`#tab-${tool}`);
    // Wait for canvas to render
    await new Promise(r => setTimeout(r, 2000));
    // Save screenshot
    await page.screenshot({ path: `/Users/andy/.gemini/antigravity/brain/853399b6-d641-4447-8deb-3c27042ebc33/screenshot_${tool}_fix.png` });
  }

  await browser.close();
  console.log('Done!');
})();
