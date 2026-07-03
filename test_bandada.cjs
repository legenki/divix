const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err));
  await page.setViewport({ width: 1280, height: 800 });
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[PAGE_${msg.type().toUpperCase()}]`, msg.text());
    }
  });

  await page.goto('http://localhost:3001/divix/', { waitUntil: 'networkidle0' });

  console.log(`Testing bandada...`);
  await page.click(`#tab-bandada`);
  await new Promise(r => setTimeout(r, 10000));
  const sizes = await page.evaluate(() => {
    const el = document.getElementById('bandada-canvas');
    const c = el ? el.querySelector('canvas') : null;
    return {
      cw: el ? el.clientWidth : 0,
      ch: el ? el.clientHeight : 0,
      pw: c ? c.width : 0,
      ph: c ? c.height : 0,
      hasTexture: window.divixState ? !!window.divixState.g.texture.data : false,
      textureW: window.divixState && window.divixState.g.texture.data ? window.divixState.g.texture.data.width : 0,
      isLoadImage: window.divixState ? window.divixState.g.isLoadImage : false,
      cnvShow: window.divixState ? window.divixState.cnv.show : false,
      scale: window.divixState && window.divixState.g.ctx ? Math.min((c.width - (window.innerWidth > 768 ? 340 : 0)) * 0.9 / window.divixState.g.ctx.width, (c.height * 0.9) / window.divixState.g.ctx.height, 1) : 0,
      centerPixel: window.divixState && window.divixState.g.ctx ? Array.from(window.divixState.g.ctx.get(window.divixState.g.ctx.width/2, window.divixState.g.ctx.height/2)) : []
    };
  });
  console.log('SIZES:', sizes);
  await page.screenshot({ path: '/Users/andy/.gemini/antigravity/brain/853399b6-d641-4447-8deb-3c27042ebc33/screenshot_bandada_page.png' });

  await browser.close();
  console.log('Done!');
})();
