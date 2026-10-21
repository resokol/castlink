from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
import json,time,os
root=Path(os.environ.get('CASTLINK_LAYOUT_OUTPUT',str(Path.cwd()/'.qa'/'layout')));root.mkdir(parents=True,exist_ok=True)
o=webdriver.FirefoxOptions();o.add_argument('-headless');
if os.environ.get('CASTLINK_FIREFOX'):o.binary_location=os.environ['CASTLINK_FIREFOX']
d=webdriver.Firefox(options=o);d.set_page_load_timeout(120);d.set_window_size(1960,1240)
results=[]
def cameras():return d.execute_script("""return document.querySelector('[data-scene-mode]')?.querySelectorAll('[data-scene-source="camera"]').length""")
try:
 d.get(os.environ.get('CASTLINK_LAYOUT_URL','http://127.0.0.1:3018/pr73-layout-proof'))
 for width,height in [(1920,1080),(1280,800),(1024,768),(360,800),(800,360)]:
  d.switch_to.default_content();d.execute_script("document.body.innerHTML='';const f=document.createElement('iframe');f.id='proof-frame';f.src='/pr73-layout-proof';f.style.cssText='display:block;border:0;width:'+arguments[0]+'px;height:'+arguments[1]+'px';document.body.style.margin='0';document.body.append(f)",width,height);d.switch_to.frame(d.find_element(By.ID,'proof-frame'))
  WebDriverWait(d,120).until(lambda x:x.execute_script("return document.body.dataset.proofReady==='true'"));assert d.execute_script('return innerWidth')==width
  d.execute_script("document.querySelector('nav').style.display='none'")
  for theme in ['dark','light']:
   d.execute_script('document.documentElement.dataset.theme=arguments[0]',theme)
   d.execute_script("document.getElementById('caster').click()");WebDriverWait(d,30).until(lambda x:cameras()==1);time.sleep(.2)
   for count in [1,3,8]:
    if count!=1:d.execute_script("document.getElementById('count').click()");WebDriverWait(d,30).until(lambda x:cameras()==count);time.sleep(.1)
    info=d.execute_script("""const scene=document.querySelector('[data-scene-mode]');const t=[...scene.querySelectorAll('[data-scene-source]')].filter(e=>!e.dataset.scenePrimary).map(e=>{const r=e.getBoundingClientRect();return {w:r.width,h:r.height}});const buttons=[...document.querySelector('.transport-proof .guest-control-row').querySelectorAll('button')].filter(e=>e.getBoundingClientRect().width&&e.getBoundingClientRect().height).map(e=>({label:e.textContent,y:e.getBoundingClientRect().y}));return {width:innerWidth,page:document.documentElement.scrollWidth,tiles:t,buttons,portrait:scene.dataset.scenePortrait};""")
    assert all(abs(t['w']/t['h']-16/9)<.03 for t in info['tiles']),info
    if width>700 and height>600:assert len(info['buttons'])>=6 and max(b['y'] for b in info['buttons'])-min(b['y'] for b in info['buttons'])<8,info
    assert info['page']<=width+1,info
    results.append({'surface':'caster','width':width,'height':height,'theme':theme,'count':count,'info':info})
    if count==1 and width in [1920,360,800]:d.find_element(By.TAG_NAME,'html').screenshot(str(root/f'confirm-caster-{width}-{theme}.png'))
   d.execute_script("document.getElementById('count').click()");WebDriverWait(d,30).until(lambda x:cameras()==1)
   scene=d.find_element(By.CSS_SELECTOR,'[data-scene-mode]');separator=scene.find_element(By.CSS_SELECTOR,'[role="separator"]');separator.send_keys(Keys.END);assert separator.get_attribute('aria-valuenow')=='88';separator.send_keys(Keys.HOME);assert separator.get_attribute('aria-valuenow')=='50';separator.send_keys(*([Keys.ARROW_RIGHT]*13)) if width>height else separator.send_keys(*([Keys.ARROW_DOWN]*13))
   scene.find_elements(By.CSS_SELECTOR,'[role="group"] button')[1].click();assert scene.get_attribute('data-scene-mode')=='tiles';scene.find_elements(By.CSS_SELECTOR,'[role="group"] button')[0].click()
   if width<=700 or height<=600:
    summary=d.find_element(By.CSS_SELECTOR,'.conference-more-actions>summary');summary.click();assert d.find_element(By.CSS_SELECTOR,'.conference-more-actions').get_attribute('open') is not None;summary.click()
   for surface in ['studio','admin']:
    d.execute_script("document.getElementById(arguments[0]).click()",surface);WebDriverWait(d,30).until(lambda x:len(x.find_elements(By.CSS_SELECTOR,'.source-deck>.source-card'))==2)
    d.execute_script("document.querySelectorAll('details.source-card-advanced').forEach(e=>e.open=true)")
    info=d.execute_script("""return {width:innerWidth,page:document.documentElement.scrollWidth,cards:[...document.querySelectorAll('.source-deck>.source-card')].map(e=>({w:e.clientWidth,h:e.clientHeight,scroll:e.scrollHeight,overflow:getComputedStyle(e).overflow}))};""")
    assert info['page']<=width+1,info
    assert all(c['scroll']<=c['h']+3 for c in info['cards']),info
    results.append({'surface':surface,'width':width,'height':height,'theme':theme,'info':info})
    if width in [1920,360]:d.find_element(By.TAG_NAME,'html').screenshot(str(root/f'confirm-{surface}-{width}-{theme}.png'))
 print('PASS',len(results),flush=True);(root/'browser-confirm-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf8')
finally:d.quit()
