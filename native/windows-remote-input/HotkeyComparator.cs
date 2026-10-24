// One independent Win32 comparator: no production hooks, source, lease, input
// injection or posted messages. Operator must verify OWN READY/PID/path/hash
// and the exact foreground fixture nonce/creation before one local chord.
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;

internal static class RemoteInputHotkeyComparator {
 // MSG's documented Win64 ABI: pointer8, UINT4+padding4, WPARAM8, LPARAM8,
 // DWORD4, POINT(int32,int32), lPrivate4; total48. Independent explicit layout.
 // https://learn.microsoft.com/windows/win32/api/winuser/ns-winuser-msg
 [StructLayout(LayoutKind.Explicit,Size=48)]struct NativeMessage {
  [FieldOffset(0)]public IntPtr Window;
  [FieldOffset(8)]public uint Message;
  [FieldOffset(16)]public UIntPtr WParam;
  [FieldOffset(24)]public IntPtr LParam;
  [FieldOffset(32)]public uint Time;
  [FieldOffset(36)]public int X;
  [FieldOffset(40)]public int Y;
  [FieldOffset(44)]public uint Private;
 }
 [DllImport("user32.dll",SetLastError=true)]static extern bool RegisterHotKey(IntPtr window,int id,uint modifiers,uint key);
 [DllImport("user32.dll",SetLastError=true)]static extern bool UnregisterHotKey(IntPtr window,int id);
 [DllImport("user32.dll",EntryPoint="GetMessageW",ExactSpelling=true,SetLastError=true)]static extern int GetMessage(out NativeMessage message,IntPtr window,uint first,uint last);
 [DllImport("user32.dll",EntryPoint="PeekMessageW",ExactSpelling=true,SetLastError=true)]static extern bool PeekMessage(out NativeMessage message,IntPtr window,uint first,uint last,uint remove);
 [DllImport("user32.dll",SetLastError=true)]static extern uint MsgWaitForMultipleObjectsEx(uint count,IntPtr handles,uint timeout,uint wakeMask,uint flags);
 [DllImport("kernel32.dll")]static extern uint GetCurrentThreadId();
 static void Require(bool value,string label){if(!value)throw new Exception(label);}
 static int Main(){
  bool registered=false;
  try{
   Require(IntPtr.Size==8&&Marshal.SizeOf(typeof(NativeMessage))==48,"unexpected Win64 MSG size");
   string[] fields={"Window","Message","WParam","LParam","Time","X","Y","Private"};int[] offsets={0,8,16,24,32,36,40,44};
   for(int i=0;i<fields.Length;i++)Require(Marshal.OffsetOf(typeof(NativeMessage),fields[i]).ToInt64()==offsets[i],"unexpected MSG offset "+fields[i]);
   registered=RegisterHotKey(IntPtr.Zero,1,0x4000|0x0001|0x0002|0x0004,0x77);
   Require(registered,"registration failed; no shortcut permitted; error="+Marshal.GetLastWin32Error());
   Console.WriteLine("HOTKEY_COMPARATOR_READY pid="+Process.GetCurrentProcess().Id+" tid="+GetCurrentThreadId()+" vk=119 Ctrl+Alt+Shift+F8 MSGsize=48");Console.Out.Flush();
   var elapsed=Stopwatch.StartNew();bool matched=false;
   while(elapsed.ElapsedMilliseconds<15000){
    NativeMessage message;
    // Peek without removal makes GetMessage finite even if a wake only
    // dispatched a sent message. This probe never posts timeout messages.
    if(!PeekMessage(out message,IntPtr.Zero,0,0,0)){
     uint result=MsgWaitForMultipleObjectsEx(0,IntPtr.Zero,(uint)Math.Max(1,15000-elapsed.ElapsedMilliseconds),0x04ff,0x0004);
     if(result==258)break;Require(result==0,"message wait failed; error="+Marshal.GetLastWin32Error());continue;
    }
    int status=GetMessage(out message,IntPtr.Zero,0,0);Require(status>0,"GetMessage ended; status="+status+" error="+Marshal.GetLastWin32Error());
    if(message.Message!=0x0312)continue;
    long details=message.LParam.ToInt64();uint modifiers=(uint)(details&0xffff),key=(uint)((details>>16)&0xffff);
    Require(message.WParam.ToUInt64()==1&&(modifiers&0x000f)==7&&key==0x77,"unexpected registered hotkey payload");
    Console.WriteLine("HOTKEY_COMPARATOR_PASS message="+message.Message+" id="+message.WParam.ToUInt64()+" modifiers="+modifiers+" vk="+key);matched=true;break;
   }
   Require(matched,"registered comparator hotkey timed out");return 0;
  }catch(Exception e){Console.Error.WriteLine("HOTKEY_COMPARATOR_FAIL "+e.Message);return 1;}
  finally{if(registered)UnregisterHotKey(IntPtr.Zero,1);}
 }
}
