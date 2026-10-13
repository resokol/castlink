# Synthetic role-page DOM; no credentials, API calls or live rooms.
from pathlib import Path
import os, json, tempfile
from selenium import webdriver
from selenium.webdriver.firefox.service import Service
root=Path(__file__).resolve().parents[3]
out=Path(tempfile.mkdtemp(prefix='castlink-workspace-layout-'))
options=webdriver.FirefoxOptions();options.add_argument('-headless');options.binary_location=os.environ['CASTLINK_QA_FIREFOX_BINARY']
driver=webdriver.Firefox(service=Service(os.environ['CASTLINK_QA_GECKODRIVER']),options=options)
driver.set_page_load_timeout(15);driver.set_script_timeout(10)
css=(root/'apps/web/app/globals.css').as_uri()
results=[]
try:
 for width,height in [(390,844),(768,1024),(1440,900),(1920,1080)]:
  driver.set_window_size(max(width+32,600),height+160)
  for role in ['admin','moderator']:
   for tab in ['studio','participants','statistics']:
    if role=='moderator' and tab=='statistics':continue
    for theme in ['dark','light']:
     hero='<section class="studio-return-hero admin-return-hero '+('moderator-return-hero' if role=='moderator' else '')+'"><div class="panel studio-video-card"><h2>Studio Return</h2><video class="return-preview" style="height:260px;width:100%;background:#08090b"></video></div><div class="panel return-stats"><p>Monitoring and metrics</p><button>Listen</button></div></section>'
     content=hero if tab=='studio' else '<div class="workspace-stack"><section class="panel">Staff</section><section class="panel">Guests</section></div>' if tab=='participants' else '<section class="panel">Statistics</section>'
     html='<meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><link rel=stylesheet href="'+css+'"><style>.admin-header{display:flex;gap:16px;justify-content:space-between}.admin-header h1,.admin-header p{margin:0 0 8px}</style><main class="studio-page studio-app-shell admin-room-page"><aside class="studio-sidebar"><strong>CastLink</strong><nav class="studio-tabs"><button>Studio</button><button>Participants</button></nav><div class="sidebar-footer">'+role+'</div><button class="sidebar-leave-button">Leave</button></aside><div class="studio-main-column"><header class="panel admin-header"><div><h1>Room test</h1><p>Only authorized room operations</p></div></header><div class="control-quick-actions" '+('hidden' if tab!='studio' else '')+'><button>Room</button><button>Guests see studio only</button></div>'+content+'<div class="workspace-footer-slot"><aside class="app-update-status workspace-footer"><div class="app-version-row"><small>Server: example.test · CastLink 1.0.0-rc.2 · Build: 1.0.0-rc.2-123456abcdef</small><div class="app-version-actions"><button>Theme</button><button>Check updates</button></div></div></aside></div></div></main>'
     fixture=out/'fixture.html';fixture.write_text(html,encoding='utf-8')
     host=out/'host.html';host.write_text('<style>html,body{margin:0}</style><iframe id=fixture style="border:0;width:'+str(width)+'px;height:'+str(height)+'px" src="'+fixture.as_uri()+'"></iframe>',encoding='utf-8')
     driver.get(host.as_uri());frame=driver.find_element('id','fixture');driver.switch_to.frame(frame)
     driver.execute_script("document.documentElement.dataset.theme=arguments[0]",theme)
     info=driver.execute_script("""
const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
const header=document.querySelector('header'),action=document.querySelector('.control-quick-actions'),footer=document.querySelector('.workspace-footer'),col=document.querySelector('.studio-main-column');
const blocks=[...col.children].filter(e=>getComputedStyle(e).display!=='none');
return {width:innerWidth,pageWidth:document.documentElement.scrollWidth,header:rect(header),action:action.hidden?null:rect(action),footer:rect(footer),main:rect(document.querySelector('main')),sidebar:rect(document.querySelector('.studio-sidebar')),gaps:blocks.slice(1).map((e,i)=>rect(e).y-rect(blocks[i]).bottom)};
""")
     assert info['width']==width and info['pageWidth']<=width+1,info
     assert min(info['gaps'])>=17,info
     assert abs(info['main']['x'])<=1 and abs(info['main']['width']-width)<=18,info
     if width>760:
      assert info['main']['height']>=height-1,info
      assert abs(info['sidebar']['height']-height)<=1,info
      assert info['footer']['bottom']>=height-19,info
      assert info['footer']['x']>=info['sidebar']['right'],info
     results.append({'width':width,'role':role,'tab':tab,'theme':theme,'pass':True,'minGap':min(info['gaps'])})
     driver.switch_to.default_content()
     if tab=='studio' and theme=='dark':frame.screenshot(str(out/f'{role}-{width}.png'))
 print(json.dumps({'passed':len(results),'cases':results,'output':str(out)}),flush=True)
 (out/'results.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
finally:driver.quit()
