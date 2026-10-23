// TEST ASSET ONLY. Standalone WinForms marker/event fixture, never packaged.
// No input injection, global hooks, screen capture or access to another window.
// Build: csc /target:exe /platform:x64 /warnaserror+
// /reference:System.Windows.Forms.dll /reference:System.Drawing.dll
// /reference:System.Web.Extensions.dll /out:RemotePcQaWindow.exe RemotePcQaWindow.cs
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

internal sealed class QaOutput {
 readonly BlockingCollection<string> queue=new BlockingCollection<string>(32);
 readonly Thread writer;
 volatile bool failed;
 internal QaOutput(){
  writer=new Thread(delegate(){try{foreach(string line in queue.GetConsumingEnumerable())Console.WriteLine(line);}catch{failed=true;}});
  writer.IsBackground=true;writer.Start();
 }
 internal bool TryWrite(string line){try{return !failed&&line.Length<=16384&&queue.TryAdd(line);}catch(InvalidOperationException){return false;}}
 internal void Finish(){queue.CompleteAdding();writer.Join(500);}
}

internal static class QaOwnWindow {
 [StructLayout(LayoutKind.Sequential)]internal struct RECT {internal int Left,Top,Right,Bottom;}
 [StructLayout(LayoutKind.Sequential)]internal struct POINT {internal int X,Y;}
 [DllImport("user32.dll")]internal static extern bool SetProcessDpiAwarenessContext(IntPtr context);
 [DllImport("user32.dll")]static extern bool GetWindowRect(IntPtr hwnd,out RECT rect);
 [DllImport("user32.dll")]static extern bool GetClientRect(IntPtr hwnd,out RECT rect);
 [DllImport("user32.dll")]static extern bool ClientToScreen(IntPtr hwnd,ref POINT point);
 [DllImport("user32.dll")]internal static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")]static extern IntPtr GetMessageExtraInfo();
 [DllImport("user32.dll")]static extern uint GetDpiForWindow(IntPtr hwnd);
 [DllImport("user32.dll")]static extern IntPtr GetThreadDpiAwarenessContext();
 [DllImport("user32.dll")]static extern bool AreDpiAwarenessContextsEqual(IntPtr a,IntPtr b);
 [DllImport("dwmapi.dll")]static extern int DwmGetWindowAttribute(IntPtr hwnd,int attribute,out RECT rect,int size);
 static object Rect(RECT r){return new Dictionary<string,object>{{"x",r.Left},{"y",r.Top},{"width",r.Right-r.Left},{"height",r.Bottom-r.Top}};}
 internal static int Origin(){long marker=GetMessageExtraInfo().ToInt64();return marker==0x434C5250?1:marker==0x51414C43?2:0;}
 internal static POINT ScreenPoint(Control own,int x,int y){
  var point=new POINT{X=x,Y=y};if(!ClientToScreen(own.Handle,ref point))throw new InvalidOperationException("QA_GEOMETRY");return point;
 }
 internal static object Geometry(Form own){
  RECT frame,client,dwm;bool hasFrame=GetWindowRect(own.Handle,out frame),hasClient=GetClientRect(own.Handle,out client);
  var origin=new POINT();bool hasOrigin=ClientToScreen(own.Handle,ref origin);
  bool hasDwm=DwmGetWindowAttribute(own.Handle,9,out dwm,Marshal.SizeOf(typeof(RECT)))==0;
  return new Dictionary<string,object>{
   {"window",hasFrame?Rect(frame):null},{"client",hasClient&&hasOrigin?new Dictionary<string,object>{{"x",origin.X},{"y",origin.Y},{"width",client.Right-client.Left},{"height",client.Bottom-client.Top}}:null},
   {"dwm",hasDwm?Rect(dwm):null},{"dpi",GetDpiForWindow(own.Handle)},
   {"perMonitorV2",AreDpiAwarenessContextsEqual(GetThreadDpiAwarenessContext(),new IntPtr(-4))},
   {"foreground",GetForegroundWindow()==own.Handle},{"minimized",own.WindowState==FormWindowState.Minimized},
   {"monitor",Screen.FromHandle(own.Handle).DeviceName}
  };
 }
}

