import AppKit
import ApplicationServices
import CryptoKit
import Darwin

// One bounded invocation per operation. No global keyboard event is posted.
// Only Preview PDF windows are supported; another application's UI is not
// guessed from its title or extension.
enum Refusal: String, Error {
    case unavailable = "WINDOW_SLIDES_UNAVAILABLE"
    case stale = "WINDOW_SLIDES_STALE"
    case foreground = "WINDOW_SLIDES_FOREGROUND"
    case command = "WINDOW_SLIDES_COMMAND"
    case permission = "WINDOW_SLIDES_ACCESSIBILITY_PERMISSION"
    case ambiguous = "WINDOW_SLIDES_AMBIGUOUS"
}
func attribute(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
    var result: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element, name as CFString, &result) == .success else { return nil }
    return result
}
func string(_ element: AXUIElement, _ name: String) -> String? { attribute(element, name) as? String }
func element(_ owner: AXUIElement, _ name: String) -> AXUIElement? {
    guard let value = attribute(owner, name), CFGetTypeID(value) == AXUIElementGetTypeID() else { return nil }
    return (value as! AXUIElement)
}
func rect(_ window: AXUIElement) -> CGRect? {
    guard let p = attribute(window, kAXPositionAttribute), let s = attribute(window, kAXSizeAttribute),
          CFGetTypeID(p) == AXValueGetTypeID(), CFGetTypeID(s) == AXValueGetTypeID() else { return nil }
    var point = CGPoint.zero; var size = CGSize.zero
    guard AXValueGetValue(p as! AXValue, .cgPoint, &point), AXValueGetValue(s as! AXValue, .cgSize, &size) else { return nil }
    return CGRect(origin: point, size: size)
}
struct Target {
    let number: UInt32
    let pid: pid_t
    let app: NSRunningApplication
    let window: AXUIElement
    let document: String
    let name: String
    let binding: String
    var json: [String: String] { ["windowHandle": String(number), "binding": binding, "name": name] }
}
func trusted() throws {
    guard AXIsProcessTrusted() else { throw Refusal.permission }
}
func targets() throws -> [Target] {
    try trusted()
    guard let rows = CGWindowListCopyWindowInfo([.optionAll, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else { throw Refusal.unavailable }
    var result: [Target] = []
    for row in rows {
        guard let number = row[kCGWindowNumber as String] as? UInt32,
              let pid = row[kCGWindowOwnerPID as String] as? Int32,
              let layer = row[kCGWindowLayer as String] as? Int, layer == 0,
              let app = NSRunningApplication(processIdentifier: pid), app.bundleIdentifier == "com.apple.Preview",
              let launched = app.launchDate?.timeIntervalSince1970,
              let bounds = row[kCGWindowBounds as String] as? NSDictionary,
              let cgRect = CGRect(dictionaryRepresentation: bounds as CFDictionary), cgRect.width > 0, cgRect.height > 0 else { continue }
        let axApp = AXUIElementCreateApplication(pid)
        guard let windows = attribute(axApp, kAXWindowsAttribute) as? [AXUIElement] else { continue }
        // AX exposes no public window-number attribute. Require a unique exact
        // geometry match within this process; duplicates are never controllable.
        let matched = windows.filter { candidate in
            guard let frame = rect(candidate) else { return false }
            return abs(frame.minX-cgRect.minX) < 1 && abs(frame.minY-cgRect.minY) < 1 && abs(frame.width-cgRect.width) < 1 && abs(frame.height-cgRect.height) < 1
        }
        guard matched.count == 1 else { continue }
        let window = matched[0]
        guard let document = string(window, kAXDocumentAttribute), let url = URL(string: document),
              url.isFileURL, url.pathExtension.lowercased() == "pdf" else { continue }
        let name = url.lastPathComponent
        guard !name.isEmpty else { continue }
        let stable = "preview-v1\n\(pid)\n\(launched)\n\(number)\n\(document)"
        let digest = SHA256.hash(data: Data(stable.utf8)).map { String(format: "%02x", $0) }.joined()
        result.append(Target(number: number, pid: pid, app: app, window: window, document: document, name: name, binding: digest))
    }
    return result
}
func bound(_ args: [String]) throws -> Target {
    guard args.count >= 3, let id = UInt32(args[1]), id > 0, args[2].count == 64,
          args[2].allSatisfy({ "0123456789abcdef".contains($0) }) else { throw Refusal.command }
    let matches = try targets().filter { $0.number == id && $0.binding == args[2] }
    guard matches.count == 1 else { throw Refusal.stale }
    return matches[0]
}
func focusedPDF(_ target: Target) throws {
    guard NSWorkspace.shared.frontmostApplication?.processIdentifier == target.pid else { throw Refusal.foreground }
    let axApp = AXUIElementCreateApplication(target.pid)
    guard let focusedWindow = element(axApp, kAXFocusedWindowAttribute), CFEqual(focusedWindow, target.window),
          string(focusedWindow, kAXDocumentAttribute) == target.document,
          let focused = element(axApp, kAXFocusedUIElementAttribute),
          let role = string(focused, kAXRoleAttribute), ["AXScrollArea", "AXLayoutArea"].contains(role) else { throw Refusal.foreground }
    // Text fields, search boxes, sidebars, thumbnails and dialogs are refused.
    var parent: AXUIElement? = focused
    for _ in 0..<32 {
        guard let node = parent else { break }
        if CFEqual(node, target.window) { return }
        parent = element(node, kAXParentAttribute)
    }
    throw Refusal.foreground
}
func run(_ args: [String]) throws -> Any {
    guard let operation = args.first else { throw Refusal.command }
    if operation == "--self-test" {
        guard UInt32("4294967296") == nil, URL(string: "file:///tmp/a.pdf")?.pathExtension == "pdf" else { throw Refusal.command }
        return ["protocol": 1, "selfTest": "passed", "osOperationVerified": false] as [String: Any]
    }
    if operation == "list" { guard args.count == 1 else { throw Refusal.command }; return Array(try targets().prefix(64)).map(\.json) }
    let target = try bound(args)
    if operation == "status" { guard args.count == 3 else { throw Refusal.command }; return target.json }
    if operation == "activate" {
        guard args.count == 3 else { throw Refusal.command }
        guard target.app.activate(options: [.activateIgnoringOtherApps]) else { throw Refusal.unavailable }
        guard AXUIElementPerformAction(target.window, kAXRaiseAction as CFString) == .success else { throw Refusal.unavailable }
        return try bound(args).json
    }
    guard operation == "step", args.count == 5, ["next", "previous"].contains(args[3]),
          let deadline = Double(args[4]), deadline.isFinite,
          deadline > Date().timeIntervalSince1970 * 1000,
          deadline <= Date().timeIntervalSince1970 * 1000 + 3500 else { throw Refusal.command }
    try focusedPDF(target)
    // A second identity/focus/deadline check immediately precedes the bounded
    // pair of process-targeted events. There is no foreground stealing here.
    let verified = try bound(args)
    try focusedPDF(verified)
    guard deadline > Date().timeIntervalSince1970 * 1000 else { throw Refusal.command }
    let code: CGKeyCode = args[3] == "next" ? 121 : 116
    guard let down = CGEvent(keyboardEventSource: nil, virtualKey: code, keyDown: true),
          let up = CGEvent(keyboardEventSource: nil, virtualKey: code, keyDown: false) else { throw Refusal.unavailable }
    down.postToPid(verified.pid); up.postToPid(verified.pid)
    return try bound(args).json
}
@main
struct WindowSlidesMain {
static func main() {
do {
    let value = try run(Array(CommandLine.arguments.dropFirst()))
    let data = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
    FileHandle.standardOutput.write(data)
} catch {
    let code = (error as? Refusal)?.rawValue ?? Refusal.unavailable.rawValue
    FileHandle.standardOutput.write(try! JSONSerialization.data(withJSONObject: ["error": code]))
    exit(1)
}

}
}
