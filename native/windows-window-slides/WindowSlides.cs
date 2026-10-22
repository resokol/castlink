using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Web.Script.Serialization;

internal sealed class WindowSlidesFailure : Exception {
 public readonly string Code;
 public WindowSlidesFailure(string code) : base(code) {Code=code;}
}
internal sealed class WindowSnapshot {
 public readonly long Handle; public readonly string Binding,Name;
 public WindowSnapshot(long handle,string binding,string name){Handle=handle;Binding=binding;Name=name;}
 public object Export(){return new Dictionary<string,object>{{"windowHandle",Handle.ToString(CultureInfo.InvariantCulture)},{"binding",Binding},{"name",Name}};}
}
internal interface IWindowSlidesPlatform {
 WindowSnapshot Read(long hwnd); long ForegroundHandle(); bool SafeInputDesktop(); bool KeysClear();
 void Activate(long hwnd); uint Tap(long hwnd,string binding,bool next,long expiresAt); void Release(bool next);
}
internal static class WindowSlidesCore {
 public static string Label(string raw){
  var b=new StringBuilder();foreach(char c in raw??""){b.Append(c<32||c==127||c=='/'||c=='\\'||c==':'?' ':c);if(b.Length>=180)break;}
  string name=b.ToString().Trim();return name.Length==0?"PDF":name;
 }
 public static string Bind(long hwnd,int pid,long start,string rawTitle,string windowClass){
  string raw=new JavaScriptSerializer().Serialize(new object[]{hwnd.ToString(CultureInfo.InvariantCulture),pid,start,rawTitle,windowClass});
  using(var sha=SHA256.Create()){var b=sha.ComputeHash(Encoding.UTF8.GetBytes(raw));return BitConverter.ToString(b).Replace("-","").ToLowerInvariant();}
 }
 static WindowSnapshot Require(IWindowSlidesPlatform p,long hwnd,string binding){
  var s=p.Read(hwnd);if(s==null||s.Handle!=hwnd||s.Binding!=binding)throw new WindowSlidesFailure("WINDOW_SLIDES_STALE");return s;
 }
 public static WindowSnapshot Status(IWindowSlidesPlatform p,long hwnd,string binding){return Require(p,hwnd,binding);}
 public static WindowSnapshot Activate(IWindowSlidesPlatform p,long hwnd,string binding){
  Require(p,hwnd,binding);if(!p.SafeInputDesktop())throw new WindowSlidesFailure("WINDOW_SLIDES_UNAVAILABLE");
  p.Activate(hwnd);var s=Require(p,hwnd,binding);
  if(p.ForegroundHandle()!=hwnd)throw new WindowSlidesFailure("WINDOW_SLIDES_FOREGROUND");return s;
 }
 public static WindowSnapshot Step(IWindowSlidesPlatform p,long hwnd,string binding,bool next,long expiresAt,Func<long> now){
  if(expiresAt<=now()||expiresAt>now()+3000)throw new WindowSlidesFailure("WINDOW_SLIDES_COMMAND");
  Require(p,hwnd,binding);
  if(p.ForegroundHandle()!=hwnd)throw new WindowSlidesFailure("WINDOW_SLIDES_FOREGROUND");
  if(!p.SafeInputDesktop()||!p.KeysClear())throw new WindowSlidesFailure("WINDOW_SLIDES_UNAVAILABLE");
  Require(p,hwnd,binding);
  if(p.ForegroundHandle()!=hwnd)throw new WindowSlidesFailure("WINDOW_SLIDES_FOREGROUND");
  if(expiresAt<=now())throw new WindowSlidesFailure("WINDOW_SLIDES_COMMAND");
  uint count=p.Tap(hwnd,binding,next,expiresAt);
  if(count!=2){if(count==1)p.Release(next);throw new WindowSlidesFailure(count==0?"WINDOW_SLIDES_UNAVAILABLE":"WINDOW_SLIDES_AMBIGUOUS");}
  var status=Require(p,hwnd,binding);
  if(p.ForegroundHandle()!=hwnd)throw new WindowSlidesFailure("WINDOW_SLIDES_AMBIGUOUS");
  return status;
 }
}
internal sealed class WindowsSlidesPlatform : IWindowSlidesPlatform {
 const int VK_PRIOR=0x21,VK_NEXT=0x22;