internal sealed class QaCanvas : Control {
 internal long MouseDownCount,MouseUpCount,MoveCount,WheelCount,KeyDownCount,KeyUpCount,TextCount,DragCount,CaptureLostCount;
 internal long WheelTotal;
 internal long RemoteOriginCount,QaLocalOriginCount,OtherOriginCount,LastEventMs,LastKeyUpMs,LastMouseUpMs;
 readonly Stopwatch clock=Stopwatch.StartNew();
 internal int LastX,LastY;
 internal bool CtrlHeld,ShiftHeld,AltHeld,QHeld,AHeld;
 internal bool TextIsQa,Dirty=true;
 string qaText="";
 bool entry,dragging;
 Point dragOffset;
 Rectangle drag=new Rectangle(100,160,180,90);
 readonly Rectangle textTarget=new Rectangle(100,300,300,48);
 internal QaCanvas(){
  SetStyle(ControlStyles.AllPaintingInWmPaint|ControlStyles.UserPaint|ControlStyles.OptimizedDoubleBuffer|ControlStyles.Selectable,true);
  BackColor=Color.FromArgb(16,24,32);ForeColor=Color.White;TabStop=true;
 }
 internal object[] Markers(){
  if(ClientSize.Width<400||ClientSize.Height<400)return new object[0];
  int width=ClientSize.Width,height=ClientSize.Height;
  return new object[]{Marker("topLeft",16,16,240,32,32),Marker("topRight",width-40,16,32,224,64),Marker("bottomLeft",16,height-40,32,96,240),Marker("bottomRight",width-40,height-40,248,224,32),Marker("center",width/2-12,height/2-12,224,32,224)};
 }
 object Marker(string id,int x,int y,int r,int g,int b){
  var point=QaOwnWindow.ScreenPoint(this,x+12,y+12);
  return new Dictionary<string,object>{{"id",id},{"clientX",x+12},{"clientY",y+12},{"screenX",point.X},{"screenY",point.Y},{"size",24},{"rgb",new int[]{r,g,b}}};
 }
 internal void Reset(){
  MouseDownCount=MouseUpCount=MoveCount=WheelCount=KeyDownCount=KeyUpCount=TextCount=DragCount=CaptureLostCount=WheelTotal=0;
  CtrlHeld=ShiftHeld=AltHeld=QHeld=AHeld=TextIsQa=entry=dragging=false;qaText="";
  RemoteOriginCount=QaLocalOriginCount=OtherOriginCount=LastEventMs=LastKeyUpMs=LastMouseUpMs=0;
  drag=new Rectangle(100,160,180,90);Capture=false;Dirty=true;Invalidate();
 }
 internal object Receipts(){
  var p=QaOwnWindow.ScreenPoint(this,LastX,LastY);
  return new Dictionary<string,object>{
   {"mouseDown",MouseDownCount},{"mouseUp",MouseUpCount},{"mouseMove",MoveCount},{"wheel",WheelCount},{"wheelTotal",WheelTotal},
   {"keyDown",KeyDownCount},{"keyUp",KeyUpCount},{"textCommits",TextCount},{"qaMatches",TextIsQa},
   {"clockMs",clock.ElapsedMilliseconds},{"lastEventMs",LastEventMs},{"lastKeyUpMs",LastKeyUpMs},{"lastMouseUpMs",LastMouseUpMs},
   {"originHintCounts",new Dictionary<string,object>{{"remoteMarker",RemoteOriginCount},{"qaLocalMarker",QaLocalOriginCount},{"other",OtherOriginCount}}},
   {"ctrlHeld",CtrlHeld},{"shiftHeld",ShiftHeld},{"altHeld",AltHeld},{"qHeld",QHeld},{"aHeld",AHeld},
   {"dragMoves",DragCount},{"dragging",dragging},{"captureLost",CaptureLostCount},
   {"lastPoint",new Dictionary<string,object>{{"clientX",LastX},{"clientY",LastY},{"screenX",p.X},{"screenY",p.Y}}},
   {"dragTarget",new Dictionary<string,object>{{"x",drag.X},{"y",drag.Y},{"width",drag.Width},{"height",drag.Height}}},
   {"textTarget",new Dictionary<string,object>{{"x",textTarget.X},{"y",textTarget.Y},{"width",textTarget.Width},{"height",textTarget.Height},{"active",entry}}}
  };
 }
 protected override bool IsInputKey(Keys keyData){return true;}
 protected override void OnPaint(PaintEventArgs e){
  base.OnPaint(e);var g=e.Graphics;
  using(var border=new Pen(Color.FromArgb(248,96,16),2))g.DrawRectangle(border,1,1,Math.Max(0,ClientSize.Width-3),Math.Max(0,ClientSize.Height-3));
  using(var brush=new SolidBrush(Color.FromArgb(48,96,144)))g.FillRectangle(brush,drag);
  using(var brush=new SolidBrush(entry?Color.FromArgb(32,112,72):Color.FromArgb(56,64,80)))g.FillRectangle(brush,textTarget);
  g.DrawString("OWNED QA WINDOW - markers must match real captured pixels",Font,Brushes.White,64,60);
  g.DrawString("Drag this internal rectangle",Font,Brushes.White,drag.X+12,drag.Y+28);
  g.DrawString("Click then type only QA. Match: "+(TextIsQa?"YES":"NO"),Font,Brushes.White,textTarget.X+12,textTarget.Y+14);
  g.DrawString("Wheel events: "+WheelCount+" / delta: "+WheelTotal,Font,Brushes.White,480,180);
  g.DrawString("Remote/local input receipts are aggregate only.",Font,Brushes.White,64,420);
  if(ClientSize.Width>=400&&ClientSize.Height>=400){
   int w=ClientSize.Width,h=ClientSize.Height;FillMarker(g,16,16,Color.FromArgb(240,32,32));FillMarker(g,w-40,16,Color.FromArgb(32,224,64));FillMarker(g,16,h-40,Color.FromArgb(32,96,240));FillMarker(g,w-40,h-40,Color.FromArgb(248,224,32));FillMarker(g,w/2-12,h/2-12,Color.FromArgb(224,32,224));
  }
 }
 static void FillMarker(Graphics g,int x,int y,Color color){using(var brush=new SolidBrush(color))g.FillRectangle(brush,x,y,24,24);}
 void EventObserved(){LastEventMs=clock.ElapsedMilliseconds;int origin=QaOwnWindow.Origin();if(origin==1)RemoteOriginCount++;else if(origin==2)QaLocalOriginCount++;else OtherOriginCount++;Dirty=true;}
 void At(MouseEventArgs e){LastX=e.X;LastY=e.Y;EventObserved();}
 protected override void OnMouseDown(MouseEventArgs e){
  base.OnMouseDown(e);At(e);MouseDownCount++;Focus();entry=textTarget.Contains(e.Location);
  if(e.Button==MouseButtons.Left&&drag.Contains(e.Location)){dragging=true;dragOffset=new Point(e.X-drag.X,e.Y-drag.Y);Capture=true;}Invalidate();
 }
 protected override void OnMouseUp(MouseEventArgs e){base.OnMouseUp(e);At(e);LastMouseUpMs=LastEventMs;MouseUpCount++;dragging=false;Capture=false;Invalidate();}
 protected override void OnMouseMove(MouseEventArgs e){
  base.OnMouseMove(e);At(e);MoveCount++;
  if(dragging){drag.X=Math.Max(48,Math.Min(ClientSize.Width-drag.Width-48,e.X-dragOffset.X));drag.Y=Math.Max(80,Math.Min(ClientSize.Height-drag.Height-80,e.Y-dragOffset.Y));DragCount++;Invalidate();}
 }
 protected override void OnMouseCaptureChanged(EventArgs e){base.OnMouseCaptureChanged(e);if(!Capture&&dragging){dragging=false;CaptureLostCount++;Dirty=true;Invalidate();}}
 protected override void OnMouseWheel(MouseEventArgs e){base.OnMouseWheel(e);At(e);WheelCount++;WheelTotal+=e.Delta;Invalidate();}
 void Held(Keys key,bool down){
  if(key==Keys.ControlKey||key==Keys.LControlKey||key==Keys.RControlKey)CtrlHeld=down;
  if(key==Keys.ShiftKey||key==Keys.LShiftKey||key==Keys.RShiftKey)ShiftHeld=down;
  if(key==Keys.Menu||key==Keys.LMenu||key==Keys.RMenu)AltHeld=down;
  if(key==Keys.Q)QHeld=down;if(key==Keys.A)AHeld=down;EventObserved();
 }
 protected override void OnKeyDown(KeyEventArgs e){base.OnKeyDown(e);KeyDownCount++;Held(e.KeyCode,true);e.Handled=true;}
 protected override void OnKeyUp(KeyEventArgs e){base.OnKeyUp(e);KeyUpCount++;Held(e.KeyCode,false);LastKeyUpMs=LastEventMs;e.Handled=true;}
 protected override void OnKeyPress(KeyPressEventArgs e){
  base.OnKeyPress(e);TextCount++;EventObserved();
  // Retain only the two literal QA characters. Never retain/log arbitrary text.
  if(entry&&(e.KeyChar=='Q'||e.KeyChar=='A')){qaText=(qaText+e.KeyChar);if(qaText.Length>2)qaText=qaText.Substring(qaText.Length-2);TextIsQa=qaText=="QA";}
  e.Handled=true;Dirty=true;Invalidate();
 }
 protected override void OnResize(EventArgs e){base.OnResize(e);Dirty=true;Invalidate();}
}

