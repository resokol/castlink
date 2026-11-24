// Actual StatisticsDashboard, browser download and responsive controls; API uses explicit fixtures.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {chromium}=require(process.env.CASTLINK_QA_PLAYWRIGHT||'playwright');
const {build}=require(process.env.CASTLINK_QA_ESBUILD||'esbuild');
const web=path.resolve(__dirname,'..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-video-browser-'));
let server,browser,mode='complete';const requests=[];
(async()=>{try{
 await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{StatisticsDashboard}from'./components/StatisticsDashboard';import{I18nProvider}from'./components/I18nProvider';createRoot(document.getElementById('root')).render(<I18nProvider><main className="graphite-page"><StatisticsDashboard roomName="CS" studioId="tenant" identity="studio-panel-main" studioRole="primary" studioClientId="test" studioEpoch={1}/></main></I18nProvider>);`,resolveDir:web,loader:'tsx'},
  outfile:path.join(out,'bundle.js'),bundle:true,platform:'browser',format:'iife',target:'es2022',jsx:'automatic',alias:{'@':web},nodePaths:[path.join(web,'node_modules')],define:{'process.env.NODE_ENV':'"production"'}});
 const to=Date.now(),from=to-3600000;
 const episode={firstAt:to-40000,lastAt:to-34000,from:to-48000,to:to-26000,lossPct:12,concealedPct:0,freezes:0,reconnect:false,poorQuality:false};
 const earlier={...episode,firstAt:to-120000,lastAt:to-120000,from:to-128000,to:to-112000,lossPct:0,freezes:1};
 server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://test');
  if(url.pathname==='/bundle.js'){res.setHeader('content-type','text/javascript');res.end(fs.readFileSync(path.join(out,'bundle.js')));return;}
  if(url.pathname==='/globals.css'||url.pathname==='/graphite.css'){res.setHeader('content-type','text/css');res.end(fs.readFileSync(path.join(web,'app',url.pathname==='/globals.css'?'globals.css':'graphite-workspace.css')));return;}
  if(url.pathname==='/api/stats'){
   res.setHeader('content-type','application/json');
   if(url.searchParams.get('diagnostics')==='analysis'){
    requests.push(url);
    const bounds=url.searchParams.has('from') ? {from:Number(url.searchParams.get('from')),to:Number(url.searchParams.get('to'))} : {from,to};
    res.end(JSON.stringify({...bounds,complete:true,sampleCount:2,diagnosis:{coverage:{evaluable:1},findings:[{code:'sender-cpu',source:'Тестовая студия',kind:'video',confidence:'observed',firstAt:from,lastAt:to,intervals:2,evidence:{fps:7}}]},sfu:{samples:[],clippedSnapshots:0},serverLoad:{thresholdPercent:85,qualifyingSpanMs:30000,observedSamples:4,elevated:[{from,to}],overlaps:[{findingIndex:0,at:from,peakPercent:95}]}}));return;
   }
   if(url.searchParams.get('diagnostics')==='full'){
    requests.push(url);res.setHeader('content-disposition','attachment; filename="room.ndjson"');res.end('{"type":"summary"}\n');return;
   }
   if(url.searchParams.get('diagnostics')==='video'){
    requests.push(url);if(mode==='error'){res.statusCode=503;res.end('{}');return;}
    const next=url.searchParams.get('cursor');
    const sample={at:to-2000,clientAt:to-2100,identity:next?'guest-caster':'studio-panel-main',session:next?'caster-session':'studio-session',streams:[{kind:'video',direction:next?'in':'out',fps:60,freezes:next?2:null,video:{framesDecoded:next?120:null,framesEncoded:next?null:120}}]};
    res.end(JSON.stringify({from,to,samples:[sample],nextCursor:mode==='partial'||next?null:'next',limited:mode==='partial'||!next}));return;
   }
   res.end(JSON.stringify({from,to,bucketMs:10000,connections:[],series:[],retainedFrom:from,problemPeriods:{total:2,periods:[earlier,episode]}}));return;
  }
  res.setHeader('content-type','text/html');res.end('<!doctype html><html lang="ru" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/globals.css"><link rel="stylesheet" href="/graphite.css"><style>body{margin:0}main{padding:16px;max-width:1440px;margin:auto}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({executablePath:process.env.CASTLINK_QA_CHROMIUM_BINARY||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 const button=page.getByRole('button',{name:'Диагностика видео → JSON',exact:true});
 await button.waitFor();await page.waitForFunction(()=>![...document.querySelectorAll('button')].find(b=>b.textContent==='Диагностика видео → JSON').disabled);
 await page.getByRole('button',{name:'6 часов',exact:true}).click();
 await page.waitForFunction(()=>![...document.querySelectorAll('button')].find(b=>b.textContent==='Диагностика видео → JSON').disabled);
 assert.equal(requests.length,0,'diagnostics only run on demand');
 const picker=page.getByRole('combobox',{name:'Эпизоды с признаками сбоя · местное время'});
 await picker.waitFor();assert.equal(await picker.locator('option').count(),2);
 await picker.selectOption({index:1});
 await page.getByText('Пик потерь пакетов 12%',{exact:true}).waitFor();
 assert.equal(requests.length,0);
 const reviewButton=page.getByRole('button',{name:'Разобрать эпизод',exact:true});
 const [menuRect,actionRect]=await Promise.all([picker.boundingBox(),reviewButton.boundingBox()]);
 assert.ok(actionRect.x>=menuRect.x+menuRect.width-1&&Math.abs(actionRect.y-menuRect.y)<10,'menu and action share a row');
 await page.getByRole('button',{name:/Разобрать эпизод/}).click();
 const clipButton=page.getByRole('button',{name:'Скачать диагностику этого эпизода',exact:true});
 await clipButton.waitFor();const clipEvent=page.waitForEvent('download');await clipButton.click();await clipEvent;
 assert.deepEqual(requests.map(u=>[u.searchParams.get('diagnostics'),u.searchParams.get('from'),u.searchParams.get('to')]),[
   ['analysis',String(episode.from),String(episode.to)],['full',String(episode.from),String(episode.to)]]);
 const nearby=picker.locator('xpath=ancestor::section[1]');
 await nearby.getByRole('heading',{name:'Диагностика выбранного эпизода'}).waitFor();
 await nearby.screenshot({path:path.join(out,'episode-selection.png')});
 await picker.selectOption({index:0});
 assert.equal(await clipButton.count(),0,'changing episode clears the old results');
 assert.equal(requests.length,2,'selection alone does not start an analysis');
 requests.length=0;
 const analyze=page.getByRole('button',{name:'Разобрать проблемы связи',exact:true});await analyze.click({timeout:3500});
 await page.getByText('Кодирование ограничено процессором',{exact:true}).waitFor();
 await page.getByText(/до 95% CPU/).waitFor();
 assert.ok(await page.getByText('Тестовая студия',{exact:false}).count());
 const fullEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать полную диагностику',exact:true}).click();
 const full=await fullEvent;assert.equal(full.suggestedFilename(),'room.ndjson');
 assert.equal(requests.length,2);assert.ok(requests.every(u=>u.searchParams.get('minutes')==='360'&&u.searchParams.get('to')===String(to)));
 requests.length=0;
 const downloadEvent=page.waitForEvent('download');await button.click();const download=await downloadEvent;
 assert.equal(download.suggestedFilename(),'castlink-video-CS-live-360min.json');
 const parsed=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(parsed.samples.length,2);assert.equal(parsed.partial,false);
 assert.ok(requests.every(u=>u.searchParams.get('minutes')==='360'));assert.equal(requests[1].searchParams.get('to'),String(to));
 await page.getByRole('status').filter({hasText:'Диагностика видео выгружена'}).waitFor();
 await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true});
 await page.locator('.room-media-diagnostics').screenshot({path:path.join(out,'diagnostics.png')});
 await page.setViewportSize({width:390,height:844});await button.scrollIntoViewIfNeeded();
 const box=await button.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390,'video download control fits a narrow viewport');
 await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});
 mode='partial';const partialEvent=page.waitForEvent('download');await button.click();const partial=await partialEvent;
 assert.match(partial.suggestedFilename(),/-partial\.json$/);assert.equal(JSON.parse(fs.readFileSync(await partial.path(),'utf8')).partial,true);
 await page.getByRole('status').filter({hasText:'Выгружена часть диагностики видео'}).waitFor();
 await page.getByRole('button',{name:'1 час',exact:true}).click();
 assert.equal(await page.getByText('Кодирование ограничено процессором',{exact:true}).count(),0,'findings are cleared on scope change');
 mode='error';await button.click();await page.getByRole('alert').filter({hasText:'Не удалось выгрузить диагностику видео'}).waitFor();
 await page.locator('input[type=date]').fill(new Date(to-3*86400000).toISOString().slice(0,10));
 await analyze.click();await page.getByText('Кодирование ограничено процессором',{exact:true}).waitFor();
 assert.equal(requests.at(-1).searchParams.get('to'),String(to),'server-reported cutoff is authoritative for the displayed history');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'PASS',screenshots:out,checks:'on-demand analysis, streamed attachment with matching cutoff, scope change, real button, exact JSON download, fixed cutoff, six-hour period, partial name/status, request failure, desktop/mobile, no browser errors'}));
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));}})().catch(e=>{console.error(e);process.exitCode=1;});
