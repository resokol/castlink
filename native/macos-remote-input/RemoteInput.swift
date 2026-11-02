import Foundation
import AppKit
import ApplicationServices
import CoreGraphics
import Darwin

// CG coordinates are global desktop points (top-left origin), including negative
// monitor origins. Capture extents remain backing pixels; never apply a global
// Retina multiplier to mouse coordinates.
final class MacRemoteInputPlatform: RemoteInputPlatform {
    static let marker: Int64 = 0x434153544C494E4B
    private let holdsLock = NSRecursiveLock()
    private func holds<T>(_ body: () throws -> T) rethrows -> T { holdsLock.lock(); defer { holdsLock.unlock() }; return try body() }
    private var windowID: CGWindowID?
    private var displayID: CGDirectDisplayID?
    private var processID: pid_t?
    private var processBirth: Int64?
    private var application: AXUIElement?
    private var window: AXUIElement?
    private var identity = ""
    private var lastSnapshot: InputSnapshot?
    private(set) var bindingDiagnostic: [String: Any] = ["stage":"not-bound"]
    private var lastClickTime: TimeInterval = 0, lastClickPosition = CGPoint.zero, lastClickButton = -1, clickCount = 0
    private var remoteKeys = Set<String>(), remoteButtons = Set<Int>()
    private var physicalKeys = Set<CGKeyCode>(), physicalButtons = Set<Int>()
    private var tap: CFMachPort?
    private var tapSource: CFRunLoopSource?
    private var sessionActive = true, screenLocked = false
    private var observers: [NSObjectProtocol] = []
    var authorizedForEffect: (() -> Bool)?
    var onLocalInput: (() -> Void)?
    var onStop: (() -> Void)?
    private let eventSource = CGEventSource(stateID: .privateState)

    // macOS virtual key positions preserve DOM physical-key semantics under a
    // changed keyboard layout. Unicode text uses a separate bounded CGEvent path.
    static let keys: [String: CGKeyCode] = [
        "KeyA":0,"KeyS":1,"KeyD":2,"KeyF":3,"KeyH":4,"KeyG":5,"KeyZ":6,"KeyX":7,"KeyC":8,"KeyV":9,"IntlBackslash":10,"KeyB":11,"KeyQ":12,"KeyW":13,"KeyE":14,"KeyR":15,"KeyY":16,"KeyT":17,
        "Digit1":18,"Digit2":19,"Digit3":20,"Digit4":21,"Digit6":22,"Digit5":23,"Equal":24,"Digit9":25,"Digit7":26,"Minus":27,"Digit8":28,"Digit0":29,"BracketRight":30,"KeyO":31,"KeyU":32,"BracketLeft":33,"KeyI":34,"KeyP":35,"Enter":36,"KeyL":37,"KeyJ":38,"Quote":39,"KeyK":40,"Semicolon":41,"Backslash":42,"Comma":43,"Slash":44,"KeyN":45,"KeyM":46,"Period":47,"Tab":48,"Space":49,"Backquote":50,"Backspace":51,"Escape":53,
        "MetaRight":54,"MetaLeft":55,"ShiftLeft":56,"CapsLock":57,"AltLeft":58,"ControlLeft":59,"ShiftRight":60,"AltRight":61,"ControlRight":62,"NumpadDecimal":65,"NumpadMultiply":67,"NumpadAdd":69,"NumLock":71,"NumpadDivide":75,"NumpadEnter":76,"NumpadSubtract":78,"Numpad0":82,"Numpad1":83,"Numpad2":84,"Numpad3":85,"Numpad4":86,"Numpad5":87,"Numpad6":88,"Numpad7":89,"Numpad8":91,"Numpad9":92,
        "F1":122,"F2":120,"F3":99,"F4":118,"F5":96,"F6":97,"F7":98,"F8":100,"F9":101,"F10":109,"F11":103,"F12":111,"F13":105,"F14":107,"F15":113,"F16":106,"F17":64,"F18":79,"F19":80,"F20":90,
        "Insert":114,"Home":115,"PageUp":116,"Delete":117,"End":119,"PageDown":121,"ArrowLeft":123,"ArrowRight":124,"ArrowDown":125,"ArrowUp":126,"PrintScreen":105,"ScrollLock":107,"Pause":113
    ]
    static let modifierFlags: [String: CGEventFlags] = ["MetaLeft":.maskCommand,"MetaRight":.maskCommand,"ShiftLeft":.maskShift,"ShiftRight":.maskShift,"AltLeft":.maskAlternate,"AltRight":.maskAlternate,"ControlLeft":.maskControl,"ControlRight":.maskControl,"CapsLock":.maskAlphaShift]