internal sealed class RemotePcQaForm : Form {
 readonly string nonce;
 readonly QaOutput output;
 readonly QaCanvas canvas=new QaCanvas();
 readonly JavaScriptSerializer json=new JavaScriptSerializer{MaxJsonLength=16384,RecursionLimit=10};
 readonly System.Windows.Forms.Timer timer=new System.Windows.Forms.Timer{Interval=100};
 readonly long processStart;
 readonly int processId;
 Rectangle normalBounds;
 long serial,nonClientDown,nonClientUp,moves,resizes;
 bool closing;
 internal RemotePcQaForm(string nonce,QaOutput output){
  this.nonce=nonce;this.output=output;using(var process=Process.GetCurrentProcess()){processStart=process.StartTime.ToUniversalTime().Ticks;processId=process.Id;}
  Text="CastLink Remote PC QA ["+nonce+"]";AutoScaleMode=AutoScaleMode.None;
  StartPosition=FormStartPosition.Manual;Location=new Point(100,100);ClientSize=new Size(960,640);MinimumSize=new Size(500,500);
  canvas.Dock=DockStyle.Fill;Controls.Add(canvas);
  Shown+=delegate{normalBounds=Bounds;canvas.Focus();Emit("ready",0);StartCommands();timer.Start();};
  timer.Tick+=delegate{if(canvas.Dirty){canvas.Dirty=false;Emit("state",0);}};
  Move+=delegate{moves++;canvas.Dirty=true;};Resize+=delegate{resizes++;canvas.Dirty=true;};Activated+=delegate{canvas.Dirty=true;};Deactivate+=delegate{canvas.Dirty=true;};
  FormClosed+=delegate{closing=true;timer.Stop();timer.Dispose();};
 }
 protected override void WndProc(ref Message message){
  if(message.Msg==0x00A1){nonClientDown++;canvas.Dirty=true;}if(message.Msg==0x00A2){nonClientUp++;canvas.Dirty=true;}
  base.WndProc(ref message);
 }
 object[] Monitors(){
  var list=new List<object>();foreach(Screen s in Screen.AllScreens)list.Add(new Dictionary<string,object>{{"device",s.DeviceName},{"primary",s.Primary},{"x",s.Bounds.X},{"y",s.Bounds.Y},{"width",s.Bounds.Width},{"height",s.Bounds.Height}});return list.ToArray();
 }
 void Emit(string kind,long id){
  if(closing||!IsHandleCreated)return;
  try{
   var payload=new Dictionary<string,object>{{"v",1},{"kind",kind},{"id",id},{"serial",++serial},{"nonce",nonce},{"title",Text},
    {"pid",processId},{"processStartTicks",processStart.ToString(CultureInfo.InvariantCulture)},{"hwnd",Handle.ToInt64().ToString(CultureInfo.InvariantCulture)},
    {"geometry",QaOwnWindow.Geometry(this)},{"monitors",Monitors()},{"markers",canvas.Markers()},{"receipts",canvas.Receipts()},
    {"windowMoves",moves},{"windowResizes",resizes},{"nonClientDown",nonClientDown},{"nonClientUp",nonClientUp},{"borderless",FormBorderStyle==FormBorderStyle.None}};
   if(!output.TryWrite(json.Serialize(payload)))Close();
  }catch{if(!closing)Close();}
 }
 static string ReadLineBounded(){
  var line=new StringBuilder();while(true){int next=Console.Read();if(next<0)return null;if(next==10)return line.ToString();if(next==13)continue;if(line.Length>=1024)throw new InvalidOperationException("QA_COMMAND");line.Append((char)next);}
 }
 void StartCommands(){
  var reader=new Thread(delegate(){
   var parser=new JavaScriptSerializer{MaxJsonLength=1024,RecursionLimit=5};
   try{string line;while((line=ReadLineBounded())!=null){var command=parser.DeserializeObject(line) as Dictionary<string,object>;if(command==null||command.Count>3)throw new InvalidOperationException("QA_COMMAND");
    var captured=command;Invoke((Action)delegate{Command(captured);});}
   }catch{}finally{try{BeginInvoke((Action)delegate{if(!closing)Close();});}catch{}}
  });reader.IsBackground=true;reader.Start();
 }
 void Command(Dictionary<string,object> command){
  if(closing)return;try{
   object opValue,idValue;long id;if(!command.TryGetValue("op",out opValue)||!(opValue is string)||!command.TryGetValue("id",out idValue)||!Int64.TryParse(Convert.ToString(idValue,CultureInfo.InvariantCulture),out id)||id<1)throw new InvalidOperationException("QA_COMMAND");
   string op=(string)opValue;
   if(op=="snapshot"&&command.Count==2)Emit("snapshot",id);
   else if(op=="reset"&&command.Count==2){canvas.Reset();Emit("reset",id);}
   else if(op=="focus"&&command.Count==2){Activate();canvas.Focus();Emit("focus",id);}
   else if(op=="normal"&&command.Count==2){WindowState=FormWindowState.Normal;FormBorderStyle=FormBorderStyle.Sizable;Bounds=normalBounds;Emit("normal",id);}
   else if(op=="monitor"&&command.Count==3){
    object device;Screen selected=null;if(!command.TryGetValue("device",out device)||!(device is string))throw new InvalidOperationException("QA_COMMAND");
    foreach(Screen screen in Screen.AllScreens)if(screen.DeviceName==(string)device)selected=screen;
    if(selected==null)throw new InvalidOperationException("QA_COMMAND");
    if(FormBorderStyle!=FormBorderStyle.None)normalBounds=Bounds;WindowState=FormWindowState.Normal;FormBorderStyle=FormBorderStyle.None;Bounds=selected.Bounds;Emit("monitor",id);
   }
   else if(op=="exit"&&command.Count==2){Emit("closing",id);Close();}
   else throw new InvalidOperationException("QA_COMMAND");
  }catch{output.TryWrite("{\"v\":1,\"kind\":\"error\",\"error\":\"QA_COMMAND\"}");Close();}
 }
}

internal static class RemotePcQaWindowProgram {
 [STAThread]static void Main(string[] args){
  Console.InputEncoding=new UTF8Encoding(false,true);Console.OutputEncoding=new UTF8Encoding(false);var output=new QaOutput();
  try{
   string nonce=Guid.NewGuid().ToString("N");
   if(args.Length!=0){Guid parsed;if(args.Length!=2||args[0]!="--nonce"||!Guid.TryParseExact(args[1],"N",out parsed))throw new InvalidOperationException("QA_ARGS");nonce=parsed.ToString("N");}
   // Process-local DPI context only; no display settings or global DPI changes.
   if(!QaOwnWindow.SetProcessDpiAwarenessContext(new IntPtr(-4)))throw new InvalidOperationException("QA_DPI");
   Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
   using(var form=new RemotePcQaForm(nonce,output))Application.Run(form);
  }catch{output.TryWrite("{\"v\":1,\"kind\":\"error\",\"error\":\"QA_UNAVAILABLE\"}");Environment.ExitCode=2;}
  finally{output.Finish();}
 }
}
