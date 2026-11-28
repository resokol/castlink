'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ui = path.join(__dirname, '../ui');
test('vMix panel keeps scripts and styles external under its local CSP', () => {
  const html = fs.readFileSync(path.join(ui, 'vmix-outputs.html'), 'utf8');
  assert.match(html, /default-src 'none'; script-src 'self'; style-src 'self'/);
  assert.doesNotMatch(html, /\bon\w+=|<style\b|\bstyle=/i);
  assert.match(html, /<script src="vmix-outputs.js"><\/script>/);
});

let chromium;
try { ({chromium} = require(process.env.CASTLINK_QA_PLAYWRIGHT || 'playwright')); } catch {}
const executablePath = process.env.CASTLINK_QA_CHROMIUM_BINARY || '/usr/bin/chromium';
test('vMix panel uses real slots, safe receiver metadata, native IPC and stable status updates', {skip:!chromium || !fs.existsSync(executablePath)}, async () => {
  const browser = await chromium.launch({executablePath, headless:true, args:['--no-sandbox']});
  try {
    const page = await browser.newPage({viewport:{width:1000,height:900},colorScheme:'dark'});
    await page.route('http://127.0.0.1:19876/**', async route => {
      const relative = new URL(route.request().url()).pathname;
      const file = path.join(__dirname, '..', relative);
      const contentType = file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : 'text/html';
      await route.fulfill({contentType,body:fs.readFileSync(file)});
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.__calls = [];
      window.castlinkVmix = {
        initial:async () => ({locale:'en',slots:Array.from({length:5}, (_,i) => ({id:'slot-'+i,name:'Caster '+(i+1),nativeName:'CastLink-native-'+i})),assignments:{'slot-0':'Caster name 0','slot-1':'Caster name 1'},paths:{srt:'C:\\tools\\ffmpeg.exe'},running:false,statuses:{}}),
        pick:async mode => { window.__calls.push({pick:mode}); return 'C:\\runtime\\'+mode+(mode==='relay'?'.exe':'.dll'); },
        start:async config => { window.__calls.push({start:config}); return window.__startFailure ? {ok:false,error:'secret-do-not-echo'} : {ok:true}; },
        stop:async () => { window.__calls.push({stop:true}); },
        onStatus:listener => { window.__status = listener; return () => {}; }
      };
    });
    await page.goto('http://127.0.0.1:19876/ui/vmix-outputs.html');
    await page.waitForFunction(() => typeof window.__status === 'function');
    assert.equal(await page.locator('.slot-row').count(),5);
    assert.equal(await page.locator('.slot-identity input:checked').count(),3,'the default group includes an empty third slot');
    assert.equal(await page.locator('#receiver-help').innerText(),'In vMix, open Add Input → Stream / SRT and select SRT (Caller).');
    await page.locator('#advanced').evaluate(el => {el.open=true;});
    await page.locator('#passphrase').fill('private-password');
    await page.locator('.stream-field input').first().fill('private-stream-id');
    const metadata = await page.locator('.receiver-field').allInnerTexts();
    assert.ok(metadata.every(text => !text.includes('private-password') && !text.includes('private-stream-id')));
    await page.locator('#toggle').click();
    const config = await page.evaluate(() => __calls.find(call => call.start).start);
    assert.deepEqual(config.slots.map(slot=>slot.id),['slot-0','slot-1','slot-2']);
    assert.equal(config.srt.passphrase,'private-password');
    assert.equal(config.slots[0].streamId,'private-stream-id');
    assert.equal(config.fps,30);
    assert.equal(await page.locator('#protocol').isDisabled(),true);
    await page.evaluate(() => {window.__sourceNode=document.querySelector('.source-field select'); __sourceNode.focus(); __status({running:true,statuses:{'slot-0':'source','slot-1':{state:'revoked'}},assignments:{'slot-0':'Replacement caster','slot-1':null}});});
    assert.equal(await page.locator('.status').first().innerText(),'Source available');
    assert.equal(await page.locator('.assignment').first().innerText(),'Replacement caster');
    assert.equal(await page.locator('.assignment').nth(1).innerText(),'No caster assigned');
    assert.equal(await page.locator('.receiver-name').first().innerText(),'CastLink — Caster 1');
    assert.equal(await page.evaluate(() => document.querySelector('.source-field select')===__sourceNode),true);
    await page.locator('#toggle').click();
    assert.equal(await page.evaluate(() => __calls.at(-1).stop),true);
    await page.locator('#srt-mode').selectOption('caller');
    assert.match(await page.locator('#receiver-help').innerText(),/SRT \(Listener\)/);
    await page.locator('#srt-mode').selectOption('rendezvous');
    assert.match(await page.locator('#receiver-help').innerText(),/SRT \(Rendezvous\)/);
    await page.locator('#local-address').fill('10.0.0.12');
    assert.match(await page.locator('.receiver-meta').first().innerText(),/10\.0\.0\.12:9001/);
    await page.locator('#pick-relay').click();
    assert.equal(await page.locator('#relay-path').innerText(),'C:\\runtime\\relay.exe');
    await page.locator('.slot-identity input').nth(2).check();
    await page.locator('.slot-identity input').nth(3).check();
    await page.locator('.slot-identity input').nth(4).click();
    assert.equal(await page.locator('.slot-identity input:checked').count(),4);
    assert.equal(await page.locator('#error').innerText(),'Choose 1–4 slots.');
    await page.locator('.port-field input').nth(1).fill('9001');
    const callsBefore = await page.evaluate(() => __calls.length);
    await page.locator('#toggle').click();
    assert.match(await page.locator('#error').innerText(),/distinct whole UDP ports/);
    assert.equal(await page.evaluate(() => __calls.length),callsBefore);
    await page.locator('#protocol').selectOption('omt');
    await page.locator('#toggle').click();
    assert.match(await page.locator('#error').innerText(),/Choose a component file/);
    await page.locator('#pick-runtime').click();
    assert.equal(await page.locator('#runtime-path').innerText(),'C:\\runtime\\omt.dll');
    await page.evaluate(() => {window.__startFailure=true;});
    await page.locator('#toggle').click();
    assert.match(await page.locator('#error').innerText(),/Could not start outputs/);
    assert.doesNotMatch(await page.locator('body').innerText(),/secret-do-not-echo/);
    await page.locator('#protocol').selectOption('ndi');
    assert.equal(await page.locator('#runtime-path').innerText(),'Automatic discovery');
    assert.equal(await page.locator('.receiver-name').first().innerText(),'CastLink-native-0');
    for (const locale of ['ru','en','zh-CN']) {
      await page.locator('#locale').selectOption(locale);
      assert.equal(await page.locator('html').getAttribute('lang'),locale);
      for (const width of [320,768,1024,1440]) {
        await page.setViewportSize({width,height:900});
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth),true,locale+' has no horizontal overflow at '+width);
      }
    }
    await page.locator('#theme').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
    await page.locator('#locale').selectOption('en');
    await page.setViewportSize({width:1000,height:900});
    await page.locator('#protocol').selectOption('srt');
    await page.locator('#srt-mode').selectOption('listener');
    await page.locator('.port-field input').nth(1).fill('9002');
    if (process.env.CASTLINK_QA_SCREENSHOT_DIR) {
      await page.screenshot({path:path.join(process.env.CASTLINK_QA_SCREENSHOT_DIR,'vmix-outputs-light.png'),fullPage:true});
      await page.locator('#theme').click();
      await page.locator('#advanced').evaluate(el => {el.open=false;});
      await page.locator('.runtime-settings').evaluate(el => {el.open=false;});
      await page.screenshot({path:path.join(process.env.CASTLINK_QA_SCREENSHOT_DIR,'vmix-outputs-dark.png'),fullPage:true});
      await page.setViewportSize({width:320,height:900});
      await page.locator('#locale').selectOption('ru');
      await page.screenshot({path:path.join(process.env.CASTLINK_QA_SCREENSHOT_DIR,'vmix-outputs-mobile.png'),fullPage:true});
      await page.locator('#locale').selectOption('en');
    }
    assert.deepEqual(errors,[]);
    await page.evaluate(() => __status({running:false,slots:[],statuses:{}}));
    assert.match(await page.locator('#notice').innerText(),/No studio slots yet/);
    assert.equal(await page.locator('#toggle').isDisabled(),true);
  } finally { await browser.close(); }
});
