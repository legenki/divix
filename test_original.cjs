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

  const tools = [
    { name: 'bandada', url: 'https://antlii.github.io/boids-tool/' },
    { name: 'sondeo', url: 'https://antlii.github.io/skaaan-tool/' },
    { name: 'clon', url: 'https://antlii.github.io/klon-tool/' }
  ];

  for (const t of tools) {
    console.log(`Testing original ${t.name}...`);
    await page.goto(t.url, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 4000));
    await page.screenshot({ path: `/Users/andy/.gemini/antigravity/brain/853399b6-d641-4447-8deb-3c27042ebc33/${t.name}_original_fix.png` });
  }

  await browser.close();
  console.log('Done!');
})();
