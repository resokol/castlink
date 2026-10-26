from pathlib import Path
import os, subprocess, tempfile
from playwright.sync_api import sync_playwright
p=Path(os.environ.get('CASTLINK_TOOLBAR_PROOF', tempfile.mkdtemp(prefix='castlink-compact-toolbar-')))
p.mkdir(parents=True, exist_ok=True)
subprocess.run(['node', str(Path(__file__).with_name('compact-toolbar-render.cjs')), str(p/'actual.html')], check=True)
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page()
 for width,height in [(320,844),(390,844),(700,900),(844,390),(1440,900)]:
  for theme in ['dark','light']:
   page.set_viewport_size({'width':width,'height':height})
   page.set_content((p/'actual.html').read_text())
   page.evaluate('(t)=>document.documentElement.dataset.theme=t',theme)
   buttons=page.locator('.castlink-conference-footer button').evaluate_all('''els=>els.filter(e=>e.getBoundingClientRect().width&&e.getBoundingClientRect().height&&!e.closest('[popover]')).map(e=>{const r=e.getBoundingClientRect();return {name:e.getAttribute('aria-label')||e.title||e.textContent,w:r.width,h:r.height,x:r.x,y:r.y,right:r.right}})''')
   assert len(buttons)>=8,buttons
   assert all(abs(v['w']-56)<.1 and abs(v['h']-48)<.1 for v in buttons),(width,buttons)
   rows={}
   for v in buttons: rows.setdefault(round(v['y']),[]).append(v)
   for row in rows.values(): assert abs((min(v['x'] for v in row)+max(v['right'] for v in row))/2-width/2)<2,(width,row)
   assert page.locator('.castlink-chat-toggle span').evaluate('(e)=>getComputedStyle(e).fontSize')!='0px'
   assert page.locator('.castlink-chat-toggle span').is_visible()
   assert page.locator('.castlink-chat-toggle span').bounding_box()['height'] <= 14, 'Chat must not wrap'
   for svg in page.locator('.castlink-conference-footer button > svg').all():
    if svg.is_visible() and not svg.evaluate("e=>!!e.closest('[popover]')"):
     assert svg.bounding_box()['width']==20 and svg.bounding_box()['height']==20
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   if width in [390,1440]:
    page.locator('.castlink-conference-footer').screenshot(path=str(p/f'actual-{theme}-{width}.png'))
   settings=page.locator('.guest-settings-toggle')
   settings.click()
   assert page.locator('.guest-settings-popover').is_visible()
   close=page.locator('.guest-settings-popover button').first
   assert close.bounding_box()['width']!=56,'popover buttons must not inherit toolbar sizing'
   print('PASS',width,height,theme,len(buttons),'buttons; centered rows; Chat; settings popover')
 print('Screenshots:',p)
 b.close()
