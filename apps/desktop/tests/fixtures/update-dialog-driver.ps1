param([int]$OwnerProcess,[string]$Title,[string]$Screenshot,[string]$Choice,[switch]$Toggle,[switch]$SingleButton)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Drawing,UIAutomationClient,UIAutomationTypes
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
using System.Collections.Generic;
public class UpdateDialogQA {
 public delegate bool Callback(IntPtr hwnd,IntPtr data);
 [DllImport("user32.dll")] public static extern bool EnumWindows(Callback callback,IntPtr data);
 [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr parent,Callback callback,IntPtr data);
 [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hwnd,StringBuilder text,int count);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd,out uint process);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd,out Rect rect);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")] public static extern void mouse_event(uint flags,uint x,uint y,uint data,UIntPtr extra);
 [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr hwnd,uint message,IntPtr w,IntPtr l);
 public struct Rect { public int left,top,right,bottom; }
 public static string Text(IntPtr h){var b=new StringBuilder(4096);GetWindowText(h,b,b.Capacity);return b.ToString();}
 public static IntPtr Find(int process,string title){IntPtr found=IntPtr.Zero;EnumWindows((h,d)=>{uint p;GetWindowThreadProcessId(h,out p);if(p==process&&Text(h)==title){found=h;return false;}return true;},IntPtr.Zero);return found;}
 public static IntPtr Button(IntPtr dialog,string text){IntPtr found=IntPtr.Zero;EnumChildWindows(dialog,(h,d)=>{if(Text(h).Replace("&","")==text){found=h;return false;}return true;},IntPtr.Zero);return found;}
 public static string[] Children(IntPtr dialog){var list=new List<string>();EnumChildWindows(dialog,(h,d)=>{var text=Text(h);if(text.Length>0)list.Add(text);return true;},IntPtr.Zero);return list.ToArray();}
}
'@
$deadline=[DateTime]::UtcNow.AddSeconds(15)
$window=[IntPtr]::Zero
while($window -eq [IntPtr]::Zero -and [DateTime]::UtcNow -lt $deadline){$window=[UpdateDialogQA]::Find($OwnerProcess,$Title);if($window -eq [IntPtr]::Zero){Start-Sleep -Milliseconds 100}}
if($window -eq [IntPtr]::Zero){throw 'Owned QA dialog was not found'}
$null=[UpdateDialogQA]::SetForegroundWindow($window)
Start-Sleep -Milliseconds 300
$automation=[Windows.Automation.AutomationElement]::FromHandle($window)
$elements=$automation.FindAll([Windows.Automation.TreeScope]::Descendants,[Windows.Automation.Condition]::TrueCondition)
$children=@($elements|ForEach-Object{$_.Current.Name})
if($Toggle){
 $checkbox=$elements|Where-Object{$_.Current.ControlType -eq [Windows.Automation.ControlType]::CheckBox}|Select-Object -First 1
 if(-not $checkbox){$children|ConvertTo-Json;throw 'QA checkbox not found'}
 $checkbox.GetCurrentPattern([Windows.Automation.TogglePattern]::Pattern).Toggle()
}
$rect=New-Object UpdateDialogQA+Rect
$null=[UpdateDialogQA]::GetWindowRect($window,[ref]$rect)
$bitmap=New-Object Drawing.Bitmap(($rect.right-$rect.left),($rect.bottom-$rect.top))
$graphics=[Drawing.Graphics]::FromImage($bitmap)
try{$graphics.CopyFromScreen($rect.left,$rect.top,0,0,$bitmap.Size);$bitmap.Save($Screenshot,[Drawing.Imaging.ImageFormat]::Png)}finally{$graphics.Dispose();$bitmap.Dispose()}
$button=$elements|Where-Object{$_.Current.Name.Replace('&','') -eq $Choice}|Select-Object -First 1
if(-not $button -and $SingleButton){$button=$elements|Where-Object{$_.Current.Name}|Select-Object -Last 1}
if(-not $button){$children|ConvertTo-Json;throw ('QA choice not found: '+$Choice)}
$bounds=$button.Current.BoundingRectangle
$null=[UpdateDialogQA]::SetForegroundWindow($window)
$null=[UpdateDialogQA]::SetCursorPos([int]($bounds.Left+$bounds.Width/2),[int]($bounds.Top+$bounds.Height/2))
[UpdateDialogQA]::mouse_event(2,0,0,0,[UIntPtr]::Zero)
[UpdateDialogQA]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
[pscustomobject]@{screenshot=$Screenshot;children=$children;choice=$Choice}|ConvertTo-Json -Depth 4
