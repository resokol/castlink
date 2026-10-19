param(
    [ValidateSet('status', 'goto')][string] $Operation = 'status',
    [string] $WindowHandle = '',
    [string] $Binding = '',
    [int] $Page = 0,
    [switch] $FunctionsOnly
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

function Initialize-CastLinkPowerPointWindowApi {
    if (-not ('CastLink.PowerPointWindowApi' -as [type])) {
        Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
namespace CastLink {
    public static class PowerPointWindowApi {
        [DllImport("user32.dll")]
        public static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
        [DllImport("user32.dll")]
        public static extern IntPtr GetForegroundWindow();
    }
}
'@ | Out-Null
    }
}

function ConvertTo-CastLinkPowerPointHandle($Value) {
    $number = [long] $Value
    # PowerPoint's HWND COM property can be a signed 32-bit integer.
    if ($number -lt 0 -and $number -ge [int]::MinValue) { $number += 4294967296L }
    if ($number -le 0) { throw 'Slideshow unavailable.' }
    return $number.ToString([Globalization.CultureInfo]::InvariantCulture)
}

function Get-CastLinkPowerPointProcessIdentity([string] $Handle) {
    Initialize-CastLinkPowerPointWindowApi
    $processId = [uint32] 0
    [void] [CastLink.PowerPointWindowApi]::GetWindowThreadProcessId([IntPtr] ([long] $Handle), [ref] $processId)
    if ($processId -eq 0) { throw 'Slideshow unavailable.' }
    $process = [Diagnostics.Process]::GetProcessById([int] $processId)
    try {
        if ($process.ProcessName -ine 'POWERPNT') { throw 'Slideshow unavailable.' }
        return ('{0}:{1}' -f $process.Id, $process.StartTime.ToUniversalTime().Ticks)
    } finally { $process.Dispose() }
}

function Get-CastLinkPowerPointSnapshot {
    param($Window, [scriptblock] $ProcessIdentityProvider)
    $handle = ConvertTo-CastLinkPowerPointHandle $Window.HWND
    $presentation = $Window.Presentation
    $fullName = [string] $presentation.FullName
    $name = [IO.Path]::GetFileName([string] $presentation.Name) -replace '[\x00-\x1f\x7f]', ''
    $name = $name.Trim()
    if ($name.Length -gt 200) { $name = $name.Substring(0, 200) }
    $pages = [int] $presentation.Slides.Count
    $position = [int] $Window.View.Slide.SlideIndex
    if ([string]::IsNullOrWhiteSpace($fullName) -or [string]::IsNullOrWhiteSpace($name) -or $pages -lt 1 -or $position -lt 1 -or $position -gt $pages) { throw 'Slideshow unavailable.' }
    $processIdentity = [string] (& $ProcessIdentityProvider $handle)
    if ([string]::IsNullOrWhiteSpace($processIdentity)) { throw 'Slideshow unavailable.' }
    $hashInput = '{0}' + "`0" + '{1}' + "`0" + '{2}'
    $bytes = [Text.Encoding]::UTF8.GetBytes(($hashInput -f $fullName, $handle, $processIdentity))
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $digest = $sha.ComputeHash($bytes) } finally { $sha.Dispose() }
    $hash = [BitConverter]::ToString($digest).Replace('-', '').ToLowerInvariant()
    return [pscustomobject]@{ windowHandle = $handle; binding = $hash; name = $name; pages = $pages; page = $position }
}

function Invoke-CastLinkPowerPoint {
    param(
        $Application,
        [ValidateSet('status', 'goto')][string] $Operation,
        [string] $WindowHandle = '',
        [string] $Binding = '',
        [int] $Page = 0,
        [scriptblock] $ProcessIdentityProvider = { param($Handle) Get-CastLinkPowerPointProcessIdentity $Handle },
        [string] $ForegroundHandle = ''
    )
    $bound = -not [string]::IsNullOrEmpty($WindowHandle) -or -not [string]::IsNullOrEmpty($Binding)
    $parsedHandle = [long] 0
    if ($bound -and ($WindowHandle -cnotmatch '^[1-9][0-9]{0,18}$' -or -not [long]::TryParse($WindowHandle, [ref] $parsedHandle) -or $Binding -cnotmatch '^[a-f0-9]{64}$')) { throw 'Slideshow unavailable.' }
    if ($Operation -eq 'goto' -and -not $bound) { throw 'Slideshow unavailable.' }
    $windows = $Application.SlideShowWindows
    $count = [int] $windows.Count
    if ($count -lt 1) { throw 'Slideshow unavailable.' }
    if (-not $bound -and $count -gt 1 -and [string]::IsNullOrEmpty($ForegroundHandle)) {
        Initialize-CastLinkPowerPointWindowApi
        $ForegroundHandle = ConvertTo-CastLinkPowerPointHandle ([CastLink.PowerPointWindowApi]::GetForegroundWindow().ToInt64())
    }
    $selected = $null
    for ($index = 1; $index -le $count; $index++) {
        $candidate = $windows.Item($index)
        $handle = ConvertTo-CastLinkPowerPointHandle $candidate.HWND
        if (($bound -and $handle -ceq $WindowHandle) -or (-not $bound -and ($count -eq 1 -or $handle -ceq $ForegroundHandle))) {
            $selected = $candidate
            break
        }
    }
    if ($null -eq $selected) { throw 'Slideshow unavailable.' }
    $status = Get-CastLinkPowerPointSnapshot -Window $selected -ProcessIdentityProvider $ProcessIdentityProvider
    if ($bound -and ($status.windowHandle -cne $WindowHandle -or $status.binding -cne $Binding)) { throw 'Slideshow unavailable.' }
    if ($Operation -eq 'goto') {
        if ($Page -lt 1 -or $Page -gt $status.pages) { throw 'Slideshow unavailable.' }
        # The sole mutation is navigation of the exact existing bound view.
        [void] $selected.View.GotoSlide($Page)
        $status = Get-CastLinkPowerPointSnapshot -Window $selected -ProcessIdentityProvider $ProcessIdentityProvider
        if ($status.windowHandle -cne $WindowHandle -or $status.binding -cne $Binding -or $status.page -ne $Page) { throw 'Slideshow unavailable.' }
    }
    return $status
}

if ($FunctionsOnly) { return }
try {
    [Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
    # Attach to an existing ROT registration only: never launch Office, open a
    # presentation, synthesize keyboard input, close a document or quit the app.
    $application = [Runtime.InteropServices.Marshal]::GetActiveObject('PowerPoint.Application')
    $result = Invoke-CastLinkPowerPoint -Application $application -Operation $Operation -WindowHandle $WindowHandle -Binding $Binding -Page $Page
    [Console]::Out.WriteLine(($result | ConvertTo-Json -Compress))
    exit 0
} catch {
    [Console]::Error.WriteLine('PowerPoint slideshow unavailable.')
    exit 1
}
