// Deterministic state-machine fixture: no Win32 calls, hooks, mouse or keyboard input.
// Compile WITH RemoteInput.cs and /main:RemoteInputCoreFixture, then run only after review.
using System;
using System.Collections.Generic;
using System.Web.Script.Serialization;
using System.Threading;

internal sealed class FixtureInputPlatform : IRemoteInputPlatform {
 internal InputSource Source=new InputSource{Kind="window",Identity="hwnd:pid:start",Hwnd=123,Rect=new InputRect(-1920,0,800,600)};
 internal bool Visible=true,Desktop=true;internal int Releases,Effects,LastX,LastY;
 public InputSource Bind(Dictionary<string,object> value){return Source;}
 public InputSource Inspect(InputSource source){return Source;}
 public bool SafeDesktop(){return Desktop;}
 public bool VisiblePoint(InputSource source,int x,int y){return Visible;}
 public void Move(int x,int y){LastX=x;LastY=y;Effects++;}
 public void Key(string code,bool down,bool repeat){Effects++;}
 public void Button(int button,bool down){Effects++;}
 public void Text(string text){Effects++;}
 public void Wheel(int dx,int dy){Effects++;}
 public void ReleaseAll(){Releases++;}
}
internal static class RemoteInputCoreFixture {
 static readonly JavaScriptSerializer Json=new JavaScriptSerializer();static long time=100000;
 static Dictionary<string,object> Read(string text){return(Dictionary<string,object>)Json.DeserializeObject(text);}
 static void Assert(bool v,string label){if(!v)throw new Exception(label);}
 static void Reject(Action a,string code){try{a();throw new Exception("missing failure "+code);}catch(InputFailure e){Assert(e.Code==code,"wrong finite failure: expected="+code+", actual="+e.Code);}}
 static Dictionary<string,object> Renew(int serial,bool activate=false){return Read("{\"id\":2,\"op\":\"renew\",\"captureId\":\"capture\",\"grantId\":\"grant\",\"revision\":1,\"leaseSerial\":"+serial+",\"geometryRevision\":1,\"expiresAt\":"+(time+700)+",\"activate\":"+(activate?"true":"false")+"}");}
 static Dictionary<string,object> Event(long seq,string body,string lane="reliable",long barrier=0,long geometry=1){return Read("{\"id\":3,\"op\":\"input\",\"captureId\":\"capture\",\"grantId\":\"grant\",\"revision\":1,\"geometryRevision\":"+geometry+",\"lane\":\""+lane+"\",\"seq\":"+seq+",\"expiresAt\":"+(time+200)+",\"moveBarrier\":"+barrier+",\"event\":"+body+"}");}
 const string Empty="{\"type\":\"heartbeat\",\"pressedKeys\":[],\"pressedButtons\":[]}";
 const string CtrlDown="{\"type\":\"key\",\"code\":\"ControlLeft\",\"down\":true,\"repeat\":false}";
 static Dictionary<string,object> CaptureStart(int width,int height){return Read("{\"id\":1,\"op\":\"start\",\"captureId\":\"capture\",\"source\":{\"kind\":\"window\",\"hwnd\":\"123\"},\"video\":{\"width\":"+width+",\"height\":"+height+"},\"mapping\":{\"kind\":\"dwm-frame\"},\"fullInputPause\":true}");}
 static long GeometryRevision(RemoteInputCore core){return Convert.ToInt64(((Dictionary<string,object>)((Dictionary<string,object>)core.State())["geometry"])["revision"]);}
 static void LeaseCurrent(RemoteInputCore core,int serial,bool activate=false){var lease=Renew(serial,activate);lease["geometryRevision"]=GeometryRevision(core);core.Renew(lease);}
 static Dictionary<string,object> ProjectionStart(FixtureInputPlatform p,int width,int height){
  var start=CaptureStart(width,height);if(p.Source.Kind=="screen"){var r=p.Source.Rect;start["source"]=Read("{\"kind\":\"screen\",\"rect\":{\"x\":"+r.X+",\"y\":"+r.Y+",\"width\":"+r.Width+",\"height\":"+r.Height+"}}");start["mapping"]=Read("{\"kind\":\"win32-monitor\"}");}return start;
 }
 static void SdkCaptureProjection(){
  var p=new FixtureInputPlatform{Source=new InputSource{Kind="window",Identity="sdk:pid:start",Hwnd=123,Rect=new InputRect(-4000,-1000,2290,793),Dpi=96}};
  var core=new RemoteInputCore(p,delegate{return time;});core.Start(CaptureStart(1920,664));
  Assert(((Dictionary<string,object>)core.State())["pointerReady"].Equals(true),"actual SDK whole-source 2290x793 ->1920x664 projection is valid");
  LeaseCurrent(core,1,true);Reject(delegate{core.Input(Event(1,CtrlDown));},"REMOTE_INPUT_REPLAY");core.Input(Event(1,Empty));
  int[] points={0,1,16384,32768,49151,65534,65535};long move=0;
  foreach(int x in points)foreach(int y in points){
   core.Input(Event(++move,"{\"type\":\"move\",\"x\":"+x+",\"y\":"+y+"}","move"));
   int videoX=(int)Math.Round((double)x*1919/65535),videoY=(int)Math.Round((double)y*663/65535);
   int inverseX=-4000+(int)Math.Round((double)videoX*2289/1919),inverseY=-1000+(int)Math.Round((double)videoY*792/663);
   Assert(p.LastX>=-4000&&p.LastX<=-1711&&p.LastY>=-1000&&p.LastY<=-208,"downscaled pointer remains inside exact negative-origin physical source");
   Assert(Math.Abs(p.LastX-inverseX)<=2&&Math.Abs(p.LastY-inverseY)<=2,"actual SDK inverse display-pixel quantization error is bounded to two physical pixels");
  }
  Assert(p.LastX==-1711&&p.LastY==-208,"downscaled normalized maximum reaches the original source edge");core.Input(Event(2,CtrlDown));int release=p.Releases;
  // These different physical heights quantize to the same SDK capture height.
  p.Source=new InputSource{Kind="window",Identity="sdk:pid:start",Hwnd=123,Rect=new InputRect(-4000,-1000,2290,794),Dpi=96};core.Tick();long sameProjection=GeometryRevision(core);
  Assert(sameProjection>1&&p.Releases>release&&((Dictionary<string,object>)core.State())["pointerReady"].Equals(true),"same encoded projection cannot hide a source resize or held-input release");
  Reject(delegate{core.Input(Event(3,CtrlDown));},"REMOTE_INPUT_GEOMETRY");LeaseCurrent(core,2);Reject(delegate{core.Input(Event(3,CtrlDown,"reliable",0,sameProjection));},"REMOTE_INPUT_REPLAY");core.Input(Event(3,Empty,"reliable",0,sameProjection));core.Input(Event(4,CtrlDown,"reliable",0,sameProjection));
  p.Source=new InputSource{Kind="window",Identity="sdk:pid:start",Hwnd=123,Rect=new InputRect(-4000,-1000,2290,800),Dpi=96};core.Tick();long mismatch=GeometryRevision(core);int effects=p.Effects;LeaseCurrent(core,3);
  Assert(((Dictionary<string,object>)core.State())["pointerReady"].Equals(false),"a different physical aspect requires its actual new SDK projection");
  Reject(delegate{core.Input(Event(5,Empty,"reliable",0,mismatch));},"REMOTE_INPUT_GEOMETRY");Reject(delegate{core.Input(Event(5,CtrlDown,"reliable",0,mismatch));},"REMOTE_INPUT_GEOMETRY");
  Reject(delegate{core.Input(Event(5,"{\"type\":\"text\",\"text\":\"Привет 中文 😀\"}","reliable",0,mismatch));},"REMOTE_INPUT_GEOMETRY");Assert(p.Effects==effects,"mismatched SDK projection blocks all strict input effects");
  p.Source=new InputSource{Kind="window",Identity="sdk:pid:start",Hwnd=123,Rect=new InputRect(-4000,-1000,2290,793),Dpi=96};core.Tick();long restored=GeometryRevision(core);LeaseCurrent(core,4);
  Reject(delegate{core.Input(Event(5,CtrlDown,"reliable",0,restored));},"REMOTE_INPUT_REPLAY");core.Input(Event(5,Empty,"reliable",0,restored));core.Input(Event(6,CtrlDown,"reliable",0,restored));
  p.Visible=false;effects=p.Effects;Reject(delegate{core.Input(Event(7,"{\"type\":\"button\",\"button\":0,\"down\":true,\"x\":32768,\"y\":32768}","reliable",0,restored));},"REMOTE_INPUT_OCCLUDED");Assert(p.Effects==effects,"downscaled pointer retains zero-effect occlusion guard");
  p.Source.Identity="sdk:different-pid-start";core.Tick();Assert(((Dictionary<string,object>)core.State())["ready"].Equals(false),"downscaled capture retains exact original PID/start association");Reject(delegate{core.Start(CaptureStart(1920,664));},"REMOTE_INPUT_SOURCE");core.Stop();
  int[,] valid={{2290,793,1920,664},{793,2290,372,1080},{1440,2560,606,1080},{2560,1440,1920,1080},{1921,1080,1920,1078},{1923,1080,1920,1078},{1920,1081,1918,1080},{1920,1083,1914,1080},{1920,1080,1920,1080},{1919,1079,1918,1078},{3840,2160,1920,1080},{32768,32768,1080,1080}};
  foreach(string kind in new string[]{"window","screen"})for(int i=0;i<valid.GetLength(0);i++){
   var projected=new FixtureInputPlatform{Source=new InputSource{Kind=kind,Identity="projection:"+kind,Hwnd=123,Rect=new InputRect(-4000,-1000,valid[i,0],valid[i,1])}};
   var allowed=new RemoteInputCore(projected,delegate{return time;});allowed.Start(ProjectionStart(projected,valid[i,2],valid[i,3]));Assert(((Dictionary<string,object>)allowed.State())["pointerReady"].Equals(true),"deterministic whole-source SDK projection "+kind+" case"+i);Assert(projected.Effects==0,"projection dimensions never grant input");LeaseCurrent(allowed,1,true);allowed.Input(Event(1,Empty));
   allowed.Input(Event(1,"{\"type\":\"move\",\"x\":0,\"y\":0}","move"));Assert(projected.LastX==-4000&&projected.LastY==-1000,"every projected source starts at its bound origin");
   allowed.Input(Event(2,"{\"type\":\"move\",\"x\":65535,\"y\":65535}","move"));Assert(projected.LastX==-4000+valid[i,0]-1&&projected.LastY==-1000+valid[i,1]-1,"every projected source ends inside its exact bound edge");allowed.Stop();
  }
  int[,] invalid={{2290,793,1920,666},{2290,793,1920,662},{2290,793,1918,664},{2290,793,1920,1080},{2290,793,1144,396},{2290,793,4580,1586},{2290,793,786,572},{2290,793,1920,665},{1900,1000,1920,1010},{1923,1080,1920,1080},{1920,1083,1916,1080},{1000,600,960,576}};
  foreach(string kind in new string[]{"window","screen"})for(int i=0;i<invalid.GetLength(0);i++){
   var blocked=new FixtureInputPlatform{Source=new InputSource{Kind=kind,Identity="negative-sdk:"+kind,Hwnd=123,Rect=new InputRect(0,0,invalid[i,0],invalid[i,1])}};
   var denied=new RemoteInputCore(blocked,delegate{return time;});denied.Start(ProjectionStart(blocked,invalid[i,2],invalid[i,3]));Assert(((Dictionary<string,object>)denied.State())["pointerReady"].Equals(false),"arbitrary crop/aspect/scale/upsize remains blocked "+kind+" case"+i);LeaseCurrent(denied,1,true);Reject(delegate{denied.Input(Event(1,Empty));},"REMOTE_INPUT_GEOMETRY");Assert(blocked.Effects==0,"negative SDK projection has zero input effects");denied.Stop();
  }
 }
 static void CaptureAlignment(){
  var p=new FixtureInputPlatform{Source=new InputSource{Kind="window",Identity="alignment:pid:start",Hwnd=123,Rect=new InputRect(-500,120,786,573),Dpi=96}};
  var core=new RemoteInputCore(p,delegate{return time;});core.Start(CaptureStart(786,572));
  Assert(((Dictionary<string,object>)core.State())["pointerReady"].Equals(true),"whole selected window 786x573 -> capture786x572 is valid even alignment");
  LeaseCurrent(core,1,true);Reject(delegate{core.Input(Event(1,CtrlDown));},"REMOTE_INPUT_REPLAY");core.Input(Event(1,Empty));
  int[] points={0,1,32767,32768,65534,65535};long move=0;
  foreach(int x in points)foreach(int y in points){
   core.Input(Event(++move,"{\"type\":\"move\",\"x\":"+x+",\"y\":"+y+"}","move"));
   int encodedY=120+(int)Math.Round((double)y*571/65535);
   Assert(p.LastX>=-500&&p.LastX<=285&&p.LastY>=120&&p.LastY<=692,"aligned normalized pointer stays inside exact bound source");
   Assert(p.LastX==-500+(int)Math.Round((double)x*785/65535)&&Math.Abs(p.LastY-encodedY)<=1,"alignment mapping error bounded by one physical pixel per aligned axis");
  }
  Assert(p.LastX==285&&p.LastY==692,"normalized maximum reaches bound window edge, never outside it");
  core.Input(Event(2,CtrlDown));int releases=p.Releases,effects=p.Effects;
  p.Source=new InputSource{Kind="window",Identity="alignment:pid:start",Hwnd=123,Rect=new InputRect(-500,120,786,575),Dpi=96};core.Tick();
  Assert(p.Releases>releases&&((Dictionary<string,object>)core.State())["pointerReady"].Equals(false),"genuine geometry mismatch releases holds and pauses aligned source");
  long changed=GeometryRevision(core);Assert(changed>1,"real source change advances geometry revision");LeaseCurrent(core,2);
  Reject(delegate{core.Input(Event(3,Empty,"reliable",0,changed));},"REMOTE_INPUT_GEOMETRY");
  Reject(delegate{core.Input(Event(3,CtrlDown,"reliable",0,changed));},"REMOTE_INPUT_GEOMETRY");
  Reject(delegate{core.Input(Event(3,"{\"type\":\"text\",\"text\":\"Привет 中文 😀\"}","reliable",0,changed));},"REMOTE_INPUT_GEOMETRY");
  Reject(delegate{core.Input(Event(move+1,"{\"type\":\"move\",\"x\":65535,\"y\":65535}","move",0,changed));},"REMOTE_INPUT_GEOMETRY");
  Assert(p.Effects==effects,"strict mismatched geometry has zero pointer/key/text/reset effects");
  p.Source=new InputSource{Kind="window",Identity="alignment:pid:start",Hwnd=123,Rect=new InputRect(-500,120,786,573),Dpi=96};core.Tick();long recovered=GeometryRevision(core);
  Assert(recovered>changed&&((Dictionary<string,object>)core.State())["pointerReady"].Equals(true),"restored even alignment advances revision and recovers geometry");
  Reject(delegate{core.Input(Event(3,Empty,"reliable",0,changed));},"REMOTE_INPUT_GEOMETRY");LeaseCurrent(core,3);
  Reject(delegate{core.Input(Event(3,CtrlDown,"reliable",0,recovered));},"REMOTE_INPUT_REPLAY");core.Input(Event(3,Empty,"reliable",0,recovered));core.Input(Event(4,CtrlDown,"reliable",0,recovered));
  p.Visible=false;effects=p.Effects;Reject(delegate{core.Input(Event(5,"{\"type\":\"button\",\"button\":0,\"down\":true,\"x\":32768,\"y\":32768}","reliable",0,recovered));},"REMOTE_INPUT_OCCLUDED");Assert(p.Effects==effects,"aligned mapping retains zero-effect occlusion guard");
  p.Source.Identity="reused-hwnd:different-pid-start";core.Tick();
  Assert(((Dictionary<string,object>)core.State())["ready"].Equals(false),"aligned capture retains exact original PID/start association");
  Reject(delegate{core.Start(CaptureStart(786,572));},"REMOTE_INPUT_SOURCE");core.Stop();

  int[,] invalid={{786,573,786,571},{786,573,786,574},{786,574,786,573},{786,573,784,572},{786,573,780,568},{786,573,393,286},{786,573,1572,1146},{800,600,799,600}};
  for(int i=0;i<invalid.GetLength(0);i++){
   var blocked=new FixtureInputPlatform{Source=new InputSource{Kind="window",Identity="negative:pid:start",Hwnd=123,Rect=new InputRect(0,0,invalid[i,0],invalid[i,1])}};
   var denied=new RemoteInputCore(blocked,delegate{return time;});denied.Start(CaptureStart(invalid[i,2],invalid[i,3]));
   Assert(((Dictionary<string,object>)denied.State())["pointerReady"].Equals(false),"inconsistent/cropped/upscaled/even-to-odd dimensions remain paused case"+i);LeaseCurrent(denied,1,true);
   Reject(delegate{denied.Input(Event(1,Empty));},"REMOTE_INPUT_GEOMETRY");Assert(blocked.Effects==0,"negative alignment case has no input effects");denied.Stop();
  }
  int[,] valid={{787,574,786,574},{787,573,786,572},{786,573,786,573}};
  for(int i=0;i<valid.GetLength(0);i++){
   var aligned=new FixtureInputPlatform{Source=new InputSource{Kind="window",Identity="positive:pid:start",Hwnd=123,Rect=new InputRect(0,0,valid[i,0],valid[i,1])}};
   var allowed=new RemoteInputCore(aligned,delegate{return time;});allowed.Start(CaptureStart(valid[i,2],valid[i,3]));Assert(((Dictionary<string,object>)allowed.State())["pointerReady"].Equals(true),"exact or odd-to-lower-even whole-window alignment case"+i);Assert(aligned.Effects==0,"geometry alone never consents to input");allowed.Stop();
  }
  var monitor=new FixtureInputPlatform{Source=new InputSource{Kind="screen",Identity="monitor",Rect=new InputRect(0,0,786,573)}};var monitorCore=new RemoteInputCore(monitor,delegate{return time;});var monitorStart=CaptureStart(786,572);
  monitorStart["source"]=Read("{\"kind\":\"screen\",\"rect\":{\"x\":0,\"y\":0,\"width\":786,\"height\":573}}");monitorStart["mapping"]=Read("{\"kind\":\"win32-monitor\"}");monitorCore.Start(monitorStart);Assert(((Dictionary<string,object>)monitorCore.State())["pointerReady"].Equals(true),"the same SDK whole-source alignment applies to monitor captures");monitorCore.Stop();
 }
 static RemoteInputCore Create(FixtureInputPlatform p){var c=new RemoteInputCore(p,delegate{return time;});c.Start(Read("{\"id\":1,\"op\":\"start\",\"captureId\":\"capture\",\"source\":{\"kind\":\"window\",\"hwnd\":\"123\"},\"video\":{\"width\":800,\"height\":600},\"mapping\":{\"kind\":\"dwm-frame\"}}"));c.Renew(Renew(1,true));c.Input(Event(1,Empty));return c;}
 static void Main(){
  SdkCaptureProjection();
  CaptureAlignment();
  // Client-owned strict policy must pause every remote effect on invalid geometry.
  var strictPlatform=new FixtureInputPlatform();var strictCore=new RemoteInputCore(strictPlatform,delegate{return time;});
  var strictStart=Read("{\"id\":1,\"op\":\"start\",\"captureId\":\"capture\",\"source\":{\"kind\":\"window\",\"hwnd\":\"123\"},\"video\":{\"width\":800,\"height\":600},\"mapping\":{\"kind\":\"dwm-frame\"},\"fullInputPause\":true}");
  strictCore.Start(strictStart);strictCore.Renew(Renew(1,true));strictCore.Input(Event(1,Empty));
  strictPlatform.Source.PointerVisible=false;strictCore.Tick();
  long strictRevision=Convert.ToInt64(((Dictionary<string,object>)((Dictionary<string,object>)strictCore.State())["geometry"])["revision"]);
  var strictLease=Renew(2);strictLease["geometryRevision"]=strictRevision;strictCore.Renew(strictLease);
  int strictEffects=strictPlatform.Effects;
  Reject(delegate{strictCore.Input(Event(2,Empty,"reliable",0,strictRevision));},"REMOTE_INPUT_GEOMETRY");
  Reject(delegate{strictCore.Input(Event(2,CtrlDown,"reliable",0,strictRevision));},"REMOTE_INPUT_GEOMETRY");
  Reject(delegate{strictCore.Input(Event(2,"{\"type\":\"text\",\"text\":\"Привет 中文 😀\"}","reliable",0,strictRevision));},"REMOTE_INPUT_GEOMETRY");
  Assert(strictPlatform.Effects==strictEffects,"strict invalid geometry blocks keyboard and committed text");
  strictPlatform.Source.PointerVisible=true;strictCore.Tick();
  strictRevision=Convert.ToInt64(((Dictionary<string,object>)((Dictionary<string,object>)strictCore.State())["geometry"])["revision"]);
  strictLease=Renew(3);strictLease["geometryRevision"]=strictRevision;strictCore.Renew(strictLease);
  Reject(delegate{strictCore.Input(Event(2,CtrlDown,"reliable",0,strictRevision));},"REMOTE_INPUT_REPLAY");
  strictCore.Input(Event(2,Empty,"reliable",0,strictRevision));strictCore.Input(Event(3,CtrlDown,"reliable",0,strictRevision));
  Assert(strictPlatform.Effects>strictEffects,"strict recovery requires explicit receiver empty reset");
  strictCore.RetireAuthority();
  Reject(delegate{strictCore.Input(Event(4,CtrlDown,"reliable",0,strictRevision));},"REMOTE_INPUT_LEASE");
  strictLease=Renew(1,true);strictLease["geometryRevision"]=strictRevision;strictLease["grantId"]="new-grant";strictCore.Renew(strictLease);
  var newReset=Event(1,Empty,"reliable",0,strictRevision);newReset["grantId"]="new-grant";strictCore.Input(newReset);
  var newKey=Event(2,CtrlDown,"reliable",0,strictRevision);newKey["grantId"]="new-grant";strictCore.Input(newKey);
  Assert(strictPlatform.Effects>strictEffects,"new registration revision1 uses retained source after authority retirement");strictCore.Stop();
  var p=new FixtureInputPlatform();var c=Create(p);
  c.Input(Event(2,CtrlDown));int effects=p.Effects;
  // API authority may remain fresh forever; missing keyup snapshot still releases Ctrl.
  Reject(delegate{c.Input(Event(3,Empty));},"REMOTE_INPUT_REPLAY");Assert(p.Releases>0&&p.Effects==effects,"snapshot must release, never synthesize DOWN");
  Reject(delegate{c.Input(Event(4,Empty));},"REMOTE_INPUT_REPLAY");c.Renew(Renew(2));c.Input(Event(4,Empty));
  c.Input(Event(5,CtrlDown));time+=501;c.Renew(Renew(3));Assert(((Dictionary<string,object>)c.State())["needsEmptyReset"].Equals(true),"receiver watchdog independent of fresh server");
  c.Input(Event(6,Empty));c.Input(Event(7,CtrlDown));int release=p.Releases;
  time+=751;c.Tick();Assert(p.Releases>release,"server lease watchdog");Reject(delegate{c.Input(Event(8,Empty));},"REMOTE_INPUT_LEASE");
  c.Renew(Renew(4));c.Input(Event(8,Empty));
  var stale=Renew(4);Reject(delegate{c.Renew(stale);},"REMOTE_INPUT_LEASE");
  c.Input(Event(9,"{\"type\":\"move\",\"x\":0,\"y\":65535}","move"));Assert(p.LastX==-1920&&p.LastY==599,"negative origin mapping");
  c.Input(Event(9,"{\"type\":\"button\",\"button\":0,\"down\":true,\"x\":0,\"y\":0}","reliable",12));
  Reject(delegate{c.Input(Event(11,"{\"type\":\"move\",\"x\":0,\"y\":0}","move"));},"REMOTE_INPUT_REPLAY");
  p.Visible=false;effects=p.Effects;Reject(delegate{c.Input(Event(10,"{\"type\":\"button\",\"button\":0,\"down\":false,\"x\":0,\"y\":0}"));},"REMOTE_INPUT_OCCLUDED");Assert(p.Effects==effects,"occluded pointer has zero effects");
  c.Renew(Renew(5));c.Input(Event(10,Empty));c.Input(Event(11,"{\"type\":\"text\",\"text\":\"fixture\\r\\n\"}"));
  // A moved window changes geometry; old geometry cannot inject. Keyboard authority
  // remains full-PC after fresh lease + empty reset even if pointer is not visible.
  p.Source=new InputSource{Kind="window",Identity="hwnd:pid:start",Hwnd=123,Rect=new InputRect(-1800,0,800,600),PointerVisible=false};c.Tick();
  Reject(delegate{c.Input(Event(12,CtrlDown));},"REMOTE_INPUT_GEOMETRY");var next=Renew(6);next["geometryRevision"]=2;c.Renew(next);c.Input(Event(12,Empty,"reliable",0,2));c.Input(Event(13,CtrlDown,"reliable",0,2));
  p.Source.Identity="different-pid-start";c.Tick();var closedSource=(Dictionary<string,object>)c.State();
  Assert(closedSource["ready"].Equals(false),"lost PID/start binding closes source authority");
  Assert(closedSource["stopped"].Equals(false),"ordinary source pause is not a terminal local Stop");
  long currentGeometry=Convert.ToInt64(((Dictionary<string,object>)closedSource["geometry"])["revision"]);effects=p.Effects;
  Reject(delegate{c.Input(Event(14,CtrlDown,"reliable",0,currentGeometry));},"REMOTE_INPUT_LEASE");Assert(p.Effects==effects,"lost source rejects even current geometry without input effects");
  // Exact parity for DOM codes accepted by the Node adapter (pure mapping, no OS).
  Assert(WindowsRemoteInputPlatform.Scan("Pause")==0x213,"Pause uses explicit VK_PAUSE mode");Assert(WindowsRemoteInputPlatform.Scan("F24")==0x76,"F24 set1 scan");
  var resizePlatform=new FixtureInputPlatform();var resizeCore=new RemoteInputCore(resizePlatform,delegate{return time;});
  var resize=Read("{\"id\":1,\"op\":\"start\",\"captureId\":\"capture\",\"source\":{\"kind\":\"window\",\"hwnd\":\"123\"},\"video\":{\"width\":1,\"height\":1},\"mapping\":{\"kind\":\"dwm-frame\"}}");resizeCore.Start(resize);
  ((Dictionary<string,object>)resize["video"])["width"]=799;((Dictionary<string,object>)resize["video"])["height"]=600;resizeCore.Start(resize);
  Assert(((Dictionary<string,object>)((Dictionary<string,object>)resizeCore.State())["geometry"])["revision"].Equals(2L),"changed video increments revision while pointer remains paused");
  resizeCore.Start(resize);Assert(((Dictionary<string,object>)((Dictionary<string,object>)resizeCore.State())["geometry"])["revision"].Equals(2L),"same video measurement retains revision");
  // A full native stdout pipe must not own the input lock or stall its watchdog.
  time=200000;var blockedPlatform=new FixtureInputPlatform();var blockedCore=Create(blockedPlatform);blockedCore.Input(Event(2,CtrlDown));
  var entered=new ManualResetEvent(false);var unblock=new ManualResetEvent(false);var pump=new RemoteInputOutput(delegate(string ignored){entered.Set();unblock.WaitOne();},2);
  try{
   Assert(pump.TryWrite("state"),"first output queued");Assert(entered.WaitOne(1000),"writer entered fixture block");Assert(pump.TryWrite("state")&&pump.TryWrite("state"),"bounded queue fills");Assert(!pump.TryWrite("state"),"queue overflow is nonblocking");
   int beforeRelease=blockedPlatform.Releases;time+=751;lock(blockedCore.Sync){blockedCore.Tick();blockedCore.Stop();}Assert(blockedPlatform.Releases>beforeRelease,"blocked stdout cannot prevent lease release and Stop");
  }finally{unblock.Set();pump.CompleteAndJoin(500);}
  c.Stop();Assert(((Dictionary<string,object>)c.State())["stopped"].Equals(true),"explicit local Stop is terminal state");Console.WriteLine("remote input core: snapshot, gaps, independent watchdogs, source, geometry, occlusion PASS (no OS input)");
 }
}
