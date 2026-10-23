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
 static RemoteInputCore Create(FixtureInputPlatform p){var c=new RemoteInputCore(p,delegate{return time;});c.Start(Read("{\"id\":1,\"op\":\"start\",\"captureId\":\"capture\",\"source\":{\"kind\":\"window\",\"hwnd\":\"123\"},\"video\":{\"width\":800,\"height\":600},\"mapping\":{\"kind\":\"dwm-frame\"}}"));c.Renew(Renew(1,true));c.Input(Event(1,Empty));return c;}
 static void Main(){
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
  c.Stop();Console.WriteLine("remote input core: snapshot, gaps, independent watchdogs, source, geometry, occlusion PASS (no OS input)");
 }
}
