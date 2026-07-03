const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`[PAGE_${msg.type().toUpperCase()}]`, msg.text());
  });

  await page.goto('http://localhost:3001/divix/src/deriva/', { waitUntil: 'networkidle0' });

  await new Promise(r => setTimeout(r, 4000));

  const debugInfo = await page.evaluate(() => {
    return {
      w: window.innerWidth,
      h: window.innerHeight,
      cnvShow: window.divixState ? window.divixState.cnv.show : 'no-state',
      hasCtx: window.divixState ? !!window.divixState.g.ctx : false,
      ctxW: window.divixState && window.divixState.g.ctx ? window.divixState.g.ctx.width : 0,
      hasTexture: window.divixState ? !!window.divixState.g.texture.data : false,
      textureW: window.divixState && window.divixState.g.texture.data ? window.divixState.g.texture.data.width : 0,
      rendering: window.divixState ? window.divixState.form.rendering : 'none'
    };
  });

  console.log('DEBUG INFO:', debugInfo);

  await browser.close();
})();
