using System;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

internal sealed class InputFailure : Exception {
 internal readonly string Code;
 internal InputFailure(string code):base(code){Code=code;}
}
internal sealed class InputRect {
 internal int X,Y,Width,Height;
 internal InputRect(int x,int y,int width,int height){X=x;Y=y;Width=width;Height=height;}
 internal bool Same(InputRect b){return b!=null&&X==b.X&&Y==b.Y&&Width==b.Width&&Height==b.Height;}
 internal object Export(){return new Dictionary<string,object>{{"x",X},{"y",Y},{"width",Width},{"height",Height}};}
}
internal sealed class InputSource {
 internal string Kind,Identity;internal long Hwnd;internal InputRect Rect;internal bool PointerVisible=true;internal uint Dpi;
}
internal interface IRemoteInputPlatform {
 InputSource Bind(Dictionary<string,object> source);
 InputSource Inspect(InputSource source);
 bool SafeDesktop();
 bool VisiblePoint(InputSource source,int x,int y);
 void Move(int x,int y);void Button(int button,bool down);void Key(string code,bool down,bool repeat);void Text(string text);void Wheel(int dx,int dy);void ReleaseAll();
}
internal static class InputJson {
 internal static Dictionary<string,object> Obj(object value){var o=value as Dictionary<string,object>;if(o==null)throw new InputFailure("REMOTE_INPUT_PROTOCOL");return o;}
 internal static object Get(Dictionary<string,object> o,string key){object value;if(!o.TryGetValue(key,out value))throw new InputFailure("REMOTE_INPUT_PROTOCOL");return value;}
 internal static string Str(Dictionary<string,object> o,string key){var s=Get(o,key) as string;if(s==null||s.Length>256)throw new InputFailure("REMOTE_INPUT_PROTOCOL");return s;}
 internal static long Num(Dictionary<string,object> o,string key,long min,long max){object n=Get(o,key);if(!(n is int)&&!(n is long))throw new InputFailure("REMOTE_INPUT_PROTOCOL");long v=Convert.ToInt64(n,CultureInfo.InvariantCulture);if(v<min||v>max)throw new InputFailure("REMOTE_INPUT_PROTOCOL");return v;}
 internal static bool Bool(Dictionary<string,object> o,string key){object b=Get(o,key);if(!(b is bool))throw new InputFailure("REMOTE_INPUT_PROTOCOL");return(bool)b;}
 internal static string Token(Dictionary<string,object> o,string key){string s=Str(o,key);if(!System.Text.RegularExpressions.Regex.IsMatch(s,"^[A-Za-z0-9_-]{1,128}$"))throw new InputFailure("REMOTE_INPUT_PROTOCOL");return s;}
 internal static void Count(Dictionary<string,object> o,int count){if(o.Count!=count)throw new InputFailure("REMOTE_INPUT_PROTOCOL");}
}
// No network or renderer is trusted here. All deadlines are absolute, then compared
// against a monotonic Unix clock anchored once at process start (not receipt+TTL).
internal sealed class RemoteInputCore {
 internal readonly object Sync=new object();readonly IRemoteInputPlatform platform;readonly Func<long> now;
 InputSource source;InputRect rect,dragRect;string capture,grant;long revision=1,grantRevision,lastGrantRevision,serial,deadline,reliableSeq,moveSeq,moveBarrier;int videoWidth,videoHeight,buttons;bool ready,pointerReady,stopped,observed,fullInputPause,needsEmptyReset=true;long receiverDeadline,resetSerial;readonly HashSet<string> pressedKeys=new HashSet<string>();string error;
 internal RemoteInputCore(IRemoteInputPlatform platform,Func<long> now){this.platform=platform;this.now=now;}
 internal object State(){return new Dictionary<string,object>{{"resourceVersion","CastLink.RemoteInput/full-input-pause/2"},{"captureId",capture},{"geometry",new Dictionary<string,object>{{"width",rect==null?1:rect.Width},{"height",rect==null?1:rect.Height},{"revision",revision}}},{"rect",rect==null?null:rect.Export()},{"pointerReady",pointerReady&&!stopped},{"ready",ready&&!stopped},{"active",ready&&(!fullInputPause||pointerReady)&&!stopped&&!needsEmptyReset&&grant!=null&&deadline>now()},{"stopped",stopped},{"needsEmptyReset",needsEmptyReset},{"error",error}};}
 void Fail(string code){throw new InputFailure(code);}
 void Release(){platform.ReleaseAll();buttons=0;dragRect=null;pressedKeys.Clear();}
 void PauseReceiver(){Release();needsEmptyReset=true;resetSerial=serial;}
 internal void Stop(){deadline=0;stopped=true;ready=false;pointerReady=false;Release();}
 internal bool Tick(){
  if(source==null||stopped)return false;bool previousReady=ready,previousPointer=pointerReady;long previousRevision=revision;bool changed=InspectTick();
  if(observed&&(previousReady!=ready||previousPointer!=pointerReady)&&previousRevision==revision){revision++;changed=true;}observed=true;return changed;
 }
 // Whole-source capture permits exact extents or odd-to-lower-even alignment.
 static bool CaptureExtentMatches(int physical,int captured){return physical==captured||((physical&1)==1&&captured==physical-1);}
 bool WholeSourceCaptureMatches(){
  if(CaptureExtentMatches(rect.Width,videoWidth)&&CaptureExtentMatches(rect.Height,videoHeight))return true;
  // Existing SDK capture defaults use ideal1920x1080 for both windows/monitors.
  // Admit only that fixed whole-source projection, never a renderer-selected
  // scale or aspect epsilon. Rational arithmetic avoids rounding at even edges.
  if(rect.Width<=1920&&rect.Height<=1080)return false;
  int width,height;
  if((long)rect.Width*1080>=(long)rect.Height*1920){width=1920;height=(int)(2*((long)rect.Height*1920/(2L*rect.Width)));}
  else{height=1080;width=(int)(2*((long)rect.Width*1080/(2L*rect.Height)));}
  return videoWidth==width&&videoHeight==height;
 }
 bool InspectTick(){
  if(source==null||stopped)return false;bool changed=false;
  if(deadline>0&&deadline<=now()){deadline=0;PauseReceiver();error="REMOTE_INPUT_LEASE";changed=true;}
  if(receiverDeadline>0&&receiverDeadline<=now()&&!needsEmptyReset){PauseReceiver();error="REMOTE_INPUT_REPLAY";changed=true;}
  if(!platform.SafeDesktop()){if(ready){ready=false;pointerReady=false;PauseReceiver();error="REMOTE_INPUT_DESKTOP";changed=true;}return changed;}
  InputSource current=platform.Inspect(source);
  if(current==null||current.Identity!=source.Identity){if(ready){ready=false;pointerReady=false;PauseReceiver();error="REMOTE_INPUT_SOURCE";changed=true;}return changed;}
  // Freeze the initial transform while dragging a translated, same-sized window.
  bool translatingDrag=buttons!=0&&source.Kind=="window"&&dragRect!=null&&current.Rect.Width==rect.Width&&current.Rect.Height==rect.Height;
  if((!rect.Same(current.Rect)&&!translatingDrag)||current.Dpi!=source.Dpi){PauseReceiver();rect=current.Rect;source.Dpi=current.Dpi;source.Rect=current.Rect;revision++;pointerReady=false;error="REMOTE_INPUT_GEOMETRY";changed=true;}
  bool matches=current.PointerVisible&&WholeSourceCaptureMatches();
  if(pointerReady!=matches){pointerReady=matches;if(!pointerReady)PauseReceiver();error=pointerReady?null:"REMOTE_INPUT_GEOMETRY";changed=true;}
  if(!ready){ready=true;changed=true;}
  return changed;
 }
 internal void Start(Dictionary<string,object> c){
  string id=InputJson.Token(c,"captureId");Dictionary<string,object> src=InputJson.Obj(InputJson.Get(c,"source")),video=InputJson.Obj(InputJson.Get(c,"video")),mapping=InputJson.Obj(InputJson.Get(c,"mapping"));
  bool strict=c.ContainsKey("fullInputPause")&&InputJson.Bool(c,"fullInputPause");
  InputJson.Count(c,c.ContainsKey("fullInputPause")?7:6);InputJson.Count(video,2);InputJson.Count(mapping,1);
  if(source!=null&&strict!=fullInputPause)Fail("REMOTE_INPUT_SOURCE");
  int width=(int)InputJson.Num(video,"width",1,32768),height=(int)InputJson.Num(video,"height",1,32768);
  string kind=InputJson.Str(src,"kind"),rule=InputJson.Str(mapping,"kind");
  if((kind=="window"&&rule!="dwm-frame")||(kind=="screen"&&rule!="win32-monitor"))Fail("REMOTE_INPUT_GEOMETRY");
  var selected=platform.Bind(src);if(selected==null||selected.Rect==null)Fail("REMOTE_INPUT_SOURCE");
  if(source!=null){if(stopped||id!=capture||selected.Identity!=source.Identity||selected.Kind!=source.Kind)Fail("REMOTE_INPUT_SOURCE");if(videoWidth!=width||videoHeight!=height){PauseReceiver();revision++;}}
  else{source=selected;rect=selected.Rect;capture=id;fullInputPause=strict;}
  videoWidth=width;videoHeight=height;Tick();
 }
 void Match(Dictionary<string,object> c){if(source==null||stopped||InputJson.Token(c,"captureId")!=capture||InputJson.Num(c,"geometryRevision",1,9007199254740991L)!=revision)Fail("REMOTE_INPUT_GEOMETRY");}
 internal void Renew(Dictionary<string,object> c){
  InputJson.Count(c,9);Tick();Match(c);if(!ready)Fail(error??"REMOTE_INPUT_GEOMETRY");
  string nextGrant=InputJson.Token(c,"grantId");long nextRevision=InputJson.Num(c,"revision",1,9007199254740991L),nextSerial=InputJson.Num(c,"leaseSerial",1,9007199254740991L),expires=InputJson.Num(c,"expiresAt",1,9007199254740991L);bool activate=InputJson.Bool(c,"activate");
  if(expires<=now()||expires>now()+750)Fail("REMOTE_INPUT_LEASE");
  if(activate){if(nextRevision<=lastGrantRevision)Fail("REMOTE_INPUT_LEASE");Release();reliableSeq=moveSeq=moveBarrier=0;lastGrantRevision=nextRevision;needsEmptyReset=true;resetSerial=nextSerial-1;receiverDeadline=0;}
  else if(nextGrant!=grant||nextRevision!=grantRevision||nextSerial<=serial)Fail("REMOTE_INPUT_LEASE");
  grant=nextGrant;grantRevision=nextRevision;serial=nextSerial;deadline=expires;error=null;
 }
 internal void Input(Dictionary<string,object> c){
  InputJson.Count(c,11);Tick();Match(c);
  if(!ready||grant==null||deadline<=now()||InputJson.Token(c,"grantId")!=grant||InputJson.Num(c,"revision",1,9007199254740991L)!=grantRevision)Fail("REMOTE_INPUT_LEASE");
  long expires=InputJson.Num(c,"expiresAt",1,9007199254740991L);if(expires<=now()||expires>now()+750){PauseReceiver();Fail("REMOTE_INPUT_LEASE");}
  string lane=InputJson.Str(c,"lane");long seq=InputJson.Num(c,"seq",1,9007199254740991L),barrier=InputJson.Num(c,"moveBarrier",0,9007199254740991L);
  if(lane!="move"&&lane!="reliable")Fail("REMOTE_INPUT_EVENT");
  if((lane=="move"&&(seq<=moveSeq||seq<=moveBarrier))||(lane=="reliable"&&seq<=reliableSeq))Fail("REMOTE_INPUT_REPLAY");
  var e=InputJson.Obj(InputJson.Get(c,"event"));string type=InputJson.Str(e,"type");
  bool heartbeat=type=="heartbeat",emptyHeartbeat=false;
  HashSet<string> snapshotKeys=null;int snapshotButtons=0;
  if(heartbeat){
   InputJson.Count(e,3);var keys=InputJson.Get(e,"pressedKeys") as object[];var mouse=InputJson.Get(e,"pressedButtons") as object[];
   if(keys==null||mouse==null||keys.Length>32||mouse.Length>3)Fail("REMOTE_INPUT_EVENT");snapshotKeys=new HashSet<string>();
   foreach(object key in keys){string code=key as string;if(code==null)Fail("REMOTE_INPUT_EVENT");WindowsRemoteInputPlatform.Scan(code);if(!snapshotKeys.Add(code))Fail("REMOTE_INPUT_EVENT");}
   foreach(object button in mouse){if(!(button is int)||(int)button<0||(int)button>2)Fail("REMOTE_INPUT_EVENT");int bit=1<<(int)button;if((snapshotButtons&bit)!=0)Fail("REMOTE_INPUT_EVENT");snapshotButtons|=bit;}
   emptyHeartbeat=snapshotKeys.Count==0&&snapshotButtons==0;
  }
  if(fullInputPause&&!pointerReady&&type!="releaseAll")Fail("REMOTE_INPUT_GEOMETRY");
  if(lane=="reliable"&&(seq!=reliableSeq+1||needsEmptyReset)){
   if(!needsEmptyReset)PauseReceiver();
   if(!emptyHeartbeat||serial<=resetSerial)Fail("REMOTE_INPUT_REPLAY");needsEmptyReset=false;
  }
  if(needsEmptyReset)Fail("REMOTE_INPUT_REPLAY");
  if(lane=="move"&&type!="move")Fail("REMOTE_INPUT_EVENT");if(lane=="reliable"&&type=="move")Fail("REMOTE_INPUT_EVENT");
  if(type=="move"||type=="button"||type=="wheel"){
   if(!pointerReady)Fail("REMOTE_INPUT_GEOMETRY");
   int nx=(int)InputJson.Num(e,"x",0,65535),ny=(int)InputJson.Num(e,"y",0,65535);InputRect map=dragRect??rect;
   int x=map.X+(int)Math.Round((double)nx*(map.Width-1)/65535),y=map.Y+(int)Math.Round((double)ny*(map.Height-1)/65535);
   if(!platform.VisiblePoint(source,x,y)){PauseReceiver();error="REMOTE_INPUT_OCCLUDED";Fail("REMOTE_INPUT_OCCLUDED");}
   if(type=="move")InputJson.Count(e,3);
   if(type=="button"){InputJson.Count(e,5);InputJson.Num(e,"button",0,2);InputJson.Bool(e,"down");}
   if(type=="wheel"){InputJson.Count(e,5);InputJson.Num(e,"deltaX",-12000,12000);InputJson.Num(e,"deltaY",-12000,12000);}
   platform.Move(x,y);
   if(type=="button"){
    int button=(int)InputJson.Num(e,"button",0,2);bool down=InputJson.Bool(e,"down");if(down&&buttons==0)dragRect=new InputRect(rect.X,rect.Y,rect.Width,rect.Height);
    platform.Button(button,down);if(down)buttons|=1<<button;else buttons&=~(1<<button);if(buttons==0)dragRect=null;
   }
   if(type=="wheel")platform.Wheel((int)InputJson.Num(e,"deltaX",-12000,12000),(int)InputJson.Num(e,"deltaY",-12000,12000));
   if(type!="move")moveBarrier=Math.Max(moveBarrier,barrier);
  }else if(type=="key"){InputJson.Count(e,4);string code=InputJson.Str(e,"code");bool down=InputJson.Bool(e,"down");platform.Key(code,down,InputJson.Bool(e,"repeat"));if(down)pressedKeys.Add(code);else pressedKeys.Remove(code);}
  else if(type=="text"){InputJson.Count(e,2);string text=InputJson.Str(e,"text");if(text.Length==0)Fail("REMOTE_INPUT_EVENT");foreach(char ch in text)if(ch<32&&ch!='\n'&&ch!='\r'&&ch!='\t'||ch==127)Fail("REMOTE_INPUT_EVENT");platform.Text(text);}
  else if(type=="releaseAll"){InputJson.Count(e,1);PauseReceiver();}
  else if(heartbeat){if(!pressedKeys.SetEquals(snapshotKeys)||buttons!=snapshotButtons){PauseReceiver();Fail("REMOTE_INPUT_REPLAY");}receiverDeadline=now()+500;}
  else Fail("REMOTE_INPUT_EVENT");
  if(lane=="move")moveSeq=seq;else reliableSeq=seq;
 }
 internal void ReleaseAll(){PauseReceiver();}
 // Main-only registration handoff. Retain the capture's bound PID/start and
 // geometry; reset only the already released, retired server authority.
 internal void RetireAuthority(){PauseReceiver();grant=null;grantRevision=lastGrantRevision=serial=deadline=receiverDeadline=reliableSeq=moveSeq=moveBarrier=resetSerial=0;}
}

