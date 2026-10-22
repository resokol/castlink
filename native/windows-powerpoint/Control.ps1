param(
    [ValidateSet('status', 'goto', 'start', 'step')][string] $Operation = 'status',
    [string] $WindowHandle = '',
    [string] $Binding = '',
    [int] $Page = 0,
    [string] $FilePath = '',
    [ValidateSet('', 'next', 'previous')][string] $Direction = '',
    [long] $ExpiresAt = 0,
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
    $status = [pscustomobject]@{ windowHandle = $handle; binding = $hash; name = $name; pages = $pages; page = $position }
    # Legacy shows without this API remain observable/navigable with goto.
    try {
        $clickIndex = [int] $Window.View.GetClickIndex()
        $clickCount = [int] $Window.View.GetClickCount()
        $showPosition = [int] $Window.View.CurrentShowPosition
        if ($clickCount -lt 0 -or $showPosition -lt 1) { throw 'Unavailable click state.' }
        $status | Add-Member NoteProperty clickIndex $clickIndex
        $status | Add-Member NoteProperty clickCount $clickCount
        $status | Add-Member NoteProperty showPosition $showPosition
        $status | Add-Member NoteProperty ended $false
    } catch { }
    return $status
}

function Assert-CastLinkLocalPptx([string] $FilePath) {
    if ($FilePath -notmatch '^[a-zA-Z]:[\\/]' -or $FilePath -match '[\x00-\x1f]' -or [IO.Path]::GetExtension($FilePath) -ine '.pptx') { throw 'Local PPTX required.' }
}

function Start-CastLinkPowerPoint {
    param($Application, [string] $FilePath, [scriptblock] $ProcessIdentityProvider = { param($Handle) Get-CastLinkPowerPointProcessIdentity $Handle })
    Assert-CastLinkLocalPptx $FilePath
    $selectedPath = [IO.Path]::GetFullPath($FilePath)
    $selected = $null
    for ($index = 1; $index -le [int] $Application.Presentations.Count; $index++) {
        $candidate = $Application.Presentations.Item($index)
        $candidatePath = [string] $candidate.FullName
        # Cloud URLs/unsaved names cannot identify the selected local PPTX.
        # Normalize only supported local identities; an unrelated document must
        # not prevent finding and reusing the owner's selected unsaved document.
        if ($candidatePath -notmatch '^[a-zA-Z]:[\\/]' -or $candidatePath -match '[\x00-\x1f]') { continue }
        try { $candidatePath = [IO.Path]::GetFullPath($candidatePath) } catch { continue }
        if ([string]::Equals($candidatePath, $selectedPath, [StringComparison]::OrdinalIgnoreCase)) {
            if ($null -ne $selected) { throw 'Ambiguous presentation.' }
            $selected = $candidate
        }
    }
    if ($null -eq $selected) {
        if (-not [IO.File]::Exists($FilePath)) { throw 'Local PPTX unavailable.' }
        # ReadOnly=false, Untitled=false, WithWindow=true. No Save/Close/Quit.
        $selected = $Application.Presentations.Open($FilePath, 0, 0, -1)
    }
    $existing = $null
    for ($index = 1; $index -le [int] $Application.SlideShowWindows.Count; $index++) {
        $candidate = $Application.SlideShowWindows.Item($index)
        if ([string]::Equals([string] $candidate.Presentation.FullName, [string] $selected.FullName, [StringComparison]::OrdinalIgnoreCase)) {
            if ($null -ne $existing) { throw 'Ambiguous slideshow.' }
            $existing = $candidate
        }
    }
    if ($null -ne $existing) { return Get-CastLinkPowerPointSnapshot -Window $existing -ProcessIdentityProvider $ProcessIdentityProvider }
    # Run returns the exact show. Never select the first/foreground show after it.
    $window = $selected.SlideShowSettings.Run()
    if (-not [string]::Equals([string] $window.Presentation.FullName, [string] $selected.FullName, [StringComparison]::OrdinalIgnoreCase)) { throw 'Slideshow unavailable.' }
    return Get-CastLinkPowerPointSnapshot -Window $window -ProcessIdentityProvider $ProcessIdentityProvider
}

