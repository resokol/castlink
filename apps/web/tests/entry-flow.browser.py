"""Run against a local production Next server. API fixtures isolate UI from live rooms.
CASTLINK_ENTRY_BASE=http://127.0.0.1:3081 python apps/web/tests/entry-flow.browser.py
Start server with CASTLINK_HOSTED_ACCESS=1 ROOM_CREATION_PASSWORD=isolated-entry-qa.
Screenshots and report go to CASTLINK_ENTRY_QA (default /tmp/castlink-entry-live-qa).
"""
import os,json
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright
BASE=os.environ.get('CASTLINK_ENTRY_BASE','http://127.0.0.1:3081')
ORIGIN='https://entry.castlink.test'
OUT=Path(os.environ.get('CASTLINK_ENTRY_QA','/tmp/castlink-entry-live-qa'));OUT.mkdir(parents=True,exist_ok=True)
ROOT=Path(__file__).resolve().parents[3]
BUILD=(ROOT/'apps/web/.next-entry-production/BUILD_ID').read_text().strip()
SETTINGS={'audioOnly':True,'startMuted':True,'noGuestAudio':False}
checks=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'])
 def setup(locale='ru',light=False,width=1080,native=False,windows=False):
  opts={'viewport':{'width':width,'height':850}}
  if windows:opts['user_agent']='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36'
  context=browser.new_context(**opts)
  context.add_init_script('if(location.origin === "'+ORIGIN+'"){localStorage.setItem("castlink-language",'+json.dumps(locale)+');localStorage.setItem("studiolink-theme",'+json.dumps('light' if light else 'dark')+');'+('window.castlinkDesktop={};' if native else '')+'}')
  state={'hosted':False,'invalid':False,'network':False,'auth_error':False,'calls':[],'errors':[]}
  def route(r):
   u=urlparse(r.request.url)
   if u.path.startswith('/api/'):
    data={};status=200
    body=r.request.post_data_json if r.request.method=='POST' else None
    state['calls'].append((u.path,r.request.method,body))
    if u.path=='/api/hosted-access':
     if r.request.method=='POST':state['hosted']=True
     data={'enabled':True,'allowed':state['hosted']}
    elif u.path=='/api/auth':
     if state['invalid']:status=401;data={'allowed':False,'error':'Приглашение недействительно'}
     elif state['auth_error'] and r.request.method=='POST':status=401;data={'allowed':False,'error':'Неверный пароль'}
     else:data={'allowed':True,'entrySettings':SETTINGS}
    elif u.path=='/api/guest-admission':
     if state['network']:status=503;data={'error':'Недоступно'}
     elif state['invalid']:status=403;data={'error':'Приглашение недействительно'}
     else:data={'room':'Вечерний эфир','entrySettings':SETTINGS}
    elif u.path=='/api/rooms':data={'exists':True,'rooms':[]}
    elif u.path=='/api/token':status=503;data={'error':'QA: session unavailable'}
    elif u.path=='/api/room-studio-access':status=401;data={'allowed':False,'exists':True,'error':'Неверный пароль'}
    elif u.path=='/api/room-mode':data={'studioOnly':False}
    elif u.path=='/api/version':data={'version':BUILD}
    else:data={}
    r.fulfill(status=status,json=data);return
   response=r.fetch(url=BASE+u.path+('?' +u.query if u.query else ''))
   r.fulfill(response=response)
  context.route(ORIGIN+'/**',route)
  page=context.new_page();page.on('pageerror',lambda e:state['errors'].append(str(e)))
  return context,page,state
 def capture(page,name):
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),name+' horizontal overflow'
  page.screenshot(path=str(OUT/(name+'.png')),full_page=True)
 def check(name,condition=True):
  assert condition,name
  checks.append(name)
 # One real role-first page per supported language, theme and narrow/desktop width.
 labels={'ru':('Как вы хотите войти?','Войти как студия','Войти как кастер'),'en':('How would you like to join?','Enter as studio','Join as caster'),'zh-CN':('您想以什么身份进入？','以演播室身份进入','以主播身份加入')}
 for locale in labels:
  for light in [False,True]:
   for width in [390,1080]:
    c,page,s=setup(locale,light,width);page.goto(ORIGIN+'/');heading,studio,caster=labels[locale]
    page.get_by_role('heading',name=heading,exact=True).wait_for()
    check('role-first '+locale+str(light)+str(width),page.get_by_role('button',name=studio,exact=True).is_visible() and page.get_by_role('button',name=caster,exact=True).is_visible())
    check('no hosted request before role '+locale+str(light)+str(width),not any(x[0]=='/api/hosted-access' for x in s['calls']))
    capture(page,'roles-'+locale+('-light' if light else '-dark')+'-'+str(width));check('no page errors '+locale+str(light)+str(width),not s['errors']);c.close()
 # Studio gate, room login/create, manual guest denial and focused invitation form.
 c,page,s=setup();page.goto(ORIGIN+'/');page.get_by_role('button',name='Войти как студия',exact=True).click()
 page.get_by_role('heading',name='Доступ к студии',exact=True).wait_for();capture(page,'studio-access')
 page.get_by_label('Токен доступа',exact=True).fill('isolated-demo-token');page.get_by_role('button',name='Продолжить',exact=True).click()
 page.get_by_role('heading',name='Войти в студию',exact=True).wait_for();capture(page,'studio-room')
 page.get_by_label('Название комнаты',exact=True).fill('Вечерний эфир');page.get_by_label('Пароль студии',exact=True).fill('demo-password')
 page.get_by_role('button',name='Открыть студию',exact=True).click();page.locator('p[role=alert]').wait_for()
 check('studio sends room-scoped password only',any(x[0]=='/api/room-studio-access' and x[2].get('action')=='login' for x in s['calls']))
 page.get_by_role('button',name='Создать комнату',exact=True).click();page.get_by_label('Пароль создания комнат',exact=True).wait_for();capture(page,'studio-create')
 page.get_by_role('button',name='Выбрать другую роль',exact=False).click();page.get_by_role('button',name='Войти как кастер',exact=True).click();capture(page,'caster')
 page.get_by_label('Ссылка приглашения',exact=True).fill('https://example.com/admin');page.get_by_role('button',name='Продолжить →',exact=True).click();page.locator('p[role=alert]').wait_for()
 check('invalid invitation stays in form',page.url.startswith(ORIGIN))
 page.get_by_role('button',name='Нет ссылки?',exact=False).click();page.get_by_label('Название комнаты',exact=True).fill('Вечерний эфир');s['auth_error']=True
 page.get_by_label('Пароль гостей',exact=True).fill('wrong-password');page.get_by_role('button',name='Войти',exact=True).click();page.locator('p[role=alert]').wait_for();capture(page,'manual-password-error')
 check('guest path uses no studio token after role',len([x for x in s['calls'] if x[0]=='/api/hosted-access' and x[1]=='POST'])==1)
 check('studio and manual flows no page errors',not s['errors']);c.close()
 # Both invitation generations, preserved secret, no session before explicit connect.
 for path in ['/join?studioId=studio-default#invite=demo-personal','/?name=Evening&mode=guest#invite=demo-legacy','/room?name=Evening#invite=demo-legacy']:
  c,page,s=setup();page.goto(ORIGIN+path);page.get_by_role('heading',name='Вас пригласили в студию',exact=True).wait_for()
  check('invite skips roles '+path.split('?')[0],page.get_by_role('button',name='Продолжить в браузере',exact=True).is_visible())
  if path.startswith('/join'):capture(page,'invite')
  page.get_by_role('button',name='Продолжить в браузере',exact=True).click();page.get_by_role('heading',name='Проверьте себя перед входом',exact=True).wait_for()
  check('no token before explicit connect '+path.split('?')[0],not any(x[0]=='/api/token' for x in s['calls']))
  join=page.get_by_role('button',name='Подключиться к студии',exact=True);check('blank name disables connect '+path.split('?')[0],join.is_disabled())
  page.get_by_label('Как вас представить',exact=True).fill('Анна')
  if path.startswith('/join'):capture(page,'preflight')
  join.click();page.get_by_text('QA: session unavailable',exact=True).wait_for()
  check('one explicit token request '+path.split('?')[0],len([x for x in s['calls'] if x[0]=='/api/token'])==1)
  check('invite flow no page errors '+path.split('?')[0],not s['errors']);c.close()
 # Query legacy secret cleanup happens before resolve; invalid/network recovery.
 c,page,s=setup();page.goto(ORIGIN+'/join?studioId=studio-default&invite=demo-query-secret');page.get_by_role('heading',name='Вас пригласили в студию',exact=True).wait_for()
 check('query secret cleaned from actual address','invite' not in parse_qs(urlparse(page.url).query));c.close()
 for network in [False,True]:
  c,page,s=setup(width=390);s['network']=network;s['invalid']=not network;page.goto(ORIGIN+'/join#invite=demo-invalid')
  page.get_by_role('button',name='Повторить проверку' if network else 'Вставить другое приглашение',exact=True).wait_for();capture(page,'invite-network' if network else 'invite-invalid')
  check('failed invite never requests media session '+str(network),not any(x[0]=='/api/token' for x in s['calls']))
  check('failed invite no page errors '+str(network),not s['errors']);c.close()
 # Native marker avoids another app launch; normal Windows browser preserves fallback.
 for native in [True,False]:
  c,page,s=setup(native=native,windows=True);page.goto(ORIGIN+'/join#invite=demo-personal')
  if native:page.get_by_role('heading',name='Проверьте себя перед входом',exact=True).wait_for()
  else:page.get_by_role('button',name='Продолжить в браузере',exact=True).wait_for();capture(page,'invite-windows-opening')
  check('native bridge or browser fallback '+str(native),not any(x[0]=='/api/token' for x in s['calls']));check('native detection no page errors '+str(native)+' '+repr(s['errors']),not s['errors']);c.close()
 # Final preflight on narrow/light has real route and actual CSS, using authorized off settings.
 c,page,s=setup(light=True,width=390);page.goto(ORIGIN+'/join#invite=demo-personal');page.get_by_role('button',name='Продолжить в браузере',exact=True).click();page.get_by_role('heading',name='Проверьте себя перед входом',exact=True).wait_for();capture(page,'preflight-light-mobile');check('mobile preflight no page errors',not s['errors']);c.close()
 browser.close()
(OUT/'results.json').write_text(json.dumps({'checks':checks,'count':len(checks),'api':'isolated fixtures; production components/routes/CSP','liveMedia':False},ensure_ascii=False,indent=2))
print('PASS '+str(len(checks))+' production-route checks; screenshots: '+str(OUT))
