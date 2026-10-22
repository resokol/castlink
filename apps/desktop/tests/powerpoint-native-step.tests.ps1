$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../../../native/windows-powerpoint/Control.ps1') -FunctionsOnly
function Assert-True([bool] $Value, [string] $Message) { if (-not $Value) { throw $Message } }
function Assert-Throws([scriptblock] $Action, [string] $Message) {
    $failed = $false
    try { & $Action | Out-Null } catch { $failed = $true }
    Assert-True $failed $Message
}
function New-Collection([object[]] $Items) {
    $value = [pscustomobject]@{ Items = $Items; Count = $Items.Count }
    $value | Add-Member ScriptMethod Item { param([int] $Index) return $this.Items[$Index - 1] }
    return $value
}
function New-Show([long] $Handle, $Presentation) {
    $view = [pscustomobject]@{ Slide = [pscustomobject]@{ SlideIndex = 2 }; CurrentShowPosition = 2; ClickIndex = 0; ClickCount = 2; Calls = @(); CloseOnNext = $false; Owner = $null; Show = $null }
    $view | Add-Member ScriptMethod GetClickIndex { return $this.ClickIndex }
    $view | Add-Member ScriptMethod GetClickCount { return $this.ClickCount }
    $view | Add-Member ScriptMethod GotoClick { param([int] $Index) $this.Calls += "click:$Index"; $this.ClickIndex = $Index }
    $view | Add-Member ScriptMethod Next {
        $this.Calls += 'next'
        if ($this.CloseOnNext) { $this.Owner.SlideShowWindows = New-Collection @() }
        else { $this.Slide.SlideIndex++; $this.CurrentShowPosition++; $this.ClickIndex = 0 }
    }
    $view | Add-Member ScriptMethod Previous { $this.Calls += 'previous'; $this.Slide.SlideIndex--; $this.CurrentShowPosition--; $this.ClickIndex = 0 }
    $view | Add-Member ScriptMethod GotoSlide { throw 'Step must never call GotoSlide.' }
    $show = [pscustomobject]@{ HWND = $Handle; Presentation = $Presentation; View = $view }
    $view.Show = $show
    return $show
}
function New-Presentation([string] $FullName) {
    $settings = [pscustomobject]@{ Runs = 0; Result = $null; ShowType = 3; AdvanceMode = 2; LoopUntilStopped = $true }
    $settings | Add-Member ScriptMethod Run { $this.Runs++; return $this.Result }
    return [pscustomobject]@{ FullName = $FullName; Name = [IO.Path]::GetFileName($FullName); Slides = [pscustomobject]@{ Count = 3 }; Saved = $false; SlideShowSettings = $settings }
}
$process = { param($Handle) return '42:638956000000000000' }
$presentation = New-Presentation 'C:\Private\Deck.pptx'
$show = New-Show 12345 $presentation
$other = New-Show 99999 (New-Presentation 'C:\Private\Other.pptx')
$cloudPresentation = New-Presentation 'https://tenant.sharepoint.com/sites/team/Cloud.pptx'
$app = [pscustomobject]@{ Presentations = (New-Collection @($cloudPresentation,$presentation)); SlideShowWindows = (New-Collection @($other,$show)); Opens = 0 }
$app.Presentations | Add-Member ScriptMethod Open { throw 'Matching unsaved document must be reused.' }
$presentation.SlideShowSettings.Result = $show
$show.View.Owner = $app
$started = Start-CastLinkPowerPoint -Application $app -FilePath 'c:\private\deck.pptx' -ProcessIdentityProvider $process
Assert-True ($started.windowHandle -eq '12345' -and $presentation.SlideShowSettings.Runs -eq 0) 'Reuse the matching already running show, not the first show.'
Assert-True (-not $presentation.Saved -and $presentation.SlideShowSettings.ShowType -eq 3 -and $presentation.SlideShowSettings.AdvanceMode -eq 2 -and $presentation.SlideShowSettings.LoopUntilStopped) 'Do not change unsaved content or show settings.'
$app.SlideShowWindows = New-Collection @($other)
$started = Start-CastLinkPowerPoint -Application $app -FilePath 'C:\Private\Deck.pptx' -ProcessIdentityProvider $process
Assert-True ($started.windowHandle -eq '12345' -and $presentation.SlideShowSettings.Runs -eq 1) 'Bind the exact window returned by Run even when absent from enumeration.'
$app.SlideShowWindows = New-Collection @($other,$show)
$bound = @{ Application = $app; WindowHandle = $started.windowHandle; Binding = $started.binding; ProcessIdentityProvider = $process }
$stepped = Invoke-CastLinkPowerPoint @bound -Operation step -Direction next
Assert-True ($stepped.page -eq 2 -and $stepped.clickIndex -eq 1 -and $show.View.Calls[-1] -eq 'click:1') 'First click animation remains on the slide.'
$stepped = Invoke-CastLinkPowerPoint @bound -Operation step -Direction next
Assert-True ($stepped.clickIndex -eq 2 -and $show.View.Calls[-1] -eq 'click:2') 'Second click animation is not skipped.'
$stepped = Invoke-CastLinkPowerPoint @bound -Operation step -Direction previous
Assert-True ($stepped.clickIndex -eq 1 -and $show.View.Calls[-1] -eq 'click:1') 'Previous uses animation click position before slide navigation.'
$show.View.Slide.SlideIndex = 3; $show.View.CurrentShowPosition = 3; $show.View.ClickIndex = 1
$stepped = Invoke-CastLinkPowerPoint @bound -Operation step -Direction next
Assert-True ($stepped.page -eq 3 -and $stepped.clickIndex -eq 2 -and -not $stepped.ended) 'Last slide animation still runs.'
$show.View.CloseOnNext = $true
$ended = Invoke-CastLinkPowerPoint @bound -Operation step -Direction next
Assert-True ($ended.ended -eq $true -and $show.View.Calls[-1] -eq 'next') 'Only actual disappearance after Next confirms show end.'
$app.SlideShowWindows = New-Collection @($show)
$show.View.CloseOnNext = $false
$show.View.ClickIndex = -1
$before = $show.View.Calls.Count
Assert-Throws { Invoke-CastLinkPowerPoint @bound -Operation step -Direction next } 'Auto/unknown click states explicitly unavailable.'
Assert-True ($show.View.Calls.Count -eq $before) 'Unsupported step has no native effect.'
$show.View.ClickIndex = 0
Assert-Throws { Invoke-CastLinkPowerPoint @bound -Operation step -Direction next -ExpiresAt 1 } 'Expired helper request fails before native effect.'
Assert-True ($show.View.Calls.Count -eq $before) 'Expired request cannot advance animation.'
$show.View.Slide.SlideIndex = 2; $show.View.CurrentShowPosition = 2
$observed = Invoke-CastLinkPowerPoint @bound -Operation status
Assert-True ($observed.page -eq 2 -and $show.View.Calls.Count -eq $before) 'Manual owner position is observed and never reset.'
$app.SlideShowWindows = New-Collection @($show,(New-Show 23456 $presentation))
Assert-Throws { Start-CastLinkPowerPoint -Application $app -FilePath $presentation.FullName -ProcessIdentityProvider $process } 'Multiple shows of the same document are ambiguous.'
Assert-Throws { Start-CastLinkPowerPoint -Application $app -FilePath 'https://example.org/deck.pptx' -ProcessIdentityProvider $process } 'Native start rejects nonlocal path.'
# Mock only the COM Open boundary; use a real selected local fixture file.
$fixturePath = Join-Path ([IO.Path]::GetTempPath()) ('castlink-native-fixture-' + [Guid]::NewGuid().ToString('N') + '.pptx')
[IO.File]::WriteAllBytes($fixturePath, [byte[]]@())
try {
    $openedPresentation = New-Presentation $fixturePath
    $openedShow = New-Show 87654 $openedPresentation
    $openedPresentation.SlideShowSettings.Result = $openedShow
    $presentations = New-Collection @($cloudPresentation)
    $presentations | Add-Member NoteProperty Opened $openedPresentation
    $presentations | Add-Member NoteProperty OpenCalls @()
    $presentations | Add-Member ScriptMethod Open {
        param($SelectedPath, $ReadOnly, $Untitled, $WithWindow)
        $this.OpenCalls += [pscustomobject]@{ Path = $SelectedPath; ReadOnly = $ReadOnly; Untitled = $Untitled; WithWindow = $WithWindow }
        return $this.Opened
    }
    $newApp = [pscustomobject]@{ Presentations = $presentations; SlideShowWindows = (New-Collection @($other)) }
    $opened = Start-CastLinkPowerPoint -Application $newApp -FilePath $fixturePath -ProcessIdentityProvider $process
    Assert-True ($presentations.OpenCalls.Count -eq 1 -and $presentations.OpenCalls[0].Path -ceq $fixturePath) 'Open only the selected actual local PPTX.'
    Assert-True ($presentations.OpenCalls[0].ReadOnly -eq 0 -and $presentations.OpenCalls[0].Untitled -eq 0 -and $presentations.OpenCalls[0].WithWindow -eq -1) 'Open the original file with a visible native document.'
    Assert-True ($opened.windowHandle -eq '87654' -and $openedPresentation.SlideShowSettings.Runs -eq 1) 'Return exact opened document Run window, never another show.'
    Assert-True (-not $openedPresentation.Saved) 'No automatic save after open/start.'
} finally { [IO.File]::Delete($fixturePath) }
$show.View.ClickIndex = 2; $show.View.ClickCount = 2; $show.View.Slide.SlideIndex = 2; $show.View.CurrentShowPosition = 2
$app.SlideShowWindows = New-Collection @($show)
$advanced = Invoke-CastLinkPowerPoint @bound -Operation step -Direction next
Assert-True ($advanced.page -eq 3 -and -not $advanced.ended -and $show.View.Calls[-1] -eq 'next') 'Exhausted animation clicks permit next slide while show remains active.'
$show.View.ClickIndex = 0
$back = Invoke-CastLinkPowerPoint @bound -Operation step -Direction previous
Assert-True ($back.page -eq 2 -and $show.View.Calls[-1] -eq 'previous') 'Previous from first click delegates to actual native previous slide.'
$app.Presentations = New-Collection @($cloudPresentation,$presentation,(New-Presentation $presentation.FullName))
Assert-Throws { Start-CastLinkPowerPoint -Application $app -FilePath $presentation.FullName -ProcessIdentityProvider $process } 'Ambiguous open documents refuse starting.'
Write-Output 'PASS PowerPoint native fixtures: exact Run/Open/reuse, preserved settings/unsaved document, animation clicks, manual navigation, actual end, ambiguity and deadlines.'