function Assert-CastLinkStepDeadline([long] $ExpiresAt) {
    if ($ExpiresAt -ne 0 -and [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -ge $ExpiresAt) { throw 'CastLinkStepUnavailable' }
}

function Invoke-CastLinkPowerPoint {
    param(
        $Application,
        [ValidateSet('status', 'goto', 'step')][string] $Operation,
        [string] $WindowHandle = '',
        [string] $Binding = '',
        [int] $Page = 0,
        [ValidateSet('', 'next', 'previous')][string] $Direction = '',
        [long] $ExpiresAt = 0,
        [scriptblock] $ProcessIdentityProvider = { param($Handle) Get-CastLinkPowerPointProcessIdentity $Handle },
        [string] $ForegroundHandle = ''
    )
    $bound = -not [string]::IsNullOrEmpty($WindowHandle) -or -not [string]::IsNullOrEmpty($Binding)
    $parsedHandle = [long] 0
    if ($bound -and ($WindowHandle -cnotmatch '^[1-9][0-9]{0,18}$' -or -not [long]::TryParse($WindowHandle, [ref] $parsedHandle) -or $Binding -cnotmatch '^[a-f0-9]{64}$')) { throw 'Slideshow unavailable.' }
    if ($Operation -ne 'status' -and -not $bound) { throw 'Slideshow unavailable.' }
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
        [void] $selected.View.GotoSlide($Page)
    } elseif ($Operation -eq 'step') {
        # Documented APIs: Next/Previous navigate slides; GotoClick handles
        # animation clicks. Negative/unknown automatic click state is unsupported.
        if ($Direction -notin @('next', 'previous') -or $null -eq $status.clickIndex -or $null -eq $status.clickCount -or $status.clickIndex -lt 0 -or $status.clickIndex -gt $status.clickCount) { throw 'CastLinkStepUnavailable' }
        Assert-CastLinkStepDeadline $ExpiresAt
        $mayEnd = $false
        if ($Direction -eq 'next') {
            if ($status.clickIndex -lt $status.clickCount) { [void] $selected.View.GotoClick(($status.clickIndex + 1)) }
            else { $mayEnd = $true; [void] $selected.View.Next() }
        } else {
            if ($status.clickIndex -gt 0) { [void] $selected.View.GotoClick(($status.clickIndex - 1)) }
            else { [void] $selected.View.Previous() }
        }
        # A real Next may close the speaker show or wrap the kiosk show.
        # The slide number alone never indicates an ended presentation.
        $stillPresent = $false
        for ($index = 1; $index -le [int] $Application.SlideShowWindows.Count; $index++) {
            if ((ConvertTo-CastLinkPowerPointHandle $Application.SlideShowWindows.Item($index).HWND) -ceq $WindowHandle) { $stillPresent = $true; break }
        }
        if (-not $stillPresent) {
            if (-not $mayEnd) { throw 'Slideshow unavailable.' }
            $status.ended = $true
            return $status
        }
    }
    if ($Operation -ne 'status') {
        $status = Get-CastLinkPowerPointSnapshot -Window $selected -ProcessIdentityProvider $ProcessIdentityProvider
        if ($status.windowHandle -cne $WindowHandle -or $status.binding -cne $Binding -or ($Operation -eq 'goto' -and $status.page -ne $Page)) { throw 'Slideshow unavailable.' }
    }
    return $status
}

if ($FunctionsOnly) { return }
try {
    [Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
    if ($Operation -eq 'start') {
        Assert-CastLinkLocalPptx $FilePath
        # Office creation is allowed solely by this explicit local start operation.
        try { $application = [Runtime.InteropServices.Marshal]::GetActiveObject('PowerPoint.Application') }
        catch { $application = New-Object -ComObject PowerPoint.Application }
        $result = Start-CastLinkPowerPoint -Application $application -FilePath $FilePath
    } else {
        $application = [Runtime.InteropServices.Marshal]::GetActiveObject('PowerPoint.Application')
        $result = Invoke-CastLinkPowerPoint -Application $application -Operation $Operation -WindowHandle $WindowHandle -Binding $Binding -Page $Page -Direction $Direction -ExpiresAt $ExpiresAt
    }
    [Console]::Out.WriteLine(($result | ConvertTo-Json -Compress))
    exit 0
} catch {
    [Console]::Error.WriteLine('PowerPoint slideshow unavailable.')
    if ($_.Exception.Message -eq 'CastLinkStepUnavailable') { exit 2 }
    exit 1
}
