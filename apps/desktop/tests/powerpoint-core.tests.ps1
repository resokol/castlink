$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../../../native/windows-powerpoint/Control.ps1') -FunctionsOnly

function Assert-True([bool] $Value, [string] $Message) { if (-not $Value) { throw $Message } }
function Assert-Throws([scriptblock] $Action, [string] $Message) {
    $failed = $false
    try { & $Action | Out-Null } catch { $failed = $true }
    Assert-True $failed $Message
}
function New-FakeShow([long] $Handle, [string] $Name) {
    $presentation = [pscustomobject]@{ Name = $Name; FullName = ('C:\Private\' + $Name); Slides = [pscustomobject]@{ Count = 12 } }
    $view = [pscustomobject]@{ Slide = [pscustomobject]@{ SlideIndex = 3 }; Calls = 0 }
    $view | Add-Member ScriptMethod GotoSlide { param([int] $Index) $this.Calls++; $this.Slide.SlideIndex = $Index }
    return [pscustomobject]@{ HWND = $Handle; Presentation = $presentation; View = $view }
}
function New-FakeApp([object[]] $Shows) {
    $collection = [pscustomobject]@{ Count = $Shows.Count; Items = $Shows }
    $collection | Add-Member ScriptMethod Item { param([int] $Index) return $this.Items[$Index - 1] }
    return [pscustomobject]@{ SlideShowWindows = $collection }
}

$first = New-FakeShow 12345 'First.pptx'
$app = New-FakeApp @($first)
$process = { param($Handle) return '42:638956000000000000' }
$status = Invoke-CastLinkPowerPoint -Application $app -Operation status -ProcessIdentityProvider $process -ForegroundHandle '999'
Assert-True ($status.windowHandle -ceq '12345') 'Select the only existing running slideshow.'
Assert-True ($status.name -ceq 'First.pptx') 'Return the presentation basename only.'
Assert-True ($status.binding -cmatch '^[a-f0-9]{64}$') 'Binding must be SHA256.'
Assert-True ($status.pages -eq 12 -and $status.page -eq 3) 'Read real slideshow position and slide count.'
Assert-True (@($status.PSObject.Properties.Name).Count -eq 5) 'Do not return paths, COM objects or process details.'
Assert-True (($status | ConvertTo-Json -Compress) -notmatch 'Private') 'Never expose the full presentation path.'
$bound = @{ Application = $app; WindowHandle = $status.windowHandle; Binding = $status.binding; ProcessIdentityProvider = $process }
$moved = Invoke-CastLinkPowerPoint @bound -Operation goto -Page 8
Assert-True ($moved.page -eq 8 -and $first.View.Calls -eq 1) 'Only GotoSlide changes the exact bound view.'
foreach ($page in @(0, -1, 13)) { Assert-Throws { Invoke-CastLinkPowerPoint @bound -Operation goto -Page $page } 'Reject out-of-range slide indices.' }
Assert-True ($first.View.Calls -eq 1) 'Invalid indices cannot invoke GotoSlide.'
Assert-Throws { Invoke-CastLinkPowerPoint -Application $app -Operation goto -Page 2 -ProcessIdentityProvider $process } 'Unbound goto is forbidden.'
Assert-Throws { Invoke-CastLinkPowerPoint @bound -Operation 'Quit' } 'Only status/goto operations exist.'
$first.Presentation.FullName = 'C:\Private\Replacement.pptx'
Assert-Throws { Invoke-CastLinkPowerPoint @bound -Operation goto -Page 2 } 'Changing a document invalidates its binding before navigation.'
Assert-True ($first.View.Calls -eq 1) 'A replacement document never receives the old grant.'
$first.Presentation.FullName = 'C:\Private\First.pptx'
$restarted = { param($Handle) return '42:638956000000000001' }
Assert-Throws { Invoke-CastLinkPowerPoint -Application $app -Operation status -WindowHandle $status.windowHandle -Binding $status.binding -ProcessIdentityProvider $restarted } 'A restarted application invalidates the binding.'
$first.HWND = 54321
Assert-Throws { Invoke-CastLinkPowerPoint @bound -Operation status } 'A different slideshow window cannot reuse the grant.'
$first.HWND = 12345
$second = New-FakeShow 23456 'Second.pptx'
$multiple = New-FakeApp @($first, $second)
$active = Invoke-CastLinkPowerPoint -Application $multiple -Operation status -ForegroundHandle '23456' -ProcessIdentityProvider $process
Assert-True ($active.name -ceq 'Second.pptx') 'Multiple shows select only the foreground slideshow.'
Assert-Throws { Invoke-CastLinkPowerPoint -Application $multiple -Operation status -ForegroundHandle '999' -ProcessIdentityProvider $process } 'Ambiguous shows fail closed.'
$ended = New-FakeApp @()
Assert-Throws { Invoke-CastLinkPowerPoint -Application $ended -Operation status -ProcessIdentityProvider $process } 'An ended slideshow is unavailable.'
Assert-Throws { Invoke-CastLinkPowerPoint -Application $ended -Operation goto -Page 2 -WindowHandle $status.windowHandle -Binding $status.binding -ProcessIdentityProvider $process } 'An ended show cannot receive navigation.'
Write-Output 'PASS PowerPoint core: existing-show selection, exact HWND/document/process binding, bounded navigation, changed/ended/ambiguous refusal, sanitized output.'
