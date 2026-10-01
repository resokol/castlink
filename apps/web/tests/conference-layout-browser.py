# Synthetic DOM/CSS fixture, not a live app/device test. Requires Selenium and explicit local Firefox/geckodriver paths.
from pathlib import Path
import json, subprocess, os, tempfile
from selenium import webdriver
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.support.ui import WebDriverWait
root = Path(__file__).resolve().parents[3]
out = Path(tempfile.mkdtemp(prefix='castlink-layout-qa-'))
print('QA_OUTPUT',out,flush=True)
compiled = subprocess.run(['node','-e',"const fs=require('fs'),ts=require('typescript'); process.stdout.write(ts.transpileModule(fs.readFileSync('lib/video-fit.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)"],cwd=root/'apps/web',capture_output=True,text=True,check=True).stdout
style = (root/'apps/web/node_modules/@livekit/components-styles/dist/general/index.css').as_uri()
css = (root/'apps/web/app/globals.css').as_uri()
head = '<meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><link rel="stylesheet" href="'+style+'"><link rel="stylesheet" href="'+css+'">'
buttons = '<div class="lk-button-group"><button class="lk-button">Microphone</button><button class="lk-button-menu">⌄</button></div><div class="lk-button-group"><button class="lk-button">Camera</button><button class="lk-button-menu">⌄</button></div>'
footer = '<footer class="castlink-conference-footer"><div class="guest-control-row"><div class="lk-control-bar">'+buttons+'</div><button class="lk-button">Экран</button><button class="lk-button">Чат</button></div><p class="screen-share-hint">Показ экрана или окна приложения. Звук выбирается в диалоге браузера.</p></footer>'
script = 'var exports={};'+compiled+'''
window.rotate = angle => document.querySelectorAll('video').forEach(v=>exports.applyContainedVideoFit(v,v.parentElement,angle));
const canvas=document.createElement('canvas');canvas.width=720;canvas.height=1280;
const ctx=canvas.getContext('2d');ctx.fillStyle='#596c90';ctx.fillRect(0,0,720,1280);ctx.strokeStyle='yellow';ctx.lineWidth=20;ctx.strokeRect(10,10,700,1260);ctx.fillStyle='white';ctx.font='50px sans-serif';ctx.fillText('TOP LEFT',30,80);ctx.fillText('BOTTOM RIGHT',260,1200);
const stream=canvas.captureStream(10);
document.querySelectorAll('video').forEach(v=>{v.srcObject=stream;v.muted=true;v.play();});
'''
options=webdriver.FirefoxOptions(); options.page_load_strategy="eager"
options.binary_location=os.environ['CASTLINK_QA_FIREFOX_BINARY']
options.add_argument('-headless')
driver=webdriver.Firefox(service=Service(os.environ['CASTLINK_QA_GECKODRIVER']),options=options)
driver.set_page_load_timeout(15)
driver.set_script_timeout(10)
print("QA_DRIVER_READY",flush=True)
results=[]
try:
 for width,height in [(390,844),(1440,900)]:
  driver.set_window_size(width,height)
  for count in [1,2,4]:
   tiles=''.join('<div class="lk-participant-tile"><video playsinline muted autoplay></video></div>' for _ in range(count))
   html=head+'<main class="media-page guest-room-page guest-app-shell"><aside class="guest-sidebar">CastLink QA</aside><div class="guest-main-column"><div class="guest-conference-grid"><div class="lk-video-conference" data-lk-theme="default" data-single-participant="'+str(count==1).lower()+'"><div class="lk-video-conference-inner"><div class="lk-scroll-layout-wrapper"><div class="lk-scroll-layout">'+tiles+'</div></div>'+footer+'</div></div></div></div></main><script>'+script+'</script>'
   file=out/'fixture.html';file.write_text(html,encoding='utf8');print('CASE',width,count,flush=True)
   host=out/'host.html';host.write_text('<style>html,body{margin:0}</style><iframe id=fixture style="border:0;width:'+str(width)+'px;height:'+str(height)+'px" src="'+file.as_uri()+'"></iframe>',encoding='utf8')
   driver.get(host.as_uri());frame=driver.find_element('id','fixture');driver.switch_to.frame(frame)
   assert driver.execute_script('return innerWidth')==width
   WebDriverWait(driver,10).until(lambda d:d.execute_script('return document.querySelector("video").videoWidth===720'))
   for angle in [0,90,180,270]:
    driver.execute_script('window.rotate(arguments[0])',angle)
    info=driver.execute_script('''
const wrap=document.querySelector('.lk-scroll-layout-wrapper'),footer=document.querySelector('footer');
const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
return {wrap:rect(wrap),footer:rect(footer),scroll:wrap.scrollHeight,client:wrap.clientHeight,viewport:innerWidth,pageWidth:document.documentElement.scrollWidth,pairs:[...document.querySelectorAll('.lk-button-group')].map(g=>[...g.querySelectorAll('button')].map(rect)),videos:[...document.querySelectorAll('video')].map(v=>({v:rect(v),p:rect(v.parentElement)}))};
''')
    assert info['wrap']['bottom']<=info['footer']['y']+1,info
    assert info['pageWidth']<=info['viewport']+1,info
    if count==1: assert info['scroll']<=info['client']+2,info
    for a,b in info['pairs']: assert b['x']-a['right']>=5,info
    for item in info['videos']:
     v,p=item['v'],item['p']
     assert v['w']<=p['w']+1 and v['h']<=p['h']+1,(angle,item)
     assert v['x']>=p['x']-1 and v['y']>=p['y']-1,(angle,item)
    results.append({'width':width,'count':count,'angle':angle,'pass':True})
   driver.switch_to.default_content();frame.screenshot(str(out/f'layout-{width}-{count}.png'))
 print(json.dumps({'passed':len(results),'cases':results}))
finally:
 driver.quit()
