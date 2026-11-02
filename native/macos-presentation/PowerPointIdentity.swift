import AppKit
import ApplicationServices
import CryptoKit
import Darwin
import Carbon.HIToolbox

// Keypad virtual keys retain numeric semantics on standard layouts including
// French AZERTY, whose unshifted top row is punctuation. Only ASCII decimal
// digits from the validated integer are encodable; no layout guess/fallback.
func keypadDigit(_ character: Character) -> CGKeyCode? {
    switch character {
    case "0": return CGKeyCode(kVK_ANSI_Keypad0)
    case "1": return CGKeyCode(kVK_ANSI_Keypad1)
    case "2": return CGKeyCode(kVK_ANSI_Keypad2)
    case "3": return CGKeyCode(kVK_ANSI_Keypad3)
    case "4": return CGKeyCode(kVK_ANSI_Keypad4)
    case "5": return CGKeyCode(kVK_ANSI_Keypad5)
    case "6": return CGKeyCode(kVK_ANSI_Keypad6)
    case "7": return CGKeyCode(kVK_ANSI_Keypad7)
    case "8": return CGKeyCode(kVK_ANSI_Keypad8)
    case "9": return CGKeyCode(kVK_ANSI_Keypad9)
    default: return nil
    }
}

// Dialogs are represented either by an AXSheet role or an AXWindow with a
// dialog subrole. Unknown/missing required metadata cannot prove safe focus.
func nonModalMetadata(role: String?, subrole: String?) -> Bool {
    guard let role = role, !role.isEmpty, role != "AXUnknown",
          role != "AXSheet", role != "AXDialog",
          subrole != "AXDialog", subrole != "AXSystemDialog" else { return false }
    if role == "AXWindow" { return subrole == "AXStandardWindow" }
    return true
}

