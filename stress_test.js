import puppeteer from 'puppeteer';
import fs from 'fs';

const workspace = process.argv[2];
if (!workspace) {
  console.error("Please provide a workspace name (e.g. divix, difuso).");
  process.exit(1);
}

const logs = [];

async function runStressTest() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      logs.push(`[${msg.type().toUpperCase()}] ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    logs.push(`[PAGE_ERROR] ${err.stack || err.toString()}`);
  });

  try {
    await page.goto(`http://localhost:3000/divix/src/${workspace}/`, { waitUntil: 'networkidle0', timeout: 15000 });
    
    // Give p5.js time to initialize fully
    await new Promise(r => setTimeout(r, 2000));
    
    // Aggressively find and interact with controls in a loop for ~10 seconds
    console.log(`Starting stress test on ${workspace}...`);
    
    for (let i = 0; i < 20; i++) {
      await page.evaluate(() => {
        // Collect all interactive elements in the active app's sidebar
        const activeContainer = document.querySelector('.app-view.active .sidebar-content');
        if (!activeContainer) return;
        const buttons = Array.from(activeContainer.querySelectorAll('button:not([disabled])'));
        const inputs = Array.from(activeContainer.querySelectorAll('input:not([disabled])'));
        const selects = Array.from(activeContainer.querySelectorAll('select:not([disabled])'));
        
        // Randomly pick a few buttons to click
        for (let j = 0; j < 3; j++) {
          if (buttons.length > 0) {
            const btn = buttons[Math.floor(Math.random() * buttons.length)];
            btn.click();
          }
        }
        
        // Randomly change a few input values (sliders, numbers, colors)
        for (let j = 0; j < 5; j++) {
          if (inputs.length > 0) {
            const inp = inputs[Math.floor(Math.random() * inputs.length)];
            if (inp.type === 'range' || inp.type === 'number') {
              const min = parseFloat(inp.min) || 0;
              const max = parseFloat(inp.max) || 100;
              const step = parseFloat(inp.step) || 1;
              const randomVal = min + Math.random() * (max - min);
              // snap to step
              const snapped = Math.round(randomVal / step) * step;
              inp.value = snapped;
            } else if (inp.type === 'color') {
              inp.value = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
            } else if (inp.type === 'file') {
              // cannot programmatically set value of file input
              continue;
            } else if (inp.type === 'checkbox') {
              inp.checked = !inp.checked;
            } else {
              inp.value = Math.random().toString(36).substring(7);
            }
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            inp.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
        
        // Randomly change select values
        for (let j = 0; j < 2; j++) {
          if (selects.length > 0) {
            const sel = selects[Math.floor(Math.random() * selects.length)];
            if (sel.options.length > 0) {
              const opt = sel.options[Math.floor(Math.random() * sel.options.length)];
              sel.value = opt.value;
              sel.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        }
      });
      
      // Wait a bit before next barrage
      await new Promise(r => setTimeout(r, 500));
    }

    console.log(`Finished stress test on ${workspace}`);
  } catch (e) {
    logs.push(`[LOAD_ERROR] ${e.toString()}`);
  } finally {
    await browser.close();
    fs.writeFileSync(`stress_log_${workspace}.json`, JSON.stringify(logs, null, 2));
    console.log(`Logs saved for ${workspace}`);
  }
}

runStressTest();
