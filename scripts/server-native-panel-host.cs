using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Windows.Forms;

// WindowsApplication: Explorer and Task Scheduler never create a console for this host.
internal static class CastLinkServerPanel {
  [STAThread] private static int Main(string[] args) {
    try {
      string root = AppDomain.CurrentDomain.BaseDirectory;
      string binding = Path.Combine(root, "server-native-binding.json");
      bool startup = false;
      for (int i = 0; i < args.Length; i++) {
        if (args[i] == "--binding" && i + 1 < args.Length) binding = Path.GetFullPath(args[++i]);
        else if (args[i] == "--startup") startup = true;
        else throw new ArgumentException("Unknown CastLink panel argument.");
      }
      string script = Path.Combine(root, "server-native-control.ps1");
      string powershell = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), @"System32\WindowsPowerShell\v1.0\powershell.exe");
      if (!File.Exists(script) || !File.Exists(binding) || !File.Exists(powershell))
        throw new FileNotFoundException("Не найдены файлы панели CastLink или привязка установленного сервера.");
      string command = "$ErrorActionPreference='Stop'; try { & '" + script.Replace("'", "''") + "' -BindingFile '" + binding.Replace("'", "''") + "'";
      if (startup) command += " -Startup -StartServer";
      // EncodedCommand otherwise normalizes a script's nonzero exit code to 1 on WinPS 5.1.
      command += "; if ($null -eq $LASTEXITCODE) { exit 0 }; exit $LASTEXITCODE } catch { exit 1 }";
      var info = new ProcessStartInfo(powershell, "-NoLogo -NoProfile -NonInteractive -STA -ExecutionPolicy Bypass -EncodedCommand " + Convert.ToBase64String(Encoding.Unicode.GetBytes(command)));
      info.UseShellExecute = false;
      info.CreateNoWindow = true;
      info.WindowStyle = ProcessWindowStyle.Hidden;
      info.WorkingDirectory = root;
      using (var process = Process.Start(info)) {
        if (process == null) throw new InvalidOperationException("Panel could not start.");
        // Keep Task Scheduler attached to the real panel lifetime and failure result.
        process.WaitForExit();
        return process.ExitCode;
      }
    } catch (Exception error) {
      MessageBox.Show(error.Message, "CastLink Server", MessageBoxButtons.OK, MessageBoxIcon.Error);
      return 1;
    }
  }
}