internal sealed class WindowsRemoteInputPlatform : IRemoteInputPlatform {
 internal const uint EmergencyVirtualKey=0x77;
 [StructLayout(LayoutKind.Sequential)]struct RECT{public int Left,Top,Right,Bottom;}
 [StructLayout(LayoutKind.Sequential)]struct POINT{public int X,Y;public POINT(int x,int y){X=x;Y=y;}}
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]struct MONITORINFO{public int Size;public RECT Rect,Work;public uint Flags;[MarshalAs(UnmanagedType.ByValTStr,SizeConst=32)]public string Device;}
 delegate bool MonitorProc(IntPtr monitor,IntPtr hdc,ref RECT rect,IntPtr data);
 [DllImport("user32.dll")]static extern bool EnumDisplayMonitors(IntPtr hdc,IntPtr clip,MonitorProc proc,IntPtr data);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern bool GetMonitorInfo(IntPtr monitor,ref MONITORINFO info);
 [DllImport("user32.dll")]static extern bool IsWindow(IntPtr hwnd);
 [DllImport("user32.dll")]static extern bool IsWindowVisible(IntPtr hwnd);
 [DllImport("user32.dll")]static extern bool IsIconic(IntPtr hwnd);
 [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr hwnd,out uint pid);
 [DllImport("user32.dll")]static extern IntPtr WindowFromPoint(POINT point);
 [DllImport("user32.dll")]static extern IntPtr GetAncestor(IntPtr hwnd,uint flags);
 [DllImport("dwmapi.dll")]static extern int DwmGetWindowAttribute(IntPtr hwnd,int attribute,out RECT rect,int size);
 [DllImport("dwmapi.dll",EntryPoint="DwmGetWindowAttribute")]static extern int DwmGetWindowInt(IntPtr hwnd,int attribute,out int value,int size);
 [DllImport("user32.dll")]static extern int GetSystemMetrics(int index);
 [DllImport("user32.dll")]static extern bool SetProcessDpiAwarenessContext(IntPtr context);
 [DllImport("user32.dll")]static extern uint GetDpiForWindow(IntPtr hwnd);
 [DllImport("user32.dll")]static extern uint SendInput(uint count,INPUT[] inputs,int size);
 [DllImport("user32.dll",SetLastError=true)]static extern IntPtr OpenInputDesktop(uint flags,bool inherit,uint access);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern bool GetUserObjectInformation(IntPtr handle,int index,StringBuilder name,uint length,out uint needed);
 [DllImport("user32.dll")]static extern bool CloseDesktop(IntPtr desktop);
 [DllImport("user32.dll")]static extern short GetAsyncKeyState(int vk);
 [StructLayout(LayoutKind.Sequential)]struct MOUSEINPUT{public int X,Y;public uint Data,Flags,Time;public UIntPtr Extra;}
 [StructLayout(LayoutKind.Sequential)]struct KEYBDINPUT{public ushort Vk,Scan;public uint Flags,Time;public UIntPtr Extra;}
 [StructLayout(LayoutKind.Explicit)]struct UNION{[FieldOffset(0)]public MOUSEINPUT Mouse;[FieldOffset(0)]public KEYBDINPUT Key;}
 [StructLayout(LayoutKind.Sequential)]struct INPUT{public uint Type;public UNION Value;}
 static readonly UIntPtr Marker=new UIntPtr(0x434C5250);readonly HashSet<string> remoteKeys=new HashSet<string>();readonly HashSet<int> remoteButtons=new HashSet<int>();
 readonly object physicalLock=new object();readonly HashSet<int> physical=new HashSet<int>();
 internal WindowsRemoteInputPlatform(){if(!SetProcessDpiAwarenessContext(new IntPtr(-4)))throw new InputFailure("REMOTE_INPUT_GEOMETRY");}
 static InputRect RectOf(RECT r){if(r.Right<=r.Left||r.Bottom<=r.Top||r.Right-r.Left>32768||r.Bottom-r.Top>32768)return null;return new InputRect(r.Left,r.Top,r.Right-r.Left,r.Bottom-r.Top);}
 InputSource Window(long hwnd){
  try{IntPtr h=new IntPtr(hwnd);int cloaked;RECT r;
   if(!IsWindow(h)||GetAncestor(h,2)!=h)return null;
   bool visible=IsWindowVisible(h)&&!IsIconic(h)&&DwmGetWindowInt(h,14,out cloaked,4)==0&&cloaked==0;
   bool hasRect=DwmGetWindowAttribute(h,9,out r,Marshal.SizeOf(typeof(RECT)))==0;
   uint pid;GetWindowThreadProcessId(h,out pid);if(pid==0)return null;
   using(var process=Process.GetProcessById((int)pid)){return new InputSource{Kind="window",Hwnd=hwnd,Identity=hwnd+":"+pid+":"+process.StartTime.ToUniversalTime().Ticks,Rect=visible&&hasRect?RectOf(r):null,PointerVisible=visible&&hasRect,Dpi=GetDpiForWindow(h)};}
  }catch{return null;}
 }
 InputSource Monitor(InputRect expected){
  InputSource found=null;int matches=0;EnumDisplayMonitors(IntPtr.Zero,IntPtr.Zero,delegate(IntPtr h,IntPtr dc,ref RECT r,IntPtr unused){
   var info=new MONITORINFO{Size=Marshal.SizeOf(typeof(MONITORINFO))};if(GetMonitorInfo(h,ref info)){InputRect rect=RectOf(info.Rect);if(expected.Same(rect)){matches++;found=new InputSource{Kind="screen",Identity=info.Device,Rect=rect};}}return true;
  },IntPtr.Zero);return matches==1?found:null;
 }
 public InputSource Bind(Dictionary<string,object> s){
  string kind=InputJson.Str(s,"kind");if(kind=="window"){
   InputJson.Count(s,2);long hwnd;string raw=InputJson.Str(s,"hwnd");if(!System.Text.RegularExpressions.Regex.IsMatch(raw,"^[1-9][0-9]{0,18}$")||!Int64.TryParse(raw,NumberStyles.None,CultureInfo.InvariantCulture,out hwnd))return null;return Window(hwnd);
  }if(kind=="screen"){
   InputJson.Count(s,2);var r=InputJson.Obj(InputJson.Get(s,"rect"));InputJson.Count(r,4);return Monitor(new InputRect((int)InputJson.Num(r,"x",-100000,100000),(int)InputJson.Num(r,"y",-100000,100000),(int)InputJson.Num(r,"width",1,32768),(int)InputJson.Num(r,"height",1,32768)));
  }return null;
 }
 public InputSource Inspect(InputSource s){var current=s.Kind=="window"?Window(s.Hwnd):Monitor(s.Rect);if(current!=null&&current.Rect==null)current.Rect=s.Rect;return current;}
 public bool SafeDesktop(){IntPtr d=OpenInputDesktop(0,false,1);if(d==IntPtr.Zero)return false;try{uint needed;var name=new StringBuilder(256);return GetUserObjectInformation(d,2,name,512,out needed)&&name.ToString()=="Default";}finally{CloseDesktop(d);}}
 public bool VisiblePoint(InputSource source,int x,int y){
  InputSource current=Inspect(source);if(current==null||!current.PointerVisible||current.Identity!=source.Identity||x<current.Rect.X||y<current.Rect.Y||x>=current.Rect.X+current.Rect.Width||y>=current.Rect.Y+current.Rect.Height)return false;
  if(source.Kind=="screen")return true;IntPtr at=WindowFromPoint(new POINT(x,y));return at!=IntPtr.Zero&&GetAncestor(at,2).ToInt64()==source.Hwnd;
 }
 static void Send(INPUT i){if(SendInput(1,new INPUT[]{i},Marshal.SizeOf(typeof(INPUT)))!=1)throw new InputFailure("REMOTE_INPUT_UNAVAILABLE");}
 static INPUT Mouse(uint flags,uint data,int x,int y){return new INPUT{Type=0,Value=new UNION{Mouse=new MOUSEINPUT{Flags=flags,Data=data,X=x,Y=y,Extra=Marker}}};}
 public void Move(int x,int y){int left=GetSystemMetrics(76),top=GetSystemMetrics(77),w=GetSystemMetrics(78),h=GetSystemMetrics(79);if(w<2||h<2||x<left||y<top||x>=left+w||y>=top+h)throw new InputFailure("REMOTE_INPUT_GEOMETRY");Send(Mouse(0x0001|0x8000|0x4000,0,(int)Math.Round((double)(x-left)*65535/(w-1)),(int)Math.Round((double)(y-top)*65535/(h-1))));}
 bool Physical(int vk){lock(physicalLock)return physical.Contains(vk);}
 public void Button(int button,bool down){int vk=button==0?1:button==1?4:2;uint flag=button==0?(down?2U:4U):button==1?(down?0x20U:0x40U):(down?8U:16U);
  if(down){if(remoteButtons.Contains(button))return;if(Physical(vk)||GetAsyncKeyState(vk)<0)return;remoteButtons.Add(button);Send(Mouse(flag,0,0,0));}
  else if(remoteButtons.Remove(button)&&!Physical(vk))Send(Mouse(flag,0,0,0));
 }
 internal static int Scan(string code){
  const string letters="QWERTYUIOPASDFGHJKLZXCVBNM";int[] scans={16,17,18,19,20,21,22,23,24,25,30,31,32,33,34,35,36,37,38,44,45,46,47,48,49,50};
  if(code=="Pause")return 0x213;
  if(code.Length==4&&code.StartsWith("Key",StringComparison.Ordinal)){int p=letters.IndexOf(code[3]);if(p>=0)return scans[p];}
  if(code.Length==6&&code.StartsWith("Digit",StringComparison.Ordinal)&&code[5]>='0'&&code[5]<='9')return code[5]=='0'?11:code[5]-'1'+2;
  int f;if(code.StartsWith("F",StringComparison.Ordinal)&&Int32.TryParse(code.Substring(1),out f)&&f>=1&&f<=24)return f<=10?58+f:f<=12?87+f-11:f==24?0x76:100+f-13;
  string[] names={"Escape","Backspace","Tab","Enter","ControlLeft","ShiftLeft","ShiftRight","AltLeft","Space","CapsLock","NumLock","ScrollLock","Backquote","Minus","Equal","BracketLeft","BracketRight","Backslash","Semicolon","Quote","Comma","Period","Slash","IntlBackslash","ControlRight","AltRight","MetaLeft","MetaRight","ArrowUp","ArrowLeft","ArrowRight","ArrowDown","Insert","Delete","Home","End","PageUp","PageDown","NumpadEnter","NumpadDivide","NumpadMultiply","NumpadSubtract","NumpadAdd","NumpadDecimal","Numpad0","Numpad1","Numpad2","Numpad3","Numpad4","Numpad5","Numpad6","Numpad7","Numpad8","Numpad9","PrintScreen"};
  int[] codes={1,14,15,28,29,42,54,56,57,58,69,70,41,12,13,26,27,43,39,40,51,52,53,86,0x11d,0x138,0x15b,0x15c,0x148,0x14b,0x14d,0x150,0x152,0x153,0x147,0x14f,0x149,0x151,0x11c,0x135,55,74,78,83,82,79,80,81,75,76,77,71,72,73,0x137};
  for(int i=0;i<names.Length;i++)if(code==names[i])return codes[i];throw new InputFailure("REMOTE_INPUT_EVENT");
 }
 [DllImport("user32.dll")]static extern uint MapVirtualKey(uint value,uint mode);
 static void KeySend(int scan,bool up){if(scan>=0x200){Send(new INPUT{Type=1,Value=new UNION{Key=new KEYBDINPUT{Vk=(ushort)(scan&255),Flags=up?2U:0U,Extra=Marker}}});return;}Send(new INPUT{Type=1,Value=new UNION{Key=new KEYBDINPUT{Scan=(ushort)(scan&255),Flags=8U|(scan>255?1U:0U)|(up?2U:0U),Extra=Marker}}});}
 public void Key(string code,bool down,bool repeat){int scan=Scan(code),vk=scan>=0x200?scan&255:(int)MapVirtualKey((uint)((scan>255?0xe000:0)|(scan&255)),3);
  if(down){if(!remoteKeys.Contains(code)){if(Physical(vk)||GetAsyncKeyState(vk)<0)return;remoteKeys.Add(code);}else if(!repeat)return;KeySend(scan,false);}
  else if(remoteKeys.Remove(code)&&!Physical(vk))KeySend(scan,true);
 }
 public void Text(string text){
  // One bounded call avoids holding the watchdog lock across up to512 Win32 calls.
  var batch=new INPUT[text.Length*2];for(int i=0;i<text.Length;i++){batch[i*2]=new INPUT{Type=1,Value=new UNION{Key=new KEYBDINPUT{Scan=text[i],Flags=4,Extra=Marker}}};batch[i*2+1]=new INPUT{Type=1,Value=new UNION{Key=new KEYBDINPUT{Scan=text[i],Flags=6,Extra=Marker}}};}
  uint sent=SendInput((uint)batch.Length,batch,Marshal.SizeOf(typeof(INPUT)));
  if(sent!=(uint)batch.Length){if((sent&1)!=0&&sent<(uint)batch.Length)try{Send(batch[(int)sent]);}catch{}throw new InputFailure("REMOTE_INPUT_UNAVAILABLE");}
 }
 public void Wheel(int dx,int dy){if(dy!=0)Send(Mouse(0x800,unchecked((uint)-dy),0,0));if(dx!=0)Send(Mouse(0x1000,unchecked((uint)dx),0,0));}
 public void ReleaseAll(){foreach(string code in new List<string>(remoteKeys))try{Key(code,false,false);}catch{}foreach(int b in new List<int>(remoteButtons))try{Button(b,false);}catch{}}
 // Low-level hooks observe physical holds only; every callback continues the chain.
 // They never capture/log typed text, and ignore all injected input including ours.
 delegate IntPtr Hook(int code,IntPtr message,IntPtr data);Hook keyHook,mouseHook;IntPtr kh,mh;
 [StructLayout(LayoutKind.Sequential)]struct KHOOK{public uint Vk,Scan,Flags,Time;public UIntPtr Extra;}
 [StructLayout(LayoutKind.Sequential)]struct MHOOK{public POINT Point;public uint Data,Flags,Time;public UIntPtr Extra;}
 [StructLayout(LayoutKind.Sequential)]struct MSG{public IntPtr Hwnd;public uint Message;public UIntPtr W;public IntPtr L;public uint Time;public POINT Point;public uint Private;}
 [DllImport("user32.dll")]static extern IntPtr SetWindowsHookEx(int id,Hook callback,IntPtr module,uint thread);
 [DllImport("user32.dll")]static extern bool UnhookWindowsHookEx(IntPtr hook);
 [DllImport("user32.dll")]static extern IntPtr CallNextHookEx(IntPtr hook,int code,IntPtr msg,IntPtr data);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)]static extern IntPtr GetModuleHandle(string name);
 [DllImport("user32.dll")]static extern int GetMessage(out MSG msg,IntPtr hwnd,uint min,uint max);
 [DllImport("user32.dll")]static extern bool RegisterHotKey(IntPtr hwnd,int id,uint mods,uint vk);
 internal void StartHooks(Action stop){
  var initialized=new ManualResetEvent(false);bool installed=false;
  var thread=new Thread(delegate(){
   keyHook=delegate(int c,IntPtr message,IntPtr data){if(c>=0){var e=(KHOOK)Marshal.PtrToStructure(data,typeof(KHOOK));if((e.Flags&0x10)==0)lock(physicalLock){if(message.ToInt64()==0x100||message.ToInt64()==0x104)physical.Add((int)e.Vk);else physical.Remove((int)e.Vk);}}return CallNextHookEx(kh,c,message,data);};
   mouseHook=delegate(int c,IntPtr message,IntPtr data){if(c>=0){var e=(MHOOK)Marshal.PtrToStructure(data,typeof(MHOOK));if((e.Flags&1)==0){long m=message.ToInt64();int vk=m==0x201||m==0x202?1:m==0x204||m==0x205?2:m==0x207||m==0x208?4:0;if(vk!=0)lock(physicalLock){if(m==0x201||m==0x204||m==0x207)physical.Add(vk);else physical.Remove(vk);}}}return CallNextHookEx(mh,c,message,data);};
   kh=SetWindowsHookEx(13,keyHook,GetModuleHandle(null),0);mh=SetWindowsHookEx(14,mouseHook,GetModuleHandle(null),0);installed=kh!=IntPtr.Zero&&mh!=IntPtr.Zero&&RegisterHotKey(IntPtr.Zero,1,0x4000|1|2|4,EmergencyVirtualKey);initialized.Set();
   if(!installed)return;try{MSG msg;while(GetMessage(out msg,IntPtr.Zero,0,0)>0)if(msg.Message==0x312)stop();}finally{UnhookWindowsHookEx(kh);UnhookWindowsHookEx(mh);}
  });thread.IsBackground=true;thread.Start();if(!initialized.WaitOne(2000)||!installed)throw new InputFailure("REMOTE_INPUT_UNAVAILABLE");
 }
}

