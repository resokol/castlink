using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;
class EasySetup {
  [STAThread] static void Main(string[] args) {
    try {
      string root=AppDomain.CurrentDomain.BaseDirectory;
      string ps=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), @"System32\WindowsPowerShell\v1.0\powershell.exe");
      string script=Path.Combine(root,@"scripts\simple-easy-setup-gui.ps1");
      if(!File.Exists(ps)||!File.Exists(script)) throw new Exception("Распакуй всю папку установщика перед запуском EasySetup.exe.");
      string arguments="-NoProfile -STA -ExecutionPolicy Bypass -File "+Quote(script);
      if(args.Length==2&&args[0]=="--smoke-result") arguments+=" -SmokeResult "+Quote(args[1]);
      else if(args.Length!=0) throw new Exception("Запусти EasySetup.exe без дополнительных параметров.");
      ProcessStartInfo info=new ProcessStartInfo(ps,arguments);
      info.UseShellExecute=false;info.CreateNoWindow=false;info.WindowStyle=ProcessWindowStyle.Hidden;info.WorkingDirectory=root;
      Process.Start(info);
    } catch(Exception e) {MessageBox.Show(e.Message,"CastLink Easy Setup",MessageBoxButtons.OK,MessageBoxIcon.Error);}
  }
  static string Quote(string value) {return "\""+value.Replace("\"","\\\"")+"\"";}
}
