// Genuine Windows production-hook smoke. This fixture never injects input or
// posts WM_HOTKEY. QA may press the chord only after READY and exact owned
// process/foreground fixture PID, creation, path/hash and nonce guards succeed.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Threading;

internal static class RemoteInputHotkeyFixture {
 static void Require(bool value,string label){if(!value)throw new Exception(label);}
 static int Main(){
  RemoteInputCore core=null;
  try{
   Require(WindowsRemoteInputPlatform.EmergencyVirtualKey==0x77,"unexpected emergency binding; do not press any shortcut");
   var platform=new WindowsRemoteInputPlatform();core=new RemoteInputCore(platform,delegate{return 0L;});
   var delivered=new ManualResetEvent(false);int callbacks=0;
   // The real production method returns only after both real LL hooks and
   // RegisterHotKey succeed on its dedicated GetMessage thread.
   platform.StartHooks(delegate{lock(core.Sync){core.Stop();Interlocked.Increment(ref callbacks);delivered.Set();}});
   Require(Interlocked.CompareExchange(ref callbacks,0,0)==0,"unexpected callback before READY");
   Console.WriteLine("HOTKEY_READY pid="+Process.GetCurrentProcess().Id+" vk="+WindowsRemoteInputPlatform.EmergencyVirtualKey+" Ctrl+Alt+Shift+F8");Console.Out.Flush();
   Require(delivered.WaitOne(15000),"production hotkey callback timed out");
   lock(core.Sync){
    var state=(Dictionary<string,object>)core.State();
    Require(state["stopped"].Equals(true)&&state["ready"].Equals(false)&&state["active"].Equals(false)&&state["pointerReady"].Equals(false),"callback did not stop native core");
    core.Tick();state=(Dictionary<string,object>)core.State();Require(state["stopped"].Equals(true),"terminal Stop was not sticky");
   }
   Require(Interlocked.CompareExchange(ref callbacks,0,0)==1,"expected exactly one production hotkey callback");
   Console.WriteLine("HOTKEY_PASS production RegisterHotKey/GetMessage -> callback -> sticky core.Stop (no source, grant, input injection or WM_HOTKEY post)");return 0;
  }catch(InputFailure e){Console.Error.WriteLine("HOTKEY_FAIL "+e.Code);return 1;}
  catch(Exception e){Console.Error.WriteLine("HOTKEY_FAIL "+e.Message);return 1;}
  finally{if(core!=null)lock(core.Sync)core.Stop();}
 }
}