// Output may block forever when a stalled parent stops reading. This one bounded
// writer never holds core.Sync; producers never wait for pipe capacity or the writer.
internal sealed class RemoteInputOutput {
 readonly BlockingCollection<string> queue;readonly Thread writer;volatile bool failed;
 internal RemoteInputOutput(Action<string> write,int capacity){
  queue=new BlockingCollection<string>(capacity);writer=new Thread(delegate(){try{foreach(string line in queue.GetConsumingEnumerable())write(line);}catch{failed=true;}});writer.IsBackground=true;writer.Start();
 }
 internal bool TryWrite(string line){try{return !failed&&queue.TryAdd(line);}catch(InvalidOperationException){return false;}}
 internal void CompleteAndJoin(int milliseconds){queue.CompleteAdding();writer.Join(milliseconds);}
}

internal static class RemoteInputProgram {
 static RemoteInputOutput output;static readonly JavaScriptSerializer Json=new JavaScriptSerializer{MaxJsonLength=16384,RecursionLimit=12};
 static void Output(RemoteInputCore core,object data){if(!output.TryWrite(Json.Serialize(data))&&core!=null)lock(core.Sync)core.Stop();}
 static string ReadBoundedLine(){var b=new StringBuilder();while(true){int c=Console.Read();if(c<0)return b.Length==0?null:b.ToString();if(c==10)return b.ToString();if(c==13)continue;if(b.Length>=16384)throw new InputFailure("REMOTE_INPUT_PROTOCOL");b.Append((char)c);}}
 static void Main(){
  Console.InputEncoding=new UTF8Encoding(false,true);Console.OutputEncoding=new UTF8Encoding(false);output=new RemoteInputOutput(Console.WriteLine,64);RemoteInputCore core=null;System.Threading.Timer timer=null;
  try{
   long anchor=(DateTime.UtcNow.Ticks-621355968000000000L)/10000;var watch=Stopwatch.StartNew();var platform=new WindowsRemoteInputPlatform();core=new RemoteInputCore(platform,delegate{return anchor+watch.ElapsedMilliseconds;});
   platform.StartHooks(delegate{lock(core.Sync){core.Stop();Output(core,new Dictionary<string,object>{{"event","state"},{"state",core.State()}});}});
   timer=new System.Threading.Timer(delegate{lock(core.Sync){try{if(core.Tick())Output(core,new Dictionary<string,object>{{"event","state"},{"state",core.State()}});}catch{core.Stop();}}},null,50,50);
   long lastId=0;string line;while((line=ReadBoundedLine())!=null){long id=0;bool stop=false;lock(core.Sync){try{
    var c=InputJson.Obj(Json.DeserializeObject(line));id=InputJson.Num(c,"id",1,9007199254740991L);if(id<=lastId)throw new InputFailure("REMOTE_INPUT_REPLAY");lastId=id;string op=InputJson.Str(c,"op");
    if(op=="start")core.Start(c);else if(op=="renew")core.Renew(c);else if(op=="input")core.Input(c);else if(op=="releaseAll"){InputJson.Count(c,2);core.ReleaseAll();}else if(op=="retireAuthority"){InputJson.Count(c,2);core.RetireAuthority();}else if(op=="stop"){InputJson.Count(c,2);core.Stop();stop=true;}else throw new InputFailure("REMOTE_INPUT_PROTOCOL");
    Output(core,new Dictionary<string,object>{{"id",id},{"ok",true},{"state",core.State()}});
   }catch(InputFailure e){Output(core,new Dictionary<string,object>{{"id",id},{"ok",false},{"error",e.Code},{"state",core.State()}});}catch{core.Stop();Output(core,new Dictionary<string,object>{{"id",id},{"ok",false},{"error","REMOTE_INPUT_UNAVAILABLE"}});stop=true;}}
   if(stop)break;}
  }catch{Output(core,new Dictionary<string,object>{{"id",0},{"ok",false},{"error","REMOTE_INPUT_UNAVAILABLE"}});}
  finally{if(timer!=null)timer.Dispose();if(core!=null)lock(core.Sync)core.Stop();output.CompleteAndJoin(500);}
 }
}