// Public APIs only. Scripting window IDs are NOT assumed to be CGWindowIDs.
func ax(_ value: AXUIElement, _ name: String) -> CFTypeRef? {
    var result: CFTypeRef?
    return AXUIElementCopyAttributeValue(value, name as CFString, &result) == .success ? result : nil
}
func frame(_ window: AXUIElement) -> CGRect? {
    guard let p = ax(window, kAXPositionAttribute), let s = ax(window, kAXSizeAttribute), CFGetTypeID(p) == AXValueGetTypeID(), CFGetTypeID(s) == AXValueGetTypeID() else { return nil }
    var point = CGPoint.zero; var size = CGSize.zero
    guard AXValueGetValue(p as! AXValue, .cgPoint, &point), AXValueGetValue(s as! AXValue, .cgSize, &size) else { return nil }
    return CGRect(origin: point, size: size)
}
func equalFrame(_ a: CGRect, _ b: CGRect) -> Bool {
    abs(a.minX-b.minX) < 1 && abs(a.minY-b.minY) < 1 && abs(a.width-b.width) < 1 && abs(a.height-b.height) < 1
}
func identity(_ input: [String: Any]) throws -> [String: Any] {
    guard AXIsProcessTrusted() else { return ["error": "POWERPOINT_ACCESSIBILITY_PERMISSION"] }
    guard let document = input["document"] as? String, let url = URL(string: document), url.isFileURL,
          let geometry = input["geometry"] as? [Double], geometry.count == 4, geometry.allSatisfy({ $0.isFinite }),
          geometry[2] > 0, geometry[3] > 0 else { return ["error": "POWERPOINT_SOURCE_MISMATCH"] }
    let requestedFrame = CGRect(x: geometry[0], y: geometry[1], width: geometry[2], height: geometry[3])
    let apps = NSRunningApplication.runningApplications(withBundleIdentifier: "com.microsoft.Powerpoint")
    guard apps.count == 1, let app = apps.first, let launched = app.launchDate?.timeIntervalSince1970,
          let rows = CGWindowListCopyWindowInfo([.optionAll, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]],
          let windows = ax(AXUIElementCreateApplication(app.processIdentifier), kAXWindowsAttribute) as? [AXUIElement] else { return ["error": "POWERPOINT_UNAVAILABLE"] }
    let axWindows = windows.filter { window in
        guard let actual = frame(window), equalFrame(actual, requestedFrame),
              let doc = ax(window, kAXDocumentAttribute) as? String, let docURL = URL(string: doc) else { return false }
        return docURL.standardizedFileURL.resolvingSymlinksInPath() == url.standardizedFileURL.resolvingSymlinksInPath()
    }
    guard axWindows.count == 1 else { return ["error": "POWERPOINT_SOURCE_MISMATCH"] }
    let matches = rows.filter { row in
        guard let pid = row[kCGWindowOwnerPID as String] as? Int32, pid == app.processIdentifier,
              let layer = row[kCGWindowLayer as String] as? Int, layer == 0,
              let info = row[kCGWindowBounds as String] as? NSDictionary, let bounds = CGRect(dictionaryRepresentation: info as CFDictionary) else { return false }
        return equalFrame(bounds, requestedFrame)
    }
    guard matches.count == 1, let number = matches.first?[kCGWindowNumber as String] as? UInt32 else { return ["error": "POWERPOINT_AMBIGUOUS"] }
    let handle = String(number)
    if let selected = input["selectedWindowHandle"] as? String, selected != handle { return ["error": "POWERPOINT_SOURCE_MISMATCH"] }
    let fileValues = try url.resourceValues(forKeys: [.fileResourceIdentifierKey, .volumeIdentifierKey])
    guard let fileID = fileValues.fileResourceIdentifier, let volumeID = fileValues.volumeIdentifier else { return ["error": "POWERPOINT_SOURCE_MISMATCH"] }
    let stable = "powerpoint-v1\n\(app.processIdentifier)\n\(launched)\n\(handle)\n\(url.standardizedFileURL.resolvingSymlinksInPath().absoluteString)\n\(String(describing: volumeID))\n\(String(describing: fileID))"
    let binding = SHA256.hash(data: Data(stable.utf8)).map { String(format: "%02x", $0) }.joined()
    if let expected = input["binding"] as? String, expected != binding { return ["error": "POWERPOINT_STALE"] }
    if let expected = input["windowHandle"] as? String, expected != handle { return ["error": "POWERPOINT_STALE"] }
    if input["operation"] as? String == "goto" {
        let parentPID = getppid()
        guard let page = input["page"] as? Int, page > 0, page <= 2147483647,
              let expires = input["expiresAt"] as? Double, expires.isFinite,
              expires > Date().timeIntervalSince1970 * 1000,
              expires <= Date().timeIntervalSince1970 * 1000 + 3500 else { return ["error": "POWERPOINT_COMMAND"] }
        let axApp = AXUIElementCreateApplication(app.processIdentifier)
        guard NSWorkspace.shared.frontmostApplication?.processIdentifier == app.processIdentifier,
              let current = ax(axApp, kAXFocusedWindowAttribute), CFGetTypeID(current) == AXUIElementGetTypeID(),
              CFEqual(current, axWindows[0]),
              let focused = ax(axApp, kAXFocusedUIElementAttribute), CFGetTypeID(focused) == AXUIElementGetTypeID() else { return ["error": "POWERPOINT_FOREGROUND"] }
        let focus = focused as! AXUIElement
        guard let role = ax(focus, kAXRoleAttribute) as? String,
              ["AXWindow", "AXGroup", "AXLayoutArea", "AXScrollArea"].contains(role),
              let children = ax(axWindows[0], kAXChildrenAttribute) as? [AXUIElement],
              children.count <= 256 else { return ["error": "POWERPOINT_FOREGROUND"] }
        // kAXChildrenAttribute and role/subrole are public AX APIs. Refuse a
        // failed children read, rather than assuming that no sheet exists.
        for child in children {
            guard nonModalMetadata(role: ax(child, kAXRoleAttribute) as? String,
                                   subrole: ax(child, kAXSubroleAttribute) as? String) else { return ["error": "POWERPOINT_FOREGROUND"] }
        }
        var ancestor: AXUIElement? = focus
        var belongs = false
        for _ in 0..<32 {
            guard let node = ancestor else { break }
            guard nonModalMetadata(role: ax(node, kAXRoleAttribute) as? String,
                                   subrole: ax(node, kAXSubroleAttribute) as? String) else { return ["error": "POWERPOINT_FOREGROUND"] }
            if CFEqual(node, axWindows[0]) { belongs = true; break }
            guard let parent = ax(node, kAXParentAttribute), CFGetTypeID(parent) == AXUIElementGetTypeID() else { break }
            ancestor = parent as! AXUIElement
        }
        guard belongs, CGEventSource.flagsState(.combinedSessionState).intersection([.maskCommand, .maskControl, .maskAlternate, .maskShift]).isEmpty else { return ["error": "POWERPOINT_FOREGROUND"] }
        // Microsoft documents digit keys + Return for a live Mac slideshow.
        // Send numeric keypad keycodes to this PID; no US top-row assumption,
        // Unicode paste, global key, activation, editor AppleEvent or restart.
        var events: [CGEvent] = []
        for character in String(page) {
            guard let keyCode = keypadDigit(character),
                  let down = CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: true),
                  let up = CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: false) else { return ["error": "POWERPOINT_UNAVAILABLE"] }
            down.flags = .maskNumericPad; up.flags = .maskNumericPad
            events.append(down); events.append(up)
        }
        guard let enter = CGEvent(keyboardEventSource: nil, virtualKey: CGKeyCode(kVK_Return), keyDown: true),
              let release = CGEvent(keyboardEventSource: nil, virtualKey: CGKeyCode(kVK_Return), keyDown: false),
              expires > Date().timeIntervalSince1970 * 1000,
              NSWorkspace.shared.frontmostApplication?.processIdentifier == app.processIdentifier else { return ["error": "POWERPOINT_COMMAND"] }
        enter.flags = []; release.flags = []
        events.append(enter); events.append(release)
        guard parentPID > 1, getppid() == parentPID, kill(parentPID, 0) == 0 else { return ["error": "POWERPOINT_STALE"] }
        for event in events { event.postToPid(app.processIdentifier) }
        // Main/JXA must confirm the actual resulting page; this is only an
        // input acknowledgement and never claims the requested page was shown.
    }
    return ["windowHandle": handle, "binding": binding]
}
@main
struct PowerPointIdentityMain {
static func main() {
do {
    if CommandLine.arguments.count == 2 && CommandLine.arguments[1] == "--self-test" {
        let expected: [CGKeyCode] = [82, 83, 84, 85, 86, 87, 88, 89, 91, 92]
        guard Array("0123456789").compactMap(keypadDigit) == expected,
              [Character("-"), Character("a"), Character("١"), Character("１")].allSatisfy({ keypadDigit($0) == nil }) else {
            throw CocoaError(.fileReadCorruptFile)
        }
        guard nonModalMetadata(role: "AXGroup", subrole: nil),
              nonModalMetadata(role: "AXWindow", subrole: "AXStandardWindow"),
              !nonModalMetadata(role: nil, subrole: nil),
              !nonModalMetadata(role: "AXSheet", subrole: nil),
              !nonModalMetadata(role: "AXDialog", subrole: nil),
              !nonModalMetadata(role: "AXWindow", subrole: "AXDialog"),
              !nonModalMetadata(role: "AXWindow", subrole: "AXSystemDialog"),
              !nonModalMetadata(role: "AXWindow", subrole: nil) else {
            throw CocoaError(.fileReadCorruptFile)
        }
        FileHandle.standardOutput.write(Data("{\"protocol\":1,\"selfTest\":\"passed\",\"numericKeypadContract\":\"passed\",\"modalFocusContract\":\"passed\",\"osOperationVerified\":false}".utf8))
    } else {
        guard CommandLine.arguments.count == 2, let data = CommandLine.arguments[1].data(using: .utf8), data.count <= 16384,
              let input = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw CocoaError(.fileReadCorruptFile) }
        let result = try identity(input)
        FileHandle.standardOutput.write(try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys]))
        if result["error"] != nil { exit(1) }
    }
} catch {
    FileHandle.standardOutput.write(Data("{\"error\":\"POWERPOINT_UNAVAILABLE\"}".utf8)); exit(1)
}

}
}