    init() {
        let center = NSWorkspace.shared.notificationCenter
        observers.append(center.addObserver(forName: NSWorkspace.sessionDidResignActiveNotification, object: nil, queue: .main) { [weak self] _ in self?.sessionActive = false; self?.onLocalInput?() })
        observers.append(center.addObserver(forName: NSWorkspace.sessionDidBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in self?.sessionActive = true })
        observers.append(center.addObserver(forName: NSWorkspace.willSleepNotification, object: nil, queue: .main) { [weak self] _ in self?.sessionActive = false; self?.onLocalInput?() })
        observers.append(center.addObserver(forName: NSWorkspace.didWakeNotification, object: nil, queue: .main) { [weak self] _ in self?.sessionActive = true; self?.onLocalInput?() })
        let distributed = DistributedNotificationCenter.default()
        observers.append(distributed.addObserver(forName: NSNotification.Name("com.apple.screenIsLocked"), object: nil, queue: .main) { [weak self] _ in self?.screenLocked = true; self?.onLocalInput?() })
        observers.append(distributed.addObserver(forName: NSNotification.Name("com.apple.screenIsUnlocked"), object: nil, queue: .main) { [weak self] _ in self?.screenLocked = false; self?.onLocalInput?() })
        installMonitor()
    }
    deinit {
        releaseAll()
        if let tap = tap { CGEvent.tapEnable(tap: tap, enable: false); CFMachPortInvalidate(tap) }
        if let source = tapSource { CFRunLoopRemoveSource(CFRunLoopGetMain(), source, .commonModes) }
        for observer in observers { NSWorkspace.shared.notificationCenter.removeObserver(observer); DistributedNotificationCenter.default().removeObserver(observer) }
    }
    private func installMonitor() {
        guard CGPreflightListenEventAccess(), AXIsProcessTrusted() else { return }
        let kinds: [CGEventType] = [.keyDown,.keyUp,.flagsChanged,.leftMouseDown,.leftMouseUp,.rightMouseDown,.rightMouseUp,.otherMouseDown,.otherMouseUp,.mouseMoved,.leftMouseDragged,.rightMouseDragged,.otherMouseDragged,.scrollWheel]
        let mask = kinds.reduce(CGEventMask(0)) { $0 | (CGEventMask(1) << $1.rawValue) }
        let callback: CGEventTapCallBack = { _, type, event, context in
            guard let context = context else { return Unmanaged.passUnretained(event) }
            let owner = Unmanaged<MacRemoteInputPlatform>.fromOpaque(context).takeUnretainedValue()
            if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput { owner.onLocalInput?(); if let tap = owner.tap { CGEvent.tapEnable(tap: tap, enable: true) }; return Unmanaged.passUnretained(event) }
            guard event.getIntegerValueField(.eventSourceUserData) != MacRemoteInputPlatform.marker else { return Unmanaged.passUnretained(event) }
            if type == .keyDown || type == .keyUp || type == .flagsChanged {
                let code = CGKeyCode(event.getIntegerValueField(.keyboardEventKeycode))
                owner.holds { if type == .keyDown || (type == .flagsChanged && CGEventSource.keyState(.hidSystemState, key: code)) { owner.physicalKeys.insert(code) } else { owner.physicalKeys.remove(code) } }
                if type == .keyDown && code == 100 && event.flags.contains([.maskControl,.maskAlternate,.maskShift]) { owner.onStop?() }
            } else if [.leftMouseDown,.leftMouseUp,.rightMouseDown,.rightMouseUp,.otherMouseDown,.otherMouseUp].contains(type) {
                let button = Int(event.getIntegerValueField(.mouseEventButtonNumber))
                owner.holds { if [.leftMouseDown,.rightMouseDown,.otherMouseDown].contains(type) { owner.physicalButtons.insert(button) } else { owner.physicalButtons.remove(button) } }
            }
            // A local owner action always releases remote holds. Listen-only: it
            // never consumes or modifies the physical event and records no text.
            owner.onLocalInput?()
            return Unmanaged.passUnretained(event)
        }
        tap = CGEvent.tapCreate(tap: .cgSessionEventTap, place: .headInsertEventTap, options: .listenOnly, eventsOfInterest: mask, callback: callback, userInfo: Unmanaged.passUnretained(self).toOpaque())
        if let tap = tap, let source = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0) { tapSource = source; CFRunLoopAddSource(CFRunLoopGetMain(), source, .commonModes); CGEvent.tapEnable(tap: tap, enable: true) }
    }
    private func ax(_ element: AXUIElement, _ key: CFString) -> CFTypeRef? {
        var value: CFTypeRef?; guard AXUIElementCopyAttributeValue(element, key, &value) == .success else { return nil }; return value
    }
    private func axRect(_ element: AXUIElement) -> CGRect? {
        guard let position = ax(element, kAXPositionAttribute as CFString), let size = ax(element, kAXSizeAttribute as CFString), CFGetTypeID(position) == AXValueGetTypeID(), CFGetTypeID(size) == AXValueGetTypeID() else { return nil }
        var point = CGPoint.zero, extent = CGSize.zero
        guard AXValueGetValue(unsafeBitCast(position, to: AXValue.self), .cgPoint, &point), AXValueGetValue(unsafeBitCast(size, to: AXValue.self), .cgSize, &extent) else { return nil }; return CGRect(origin: point, size: extent)
    }
    private func sameRect(_ left: CGRect, _ right: CGRect) -> Bool { abs(left.minX - right.minX) < 1 && abs(left.minY - right.minY) < 1 && abs(left.width - right.width) < 1 && abs(left.height - right.height) < 1 }
    private func windowInfo(_ id: CGWindowID) -> [String: Any]? {
        guard let list = CGWindowListCopyWindowInfo(.optionIncludingWindow, id) as? [[String: Any]] else { return nil }
        return list.first { ($0[kCGWindowNumber as String] as? NSNumber)?.uint32Value == id }
    }
    private func windowRect(_ info: [String: Any]) -> CGRect? {
        guard let bounds = info[kCGWindowBounds as String] as? NSDictionary else { return nil }; return CGRect(dictionaryRepresentation: bounds as CFDictionary)
    }
    private func displays() -> [CGDirectDisplayID] {
        var count: UInt32 = 0; guard CGGetActiveDisplayList(0, nil, &count) == .success, count > 0, count <= 64 else { return [] }
        var ids = [CGDirectDisplayID](repeating: 0, count: Int(count)); guard CGGetActiveDisplayList(count, &ids, &count) == .success else { return [] }; return Array(ids.prefix(Int(count)))
    }
    private func scale(_ id: CGDirectDisplayID) -> Double? {
        guard let mode = CGDisplayCopyDisplayMode(id), mode.width > 0 else { return nil }; return Double(mode.pixelWidth) / Double(mode.width)
    }
    func bind(_ source: [String: Any]) throws -> InputSnapshot {
        guard AXIsProcessTrusted(), CGPreflightScreenCaptureAccess() else { throw InputFailure("REMOTE_INPUT_UNAVAILABLE") }
        guard CGPreflightListenEventAccess() else { throw InputFailure("REMOTE_INPUT_MONITORING_PERMISSION") }
        let kind = try InputJSON.string(source, "kind"), key = kind == "window" ? "windowId" : "displayId"
        try InputJSON.exact(source, ["kind", key]); let raw = try InputJSON.string(source, key)
        guard raw.range(of: "^[1-9][0-9]{0,9}$", options: .regularExpression) != nil, let id = UInt32(raw) else { throw InputFailure("REMOTE_INPUT_SOURCE") }
        if kind == "window" {
            // Finite, bounded diagnostics describe only this selected fixture/source;
            // never include titles, text, file paths or another application's windows.
            bindingDiagnostic = ["stage":"cg-window", "windowId":id]
            guard let info = windowInfo(id) else { throw InputFailure("REMOTE_INPUT_SOURCE") }
            bindingDiagnostic["stage"] = "window-layer"; bindingDiagnostic["layer"] = info[kCGWindowLayer as String] as? Int ?? -1
            guard (info[kCGWindowLayer as String] as? Int) == 0 else { throw InputFailure("REMOTE_INPUT_SOURCE") }
            bindingDiagnostic["stage"] = "owner-pid"
            guard let pid = info[kCGWindowOwnerPID as String] as? Int32 else { throw InputFailure("REMOTE_INPUT_SOURCE") }
            bindingDiagnostic["ownerPid"] = pid; bindingDiagnostic["stage"] = "running-application"
            guard let app = NSRunningApplication(processIdentifier: pid) else { throw InputFailure("REMOTE_INPUT_SOURCE") }
            bindingDiagnostic["stage"] = "process-start"; bindingDiagnostic["launchDateAvailable"] = app.launchDate != nil
            let birth = processBirthMilliseconds(pid)
            bindingDiagnostic["kernelBirthAvailable"] = birth != nil
            bindingDiagnostic["processBirthSource"] = "kernel-proc-pidinfo"
            guard let start = birth else { throw InputFailure("REMOTE_INPUT_SOURCE") }
            bindingDiagnostic["stage"] = "cg-frame"
            guard let rect = windowRect(info) else { throw InputFailure("REMOTE_INPUT_SOURCE") }
            bindingDiagnostic["cgFrame"] = ["x":rect.minX,"y":rect.minY,"width":rect.width,"height":rect.height]
            let axApp = AXUIElementCreateApplication(pid)
            AXUIElementSetMessagingTimeout(axApp, 0.15)
            var value: CFTypeRef?
            let status = AXUIElementCopyAttributeValue(axApp, kAXWindowsAttribute as CFString, &value)
            bindingDiagnostic["stage"] = "ax-windows"; bindingDiagnostic["axWindowsStatus"] = status.rawValue
            guard status == .success, let windows = value as? [AXUIElement] else { throw InputFailure("REMOTE_INPUT_SOURCE") }
            bindingDiagnostic["axWindowCount"] = windows.count
            bindingDiagnostic["candidateFrames"] = windows.prefix(8).map { element -> [String: Any] in
                guard let bounds = axRect(element) else { return ["frameAvailable":false] }
                return ["frameAvailable":true,"x":bounds.minX,"y":bounds.minY,"width":bounds.width,"height":bounds.height]
            }
            let matching = windows.filter { if let bounds = axRect($0) { return sameRect(bounds, rect) }; return false }
            bindingDiagnostic["stage"] = "ax-frame-match"; bindingDiagnostic["matchingWindowCount"] = matching.count
            guard matching.count == 1 else { throw InputFailure("REMOTE_INPUT_SOURCE") }
            windowID = id; processID = pid; processBirth = start; application = axApp; window = matching[0]; identity = "window:\(id):\(pid):\(start)"
        } else if kind == "screen" {
            guard displays().contains(id), let uuid = CGDisplayCreateUUIDFromDisplayID(id)?.takeRetainedValue() else { throw InputFailure("REMOTE_INPUT_SOURCE") }
            displayID = id; identity = "display:\(id):\(CFUUIDCreateString(kCFAllocatorDefault, uuid) as String)"
        } else { throw InputFailure("REMOTE_INPUT_SOURCE") }
        let initial = InputSnapshot(identity: identity, rect: InputRect(x: 0, y: 0, width: 1, height: 1), pixelWidth: 1, pixelHeight: 1, scale: 1, visible: false)
        bindingDiagnostic["stage"] = "initial-inspection"
        guard let snapshot = inspect(initial) else { throw InputFailure("REMOTE_INPUT_SOURCE") }
        bindingDiagnostic["stage"] = "bound"; bindingDiagnostic["visible"] = snapshot.visible
        return snapshot
    }
    func inspect(_ source: InputSnapshot) -> InputSnapshot? {
        guard source.identity == identity else { return nil }
        var rect: CGRect, visible = true, backingScale: Double
        if let id = windowID {
            guard let info = windowInfo(id), let pid = processID, (info[kCGWindowOwnerPID as String] as? Int32) == pid, let app = NSRunningApplication(processIdentifier: pid), !app.isTerminated, processBirthMilliseconds(pid) == processBirth, let bounds = windowRect(info), let application = application, let window = window, let windows = ax(application, kAXWindowsAttribute as CFString) as? [AXUIElement], windows.contains(where: { CFEqual($0, window) }), let axBounds = axRect(window), sameRect(bounds, axBounds) else { return nil }
            rect = bounds
            visible = (info[kCGWindowIsOnscreen as String] as? Bool) == true && (ax(window, kAXMinimizedAttribute as CFString) as? Bool) != true && NSWorkspace.shared.frontmostApplication?.processIdentifier == pid
            if let focused = ax(application, kAXFocusedWindowAttribute as CFString) { visible = visible && CFEqual(focused, window) } else { visible = false }
            let matching = displays().filter { !CGDisplayBounds($0).intersection(rect).isEmpty }
            guard let best = matching.max(by: { CGDisplayBounds($0).intersection(rect).width * CGDisplayBounds($0).intersection(rect).height < CGDisplayBounds($1).intersection(rect).width * CGDisplayBounds($1).intersection(rect).height }), let scale = scale(best) else { return nil }
            backingScale = scale
            // A mixed-density spanning window has no single proven transform.
            if matching.contains(where: { self.scale($0) != backingScale }) { visible = false }
        } else if let id = displayID {
            guard displays().contains(id), let uuid = CGDisplayCreateUUIDFromDisplayID(id)?.takeRetainedValue(), identity == "display:\(id):\(CFUUIDCreateString(kCFAllocatorDefault, uuid) as String)", let scale = scale(id) else { return nil }
            rect = CGDisplayBounds(id); backingScale = scale
        } else { return nil }
        let width = Int((rect.width * backingScale).rounded()), height = Int((rect.height * backingScale).rounded())
        guard rect.minX.isFinite, rect.minY.isFinite, rect.width > 0, rect.height > 0, width > 0, height > 0, width <= 32768, height <= 32768 else { return nil }
        let result = InputSnapshot(identity: identity, rect: InputRect(x: rect.minX, y: rect.minY, width: rect.width, height: rect.height), pixelWidth: width, pixelHeight: height, scale: backingScale, visible: visible)
        lastSnapshot = result; return result
    }
    func safeDesktop() -> Bool {
        guard AXIsProcessTrusted(), CGPreflightScreenCaptureAccess(), CGPreflightListenEventAccess(), sessionActive, !screenLocked, let tap = tap, CGEvent.tapIsEnabled(tap: tap), let session = CGSessionCopyCurrentDictionary() as? [String: Any], session[kCGSessionOnConsoleKey as String] as? Bool == true, session["CGSSessionScreenIsLocked"] as? Bool != true else { return false }
        return true
    }
    func visiblePoint(_ source: InputSnapshot, _ point: InputPoint) -> Bool {
        guard safeDesktop(), let current = inspect(source), current.visible, (current.rect == source.rect || (!holds({ remoteButtons.isEmpty }) && current.rect.width == source.rect.width && current.rect.height == source.rect.height && current.scale == source.scale)) else { return false }
        let position = CGPoint(x: point.x, y: point.y)
        bindingDiagnostic["pointCheck"] = ["x":point.x,"y":point.y,"stage":"window-list"]
        if let id = displayID { return CGDisplayBounds(id).contains(position) }
        guard let target = windowID, let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly,.excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else { return false }
        for info in windows {
            guard (info[kCGWindowAlpha as String] as? Double ?? 1) > 0.01, let bounds = windowRect(info), bounds.contains(position) else { continue }
            let hit = (info[kCGWindowNumber as String] as? NSNumber)?.uint32Value == target
            bindingDiagnostic["pointCheck"] = ["x":point.x,"y":point.y,"stage":"top-window","matchesSelected":hit,"layer":info[kCGWindowLayer as String] as? Int ?? -1,"ownerMatchesSelected":(info[kCGWindowOwnerPID as String] as? Int32) == processID]
            return hit
        }
        return false
    }
    private func flags() -> CGEventFlags {
        holdsLock.lock(); defer { holdsLock.unlock() }
        var result = CGEventSource.flagsState(.hidSystemState)
        for key in remoteKeys { if let flag = Self.modifierFlags[key] { result.insert(flag) } }; return result
    }
    private func targetCurrentForEffect() -> Bool {
        guard let previous = lastSnapshot, let current = inspect(previous), current.visible, current.pixelWidth == previous.pixelWidth, current.pixelHeight == previous.pixelHeight, current.scale == previous.scale else { return false }
        return current.rect == previous.rect || (!holds({ remoteButtons.isEmpty }) && current.rect.width == previous.rect.width && current.rect.height == previous.rect.height)
    }
    private func post(_ event: CGEvent?) throws {
        guard let event = event, safeDesktop(), targetCurrentForEffect() else { throw InputFailure("REMOTE_INPUT_UNAVAILABLE") }
        holdsLock.lock(); defer { holdsLock.unlock() }
        guard authorizedForEffect?() == true else { throw InputFailure("REMOTE_INPUT_LEASE") }
        event.setIntegerValueField(.eventSourceUserData, value: Self.marker); event.flags = flags(); event.post(tap: .cgSessionEventTap)
    }
    func move(_ point: InputPoint) throws {
        let dragging = holds { remoteButtons.sorted().first }
        let type: CGEventType = dragging == 0 ? .leftMouseDragged : dragging == 2 ? .rightMouseDragged : dragging == 1 ? .otherMouseDragged : .mouseMoved
        try post(CGEvent(mouseEventSource: eventSource, mouseType: type, mouseCursorPosition: CGPoint(x: point.x, y: point.y), mouseButton: CGMouseButton(rawValue: UInt32(dragging == 1 ? 2 : dragging == 2 ? 1 : 0))!))
    }
    private func macButton(_ button: Int) -> CGMouseButton { button == 0 ? .left : button == 1 ? .center : .right }
    private func physicalButton(_ button: Int) -> Bool { holds { physicalButtons.contains(Int(macButton(button).rawValue)) || CGEventSource.buttonState(.hidSystemState, button: macButton(button)) } }
    func button(_ button: Int, _ down: Bool) throws {
        let shouldPost = holds { () -> Bool in
            if down { if remoteButtons.contains(button) || physicalButton(button) { return false }; remoteButtons.insert(button) }
            else { guard remoteButtons.remove(button) != nil else { return false }; if physicalButton(button) { return false } }
            return true
        }
        guard shouldPost else { return }
        let type: CGEventType = button == 0 ? (down ? .leftMouseDown : .leftMouseUp) : button == 2 ? (down ? .rightMouseDown : .rightMouseUp) : (down ? .otherMouseDown : .otherMouseUp)
        let location = CGEvent(source: nil)?.location ?? .zero
        if down {
            let time = ProcessInfo.processInfo.systemUptime
            if button == lastClickButton && time - lastClickTime <= NSEvent.doubleClickInterval && hypot(location.x - lastClickPosition.x, location.y - lastClickPosition.y) <= 4 { clickCount += 1 } else { clickCount = 1 }
            lastClickTime = time; lastClickPosition = location; lastClickButton = button
        }
        let event = CGEvent(mouseEventSource: eventSource, mouseType: type, mouseCursorPosition: location, mouseButton: macButton(button))
        event?.setIntegerValueField(.mouseEventClickState, value: Int64(clickCount))
        try post(event)
    }
    private func physicalKey(_ code: CGKeyCode) -> Bool { holds { physicalKeys.contains(code) || CGEventSource.keyState(.hidSystemState, key: code) } }
    func key(_ code: String, _ down: Bool, _ repeatKey: Bool) throws {
        guard let key = Self.keys[code] else { throw InputFailure("REMOTE_INPUT_EVENT") }
        let shouldPost = holds { () -> Bool in
            if down {
                if remoteKeys.contains(code) { if !repeatKey { return false } }
                else { if physicalKey(key) { return false }; let aliasHeld = remoteKeys.contains(where: { Self.keys[$0] == key }); remoteKeys.insert(code); if aliasHeld { return false } }
            } else { guard remoteKeys.remove(code) != nil else { return false }; if physicalKey(key) || remoteKeys.contains(where: { Self.keys[$0] == key }) { return false } }
            return true
        }
        guard shouldPost else { return }
        let event = CGEvent(keyboardEventSource: eventSource, virtualKey: key, keyDown: down)
        if repeatKey { event?.setIntegerValueField(.keyboardEventAutorepeat, value: 1) }
        try post(event)
    }
    func text(_ text: String) throws {
        guard !physicalKey(0), !holds({ remoteKeys.contains("KeyA") }) else { throw InputFailure("REMOTE_INPUT_EVENT") }
        let units = Array(text.utf16)
        guard let down = CGEvent(keyboardEventSource: eventSource, virtualKey: 0, keyDown: true), let up = CGEvent(keyboardEventSource: eventSource, virtualKey: 0, keyDown: false) else { throw InputFailure("REMOTE_INPUT_UNAVAILABLE") }
        units.withUnsafeBufferPointer { pointer in down.keyboardSetUnicodeString(stringLength: units.count, unicodeString: pointer.baseAddress); up.keyboardSetUnicodeString(stringLength: units.count, unicodeString: pointer.baseAddress) }
        try post(down)
        holds { if !physicalKey(0) { up.setIntegerValueField(.eventSourceUserData, value: Self.marker); up.flags = flags(); up.post(tap: .cgSessionEventTap) } }
    }
    func wheel(_ dx: Int, _ dy: Int) throws {
        try post(CGEvent(scrollWheelEvent2Source: eventSource, units: .pixel, wheelCount: 2, wheel1: Int32(-dy), wheel2: Int32(-dx), wheel3: 0))
    }
    func releaseAll() {
        holdsLock.lock(); defer { holdsLock.unlock() }
        // Releasing our own holds remains necessary after TCC/desktop loss. Never
        // create DOWN here and never send UP for an owner's physically held key.
        let keys = remoteKeys, buttons = remoteButtons; remoteKeys.removeAll(); remoteButtons.removeAll()
        for code in keys { guard let key = Self.keys[code], !physicalKey(key), let event = CGEvent(keyboardEventSource: eventSource, virtualKey: key, keyDown: false) else { continue }; event.setIntegerValueField(.eventSourceUserData, value: Self.marker); event.flags = flags(); event.post(tap: .cgSessionEventTap) }
        for button in buttons { guard !physicalButton(button), let event = CGEvent(mouseEventSource: eventSource, mouseType: button == 0 ? .leftMouseUp : button == 2 ? .rightMouseUp : .otherMouseUp, mouseCursorPosition: CGEvent(source: nil)?.location ?? .zero, mouseButton: macButton(button)) else { continue }; event.setIntegerValueField(.eventSourceUserData, value: Self.marker); event.flags = flags(); event.post(tap: .cgSessionEventTap) }
    }
}

