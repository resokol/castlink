# DOM/CSS fixtures, not a physical-phone or SFU latency test.
from pathlib import Path
import os,json,tempfile,subprocess
from selenium import webdriver
from selenium.webdriver.firefox.service import Service
root=Path(__file__).resolve().parents[3]
out=Path(tempfile.mkdtemp(prefix='castlink-mobile-ops-'))
options=webdriver.FirefoxOptions();options.add_argument('-headless');options.binary_location=os.environ['CASTLINK_QA_FIREFOX_BINARY']
driver=webdriver.Firefox(service=Service(os.environ['CASTLINK_QA_GECKODRIVER']),options=options)
driver.set_page_load_timeout(15);driver.set_script_timeout(10)
css=(root/'apps/web/app/globals.css').as_uri()
compile_js="const fs=require('fs'),ts=require('typescript');const s=fs.readFileSync('lib/fullscreen.ts','utf8');console.log('(function(){var exports={};'+ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText+';window.fullscreen=exports;})();');"
fullscreen=subprocess.check_output(['node','-e',compile_js],cwd=root/'apps/web',text=True,encoding='utf-8')
results=[]
def page(html,width,height):
 fixture=out/'fixture.html';fixture.write_text('<meta charset=utf-8><link rel=stylesheet href="'+css+'">'+html,encoding='utf-8')
 host=out/'host.html';host.write_text('<style>html,body{margin:0}</style><iframe id=fixture allowfullscreen style="border:0;width:'+str(width)+'px;height:'+str(height)+'px" src="'+fixture.as_uri()+'"></iframe>',encoding='utf-8')
 driver.set_window_size(max(600,width+32),height+160);driver.get(host.as_uri());driver.switch_to.frame(driver.find_element('id','fixture'))
try:
 for width,height in [(320,568),(390,844),(700,900),(1440,900)]:
  for count in [1,2,4,6,9,12]:
   columns=1 if count<2 else 2 if count<=6 else 3 if count<=12 else 4;rows=(count+columns-1)//columns
   tiles=''.join('<div class="castlink-tile-shell"><div class="lk-participant-tile" style="background:#090b10;position:relative"><video style="width:100%;height:100%;object-fit:contain"></video></div><button class="castlink-tile-fullscreen" aria-label="Fullscreen" onclick="fullscreen.toggleElementFullscreen(this.parentElement)">⛶</button></div>' for _ in range(count))
   html='<main class="guest-room-page guest-app-shell"><div class="guest-main-column"><div class="guest-conference-grid"><div class="lk-video-conference" data-single-participant="'+str(count==1).lower()+'" style="--conference-mobile-columns:'+str(columns)+';--conference-mobile-rows:'+str(rows)+'"><div class="lk-video-conference-inner"><div class="lk-scroll-layout-wrapper"><div class="lk-scroll-layout">'+tiles+'</div></div><footer class="castlink-conference-footer"><div class="guest-control-row"><button>Mic</button><button>Cam</button><button class="castlink-chat-toggle"><svg viewBox="0 0 24 24"><path d="M4 4h16v12H9l-5 4V4Z"/></svg><span>Чат</span></button></div></footer></div></div></div></div></main><script>'+fullscreen+'</script>'
   page(html,width,height)
   info=driver.execute_script("""const r=e=>{const b=e.getBoundingClientRect();return {top:b.top,bottom:b.bottom,left:b.left,right:b.right,height:b.height}};const area=document.querySelector('.lk-scroll-layout-wrapper'),footer=document.querySelector('footer');return {width:innerWidth,scroll:document.documentElement.scrollWidth,area:r(area),footer:r(footer),scrollHeight:area.scrollHeight,clientHeight:area.clientHeight,tiles:[...document.querySelectorAll('.castlink-tile-shell')].map(r),radius:parseFloat(getComputedStyle(footer).borderBottomLeftRadius),chat:document.querySelector('.castlink-chat-toggle').textContent,icon:r(document.querySelector('.castlink-chat-toggle svg'))};""")
   assert info['width']==width and info['scroll']<=width+1,info
   assert info['area']['bottom']<=info['footer']['top']+1,info
   assert info['radius']>=12 and 'Чат' in info['chat'] and info['icon']['height']>0,info
   if width<=700:
    assert info['scrollHeight']<=info['clientHeight']+2,info
    for tile in info['tiles']:assert tile['bottom']<=info['area']['bottom']+1 and tile['top']>=info['area']['top']-1,info
   # Exercise the production fullscreen helper's CSS fallback deterministically.
   driver.execute_script("const el=document.querySelector('.castlink-tile-shell');el.requestFullscreen=()=>Promise.reject(Error('fixture'));window.fullscreen.toggleElementFullscreen(el);")
   import time;time.sleep(.05)
   box=driver.execute_script("const e=document.querySelector('.castlink-tile-shell');return {active:e.classList.contains('castlink-css-fullscreen'),width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height};")
   assert box['active'] and abs(box['width']-width)<=1 and abs(box['height']-height)<=1,box
   driver.execute_script("window.fullscreen.toggleElementFullscreen(document.querySelector('.castlink-tile-shell'))")
   assert not driver.execute_script("return document.body.classList.contains('castlink-fullscreen-lock')")
   results.append({'kind':'mobile-grid','width':width,'count':count,'pass':True})
   driver.switch_to.default_content()
  metrics=''.join('<span>Metric '+str(i)+' 1234.5</span>' for i in range(8))
  cards=''.join('<article class="super-admin-room-card"><strong>Room '+str(i)+'</strong><div class="super-admin-participants"><div class="super-admin-participant"><div><strong>'+('LongParticipantName'*7)+'</strong></div>'+metrics+'<small>Telemetry timestamp</small></div></div></article>' for i in range(3))
  page('<main class="super-admin-page"><section class="panel super-admin-section"><div class="super-admin-room-grid">'+cards+'</div></section><section class="panel super-admin-section"><div class="super-admin-table-wrap"><table class="super-admin-table"><tr>'+''.join('<td>Metric</td>' for _ in range(12))+'</tr></table></div></section></main>',width,height)
  info=driver.execute_script("return {width:innerWidth,scroll:document.documentElement.scrollWidth,cards:[...document.querySelectorAll('.super-admin-room-card')].map(e=>({width:e.clientWidth,scroll:e.scrollWidth}))};")
  assert info['scroll']<=width+1,info
  assert all(c['scroll']<=c['width']+1 for c in info['cards']),info
  results.append({'kind':'platform-overflow','width':width,'pass':True});driver.switch_to.default_content()
 print(json.dumps({'passed':len(results),'output':str(out),'cases':results}),flush=True)
 (out/'results.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
finally:driver.quit()