 [DllImport("user32.dll")]static extern bool IsWindow(IntPtr hwnd);
 [DllImport("user32.dll")]static extern bool IsWindowVisible(IntPtr hwnd);
 [DllImport("user32.dll")]static extern bool IsIconic(IntPtr hwnd);
 [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr hwnd,out uint pid);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern int GetWindowText(IntPtr hwnd,StringBuilder text,int capacity);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern int GetClassName(IntPtr hwnd,StringBuilder text,int capacity);
 [DllImport("user32.dll")]static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")]static extern bool SetForegroundWindow(IntPtr hwnd);
 [DllImport("user32.dll")]static extern bool ShowWindow(IntPtr hwnd,int command);
 [DllImport("user32.dll")]static extern short GetAsyncKeyState(int key);
 [DllImport("user32.dll",SetLastError=true)]static extern IntPtr OpenInputDesktop(uint flags,bool inherit,uint access);
 [DllImport("user32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool GetUserObjectInformation(IntPtr h,int index,StringBuilder info,uint length,out uint needed);
 [DllImport("user32.dll")]static extern bool CloseDesktop(IntPtr desktop);
 delegate bool EnumWindowProc(IntPtr hwnd,IntPtr unused);
 [DllImport("user32.dll")]static extern bool EnumWindows(EnumWindowProc callback,IntPtr unused);
 [StructLayout(LayoutKind.Sequential)]struct RECT {public int Left,Top,Right,Bottom;}
 [StructLayout(LayoutKind.Sequential)]struct GUIINFO {public uint Size,Flags;public IntPtr Active,Focus,Capture,MenuOwner,MoveSize,Caret;public RECT CaretRect;}
 [DllImport("user32.dll")]static extern bool GetGUIThreadInfo(uint thread,ref GUIINFO info);
 [DllImport("user32.dll")]static extern bool IsChild(IntPtr parent,IntPtr child);
 [DllImport("user32.dll")]static extern IntPtr GetAncestor(IntPtr hwnd,uint flag);
 [DllImport("user32.dll",SetLastError=true)]static extern bool PostMessage(IntPtr hwnd,uint message,IntPtr key,IntPtr flags);
 [DllImport("user32.dll")]static extern uint MapVirtualKey(uint code,uint type);
 IntPtr lastRecipient;long lastRoot;string lastBinding;
 public WindowSnapshot Read(long value){
  try{
   var hwnd=new IntPtr(value);if(!IsWindow(hwnd)||!IsWindowVisible(hwnd))return null;
   uint pid;GetWindowThreadProcessId(hwnd,out pid);if(pid==0||pid==(uint)Process.GetCurrentProcess().Id)return null;
   using(var process=Process.GetProcessById((int)pid)){
    var title=new StringBuilder(4096);GetWindowText(hwnd,title,title.Capacity);
    string raw=title.ToString(),app=process.ProcessName;
    bool browser=app.Equals("msedge",StringComparison.OrdinalIgnoreCase)||app.Equals("chrome",StringComparison.OrdinalIgnoreCase);
    if(!browser||raw.IndexOf(".pdf",StringComparison.OrdinalIgnoreCase)<0)return null;
    var windowClass=new StringBuilder(256);GetClassName(hwnd,windowClass,windowClass.Capacity);
    long start=process.StartTime.ToUniversalTime().Ticks;
    return new WindowSnapshot(value,WindowSlidesCore.Bind(value,(int)pid,start,raw,windowClass.ToString()),WindowSlidesCore.Label(raw.Length==0?app+" (PDF)":raw));
   }
  }catch{return null;}
 }
 public object[] List(){
  var result=new List<WindowSnapshot>();EnumWindows(delegate(IntPtr hwnd,IntPtr unused){var s=Read(hwnd.ToInt64());if(s!=null&&result.Count<64)result.Add(s);return true;},IntPtr.Zero);
  result.Sort(delegate(WindowSnapshot a,WindowSnapshot b){return StringComparer.Ordinal.Compare(a.Name,b.Name);});
  var output=new List<object>();foreach(var s in result)output.Add(s.Export());return output.ToArray();
 }
 public long ForegroundHandle(){return GetForegroundWindow().ToInt64();}
 public bool SafeInputDesktop(){
  // No elevation, UIAccess or secure-desktop workaround.
  if(new WindowsPrincipal(WindowsIdentity.GetCurrent()).IsInRole(WindowsBuiltInRole.Administrator))return false;
  IntPtr desktop=OpenInputDesktop(0,false,1);if(desktop==IntPtr.Zero)return false;
  try{var name=new StringBuilder(256);uint needed;return GetUserObjectInformation(desktop,2,name,512,out needed)&&name.ToString().Equals("Default",StringComparison.OrdinalIgnoreCase);}
  finally{CloseDesktop(desktop);}
 }
 public bool KeysClear(){
  // Do not alter a physically held navigation key or turn this into Ctrl/Alt/Shift+PageDown.
  foreach(int key in new int[]{0x10,0x11,0x12,0x5B,0x5C,VK_PRIOR,VK_NEXT})if(GetAsyncKeyState(key)<0)return false;
  return true;
 }
 public void Activate(long hwnd){var value=new IntPtr(hwnd);if(IsIconic(value))ShowWindow(value,9);SetForegroundWindow(value);}
 IntPtr Recipient(long hwnd,string expected){
  var root=new IntPtr(hwnd);var snapshot=Read(hwnd);
  if(snapshot==null||snapshot.Binding!=expected)throw new WindowSlidesFailure("WINDOW_SLIDES_STALE");
  uint ownerPid;uint thread=GetWindowThreadProcessId(root,out ownerPid);
  var info=new GUIINFO{Size=(uint)Marshal.SizeOf(typeof(GUIINFO))};
  if(!GetGUIThreadInfo(thread,ref info)||info.Focus==IntPtr.Zero||!IsWindow(info.Focus))throw new WindowSlidesFailure("WINDOW_SLIDES_FOREGROUND");
  uint childPid;GetWindowThreadProcessId(info.Focus,out childPid);
  var cls=new StringBuilder(256);GetClassName(info.Focus,cls,cls.Capacity);
  if(childPid!=ownerPid||!IsChild(root,info.Focus)||GetAncestor(info.Focus,2)!=root||cls.ToString()!="Chrome_RenderWidgetHostHWND")throw new WindowSlidesFailure("WINDOW_SLIDES_FOREGROUND");
  return info.Focus;
 }
 static IntPtr Flags(bool next,bool up){
  uint code=(next?VK_NEXT:VK_PRIOR)==VK_NEXT?0x22U:0x21U;
  uint bits=1U|(MapVirtualKey(code,0)<<16)|0x01000000U|(up?0xC0000000U:0U);
  return new IntPtr(unchecked((int)bits));
 }
 public uint Tap(long hwnd,string expected,bool next,long expiresAt){
  // Target-addressed messages never inject into whichever other app becomes foreground.
  IntPtr child=Recipient(hwnd,expected),root=new IntPtr(hwnd);uint ownerPid,childPid;
  GetWindowThreadProcessId(root,out ownerPid);GetWindowThreadProcessId(child,out childPid);
  if(!IsWindow(child)||!IsChild(root,child)||GetAncestor(child,2)!=root||ownerPid!=childPid)throw new WindowSlidesFailure("WINDOW_SLIDES_STALE");
  if(ForegroundHandle()!=hwnd)throw new WindowSlidesFailure("WINDOW_SLIDES_FOREGROUND");
  if(!SafeInputDesktop()||!KeysClear())throw new WindowSlidesFailure("WINDOW_SLIDES_UNAVAILABLE");
  var final=Read(hwnd);if(final==null||final.Binding!=expected)throw new WindowSlidesFailure("WINDOW_SLIDES_STALE");
  if(expiresAt<=(DateTime.UtcNow.Ticks-621355968000000000L)/10000)throw new WindowSlidesFailure("WINDOW_SLIDES_COMMAND");
  lastRecipient=child;lastRoot=hwnd;lastBinding=expected;IntPtr key=new IntPtr(next?VK_NEXT:VK_PRIOR);
  if(!PostMessage(child,0x0100,key,Flags(next,false)))return 0;
  return PostMessage(child,0x0101,key,Flags(next,true))?2U:1U;
 }
 public void Release(bool next){
  var s=Read(lastRoot);uint rootPid,childPid;GetWindowThreadProcessId(new IntPtr(lastRoot),out rootPid);GetWindowThreadProcessId(lastRecipient,out childPid);
  if(s!=null&&s.Binding==lastBinding&&lastRecipient!=IntPtr.Zero&&IsWindow(lastRecipient)&&IsChild(new IntPtr(lastRoot),lastRecipient)&&GetAncestor(lastRecipient,2)==new IntPtr(lastRoot)&&rootPid==childPid)PostMessage(lastRecipient,0x0101,new IntPtr(next?VK_NEXT:VK_PRIOR),Flags(next,true));
 }

}
internal static class WindowSlidesProgram {
 static long Now(){return(DateTime.UtcNow.Ticks-621355968000000000L)/10000;}
 static void Main(string[] args){
  Console.OutputEncoding=new UTF8Encoding(false);var json=new JavaScriptSerializer();
  try{
   var p=new WindowsSlidesPlatform();object result;
   if(args.Length==1&&args[0]=="list")result=p.List();
   else{
    long hwnd;if(args.Length<3||!Int64.TryParse(args[1],NumberStyles.None,CultureInfo.InvariantCulture,out hwnd)||hwnd<=0||!System.Text.RegularExpressions.Regex.IsMatch(args[2],"^[a-f0-9]{64}$"))throw new WindowSlidesFailure("WINDOW_SLIDES_UNAVAILABLE");
    if(args.Length==3&&args[0]=="status")result=WindowSlidesCore.Status(p,hwnd,args[2]).Export();
    else if(args.Length==3&&args[0]=="activate")result=WindowSlidesCore.Activate(p,hwnd,args[2]).Export();
    else if(args.Length==5&&args[0]=="step"){
     long expires;if((args[3]!="next"&&args[3]!="previous")||!Int64.TryParse(args[4],out expires))throw new WindowSlidesFailure("WINDOW_SLIDES_COMMAND");
     result=WindowSlidesCore.Step(p,hwnd,args[2],args[3]=="next",expires,Now).Export();
    }else throw new WindowSlidesFailure("WINDOW_SLIDES_UNAVAILABLE");
   }
   Console.WriteLine(json.Serialize(result));
  }catch(WindowSlidesFailure e){Console.WriteLine(json.Serialize(new Dictionary<string,object>{{"error",e.Code}}));Environment.ExitCode=2;}
  catch{Console.WriteLine("{\"error\":\"WINDOW_SLIDES_UNAVAILABLE\"}");Environment.ExitCode=2;}
 }
}