final class RemoteInputOutput {
    var onFailure: (() -> Void)?
    private let queue = DispatchQueue(label: "CastLink.RemoteInput.stdout")
    private let capacity = DispatchSemaphore(value: 128)
    func write(_ value: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]), capacity.wait(timeout: .now()) == .success else { onFailure?(); exit(2) }
        let failure = onFailure
        queue.async { [capacity] in
            defer { capacity.signal() }
            do { try FileHandle.standardOutput.write(contentsOf: data + Data([10])) }
            catch { DispatchQueue.main.async { failure?(); exit(2) } }
        }
    }
    func drain() { queue.sync {} }
}

@main enum RemoteInputProgram {
    static func main() {
        let args = Array(CommandLine.arguments.dropFirst())
        if args == ["--permission-status"] || args == ["--request-input-monitoring"] {
            // Observation/request only. No NSApplication, event source, event tap,
            // authority, capture binding or generated input exists on this path.
            if args == ["--request-input-monitoring"] { _ = CGRequestListenEventAccess() }
            let result: [String: Bool] = ["screen":CGPreflightScreenCaptureAccess(), "accessibility":AXIsProcessTrusted(), "inputMonitoring":CGPreflightListenEventAccess()]
            if let data = try? JSONSerialization.data(withJSONObject: result, options: [.sortedKeys]) { FileHandle.standardOutput.write(data); FileHandle.standardOutput.write(Data([10])) }
            return
        }
        guard args.isEmpty else { exit(2) }
        signal(SIGPIPE, SIG_IGN)
        _ = NSApplication.shared; NSApp.setActivationPolicy(.prohibited)
        let epoch = Date().timeIntervalSince1970 * 1000, monotonic = ProcessInfo.processInfo.systemUptime * 1000
        let platform = MacRemoteInputPlatform(), output = RemoteInputOutput()
        let clock = { Int64(epoch + ProcessInfo.processInfo.systemUptime * 1000 - monotonic) }
        let core = RemoteInputCore(platform: platform, now: clock), gate = NativeInputGate(now: clock)
        func updateGate() { let timing = core.authorityTiming; gate.update(deadline: timing.deadline, heartbeat: timing.heartbeat, enabled: timing.enabled) }
        platform.authorizedForEffect = { gate.allowed() && core.authorizedForEffect() }
        let watchdog = DispatchSource.makeTimerSource(queue: DispatchQueue(label: "CastLink.RemoteInput.watchdog", qos: .userInteractive))
        watchdog.schedule(deadline: .now(), repeating: .milliseconds(50), leeway: .milliseconds(2))
        watchdog.setEventHandler {
            if gate.expired() {
                platform.releaseAll()
                DispatchQueue.main.async { core.pause("REMOTE_INPUT_LEASE"); output.write(["event":"state","state":core.state()]) }
            }
        }
        watchdog.resume()
        output.onFailure = { gate.revoke(); core.stop() }
        platform.onLocalInput = { gate.revoke(); let wasPaused = core.isPaused; core.pause("REMOTE_INPUT_REPLAY"); if !wasPaused { output.write(["event":"state","state":core.state()]) } }
        platform.onStop = { gate.revoke(); core.stop(); output.write(["event":"state","state":core.state()]) }
        let timer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { _ in let changed = core.tick(); updateGate(); if changed { output.write(["event":"state","state":core.state()]) } }
        RunLoop.main.add(timer, forMode: .common)
        // Byte-bounded framing before JSON parsing, not readLine's unbounded allocation.
        let input = DispatchQueue(label: "CastLink.RemoteInput.stdin")
        input.async {
            var buffer = Data()
            while true {
                let bytes = FileHandle.standardInput.availableData
                if bytes.isEmpty { gate.revoke(); platform.releaseAll(); DispatchQueue.main.async { core.stop(); output.drain(); exit(0) }; return }
                for byte in bytes {
                    if byte == 10 {
                        let line = buffer; buffer.removeAll(keepingCapacity: true)
                        DispatchQueue.main.sync {
                            var id: Any = 0
                            do {
                                guard !line.isEmpty, let command = try JSONSerialization.jsonObject(with: line) as? [String: Any] else { throw InputFailure("REMOTE_INPUT_PROTOCOL") }
                                id = command["id"] ?? 0; try core.command(command); updateGate()
                                var reply: [String: Any] = ["id":id,"ok":true,"state":core.state()]
                                if command["op"] as? String == "start" { reply["diagnostic"] = platform.bindingDiagnostic }
                                output.write(reply)
                                if command["op"] as? String == "stop" { output.drain(); exit(0) }
                            } catch { gate.revoke(); core.pause(); output.write(["id":id,"ok":false,"error":(error as? InputFailure)?.code ?? "REMOTE_INPUT_PROTOCOL","state":core.state(),"diagnostic":platform.bindingDiagnostic]) }
                        }
                    } else {
                        buffer.append(byte)
                        if buffer.count > 16384 { gate.revoke(); platform.releaseAll(); DispatchQueue.main.sync { core.stop(); output.drain(); exit(2) }; return }
                    }
                }
            }
        }
        withExtendedLifetime(watchdog) { RunLoop.main.run() }
    }
}
