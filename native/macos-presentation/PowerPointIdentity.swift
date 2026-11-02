import AppKit
import ApplicationServices
import CryptoKit

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
              (ax(axWindows[0], kAXSheetsAttribute) as? [AXUIElement] ?? []).isEmpty else { return ["error": "POWERPOINT_FOREGROUND"] }
        var ancestor: AXUIElement? = focus
        var belongs = false
        for _ in 0..<32 {
            guard let node = ancestor else { break }
            if CFEqual(node, axWindows[0]) { belongs = true; break }
            guard let parent = ax(node, kAXParentAttribute), CFGetTypeID(parent) == AXUIElementGetTypeID() else { break }
            ancestor = parent as! AXUIElement
        }
        guard belongs, CGEventSource.flagsState(.combinedSessionState).intersection([.maskCommand, .maskControl, .maskAlternate, .maskShift]).isEmpty else { return ["error": "POWERPOINT_FOREGROUND"] }
        // Microsoft documents digit keys + Return for a live Mac slideshow.
        // Send physical digit keycodes to this PID; no Unicode paste, global
        // key, activation, editor-only AppleEvent or show restart is used.
        let digits: [CGKeyCode] = [29, 18, 19, 20, 21, 23, 22, 26, 28, 25]
        var events: [CGEvent] = []
        for character in String(page) {
            guard let digit = character.wholeNumberValue,
                  let down = CGEvent(keyboardEventSource: nil, virtualKey: digits[digit], keyDown: true),
                  let up = CGEvent(keyboardEventSource: nil, virtualKey: digits[digit], keyDown: false) else { return ["error": "POWERPOINT_UNAVAILABLE"] }
            events.append(down); events.append(up)
        }
        guard let enter = CGEvent(keyboardEventSource: nil, virtualKey: 36, keyDown: true),
              let release = CGEvent(keyboardEventSource: nil, virtualKey: 36, keyDown: false),
              expires > Date().timeIntervalSince1970 * 1000,
              NSWorkspace.shared.frontmostApplication?.processIdentifier == app.processIdentifier else { return ["error": "POWERPOINT_COMMAND"] }
        events.append(enter); events.append(release)
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
        FileHandle.standardOutput.write(Data("{\"protocol\":1,\"selfTest\":\"passed\",\"osOperationVerified\":false}".utf8))
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
