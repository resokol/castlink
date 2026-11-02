import Foundation
import AppKit
import CoreGraphics
import ScreenCaptureKit
import ApplicationServices

// This is an isolated test application, never linked into the production helper.
// It reports only synthetic fixture events; it does not monitor other apps.
final class FixtureWindow: NSWindow { override var canBecomeKey: Bool { true }; override var canBecomeMain: Bool { true } }
final class FixtureView: NSView {
    override var isFlipped: Bool { true }
    override var acceptsFirstResponder: Bool { true }
    override func draw(_ dirtyRect: NSRect) {
        NSColor(srgbRed: 1, green: 1, blue: 1, alpha: 1).setFill(); bounds.fill()
        // Generic AppKit primaries/deviceRGB are display-profile dependent. Paint
        // and measure in the same explicit sRGB space for a reproducible marker test.
        let colors: [NSColor] = [
            NSColor(srgbRed: 1, green: 0, blue: 0, alpha: 1),
            NSColor(srgbRed: 0, green: 1, blue: 0, alpha: 1),
            NSColor(srgbRed: 0, green: 0, blue: 1, alpha: 1),
            NSColor(srgbRed: 1, green: 1, blue: 0, alpha: 1)
        ]
        let positions = [NSPoint(x: 0, y: 0), NSPoint(x: bounds.width - 80, y: 0), NSPoint(x: 0, y: bounds.height - 80), NSPoint(x: bounds.width - 80, y: bounds.height - 80)]
        for (index, point) in positions.enumerated() {
            colors[index].setFill(); NSRect(origin: point, size: NSSize(width: 80, height: 80)).fill()
            // Unique two-bit corner IDs: 00, 01, 10, 11. Black/white endpoints
            // establish geometry without assuming a display's primary conversion.
            for cell in 0..<2 {
                let level: CGFloat = ((index >> (1 - cell)) & 1) == 0 ? 0 : 1
                NSColor(srgbRed: level, green: level, blue: level, alpha: 1).setFill()
                NSRect(x: point.x + CGFloat(cell == 0 ? 12 : 36), y: point.y + 12, width: 16, height: 16).fill()
            }
        }
    }
    private func emit(_ kind: String, _ event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        var value: [String: Any] = ["event":kind,"x":point.x,"y":point.y,"flags":event.modifierFlags.rawValue]
        if [.keyDown,.keyUp,.flagsChanged].contains(event.type) { value["keyCode"] = event.keyCode; if event.type != .flagsChanged { value["characters"] = event.characters ?? "" } }
        if [.leftMouseDown,.leftMouseUp,.rightMouseDown,.rightMouseUp,.otherMouseDown,.otherMouseUp].contains(event.type) { value["clickCount"] = event.clickCount }
        NativeFixture.emit(value)
    }
    override func mouseDown(with event: NSEvent) { emit("mouseDown", event) }
    override func mouseUp(with event: NSEvent) { emit("mouseUp", event) }
    override func rightMouseDown(with event: NSEvent) { emit("rightMouseDown", event) }
    override func rightMouseUp(with event: NSEvent) { emit("rightMouseUp", event) }
    override func otherMouseDown(with event: NSEvent) { emit("otherMouseDown", event) }
    override func otherMouseUp(with event: NSEvent) { emit("otherMouseUp", event) }
    override func mouseDragged(with event: NSEvent) { emit("mouseDragged", event) }
    override func keyDown(with event: NSEvent) { emit("keyDown", event) }
    override func keyUp(with event: NSEvent) { emit("keyUp", event) }
    override func flagsChanged(with event: NSEvent) { emit("flagsChanged", event) }
    override func scrollWheel(with event: NSEvent) { NativeFixture.emit(["event":"wheel","deltaX":event.scrollingDeltaX,"deltaY":event.scrollingDeltaY]) }
}
@main enum NativeFixture {
    static var window: FixtureWindow!
    static var occluder: NSWindow?
    static var screenshotPath: String?
    static func emit(_ value: [String: Any]) {
        if let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]) { FileHandle.standardOutput.write(data); FileHandle.standardOutput.write(Data([10])) }
    }
    static func ready(_ id: Any = 0) {
        let number = CGWindowID(window.windowNumber)
        let info = (CGWindowListCopyWindowInfo(.optionIncludingWindow, number) as? [[String: Any]])?.first { ($0[kCGWindowNumber as String] as? NSNumber)?.uint32Value == number }
        let bounds = info?[kCGWindowBounds as String] as? [String: Any] ?? [:]
        emit(["event":"ready","id":id,"windowId":String(number),"pid":ProcessInfo.processInfo.processIdentifier,"rect":bounds,"width":Int(window.frame.width * window.backingScaleFactor),"height":Int(window.frame.height * window.backingScaleFactor),"scale":window.backingScaleFactor,"screenPermission":CGPreflightScreenCaptureAccess(),"accessibilityPermission":AXIsProcessTrusted(),"inputMonitoringPermission":CGPreflightListenEventAccess(),"fixtureIdentity":["launchDateAvailable":NSRunningApplication.current.launchDate != nil,"kernelBirthAvailable":processBirthMilliseconds(ProcessInfo.processInfo.processIdentifier) != nil,"cgWindowFound":info != nil,"cgOwnerMatchesFixture":(info?[kCGWindowOwnerPID as String] as? NSNumber)?.int32Value == ProcessInfo.processInfo.processIdentifier,"cgLayer":info?[kCGWindowLayer as String] as? Int ?? -1,"active":NSApp.isActive,"keyWindow":window.isKeyWindow,"finishedLaunching":NSRunningApplication.current.isFinishedLaunching]])
    }
    @available(macOS 14.2, *)
    @MainActor static func screenshot(_ id: Any) async {
        guard CGPreflightScreenCaptureAccess() else { emit(["id":id,"event":"screenshot","verified":false,"reason":"screen-permission"]); return }
        do {
            let content = try await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: true)
            guard let selected = content.windows.first(where: { $0.windowID == CGWindowID(window.windowNumber) }) else { throw InputFailure("fixture-window-unavailable") }
            let filter = SCContentFilter(desktopIndependentWindow: selected), config = SCStreamConfiguration()
            config.width = Int(window.frame.width * window.backingScaleFactor); config.height = Int(window.frame.height * window.backingScaleFactor)
            config.ignoreShadowsSingleWindow = true; config.showsCursor = false; config.colorSpaceName = CGColorSpace.sRGB
            let image = try await SCScreenshotManager.captureImage(contentFilter: filter, configuration: config)
            let representation = NSBitmapImageRep(cgImage: image)
            if let path = screenshotPath, let data = representation.representation(using: .png, properties: [:]) { try data.write(to: URL(fileURLWithPath: path)) }
            let scaleX = Double(image.width) / Double(window.frame.width), scaleY = Double(image.height) / Double(window.frame.height)
            let names = ["top-left","top-right","bottom-left","bottom-right"]
            let fiducials = names.enumerated().map { (index, name) -> [String: Any] in
                let right = index % 2 == 1, bottom = index >= 2
                let y = Int((bottom ? Double(image.height) - 60 * scaleY : 20 * scaleY).rounded())
                let pixels = [20.0,44.0].map { offset -> [Int] in [Int((right ? Double(image.width) - (80 - offset) * scaleX : offset * scaleX).rounded()), y] }
                let samples = pixels.map { pixel -> [Double] in
                    guard let color = representation.colorAt(x: pixel[0], y: pixel[1])?.usingColorSpace(.sRGB) else { return [] }
                    return [color.redComponent,color.greenComponent,color.blueComponent]
                }
                return ["corner":name,"pixels":pixels,"samples":samples]
            }
            emit(["id":id,"event":"screenshot","verified":true,"width":image.width,"height":image.height,"sampleColorSpace":"sRGB","markerScheme":"castlink-binary-corners-v1","fiducials":fiducials])
        } catch { emit(["id":id,"event":"screenshot","verified":false,"reason":"capture-failed"]) }
    }
    static func main() {
        guard let session = CGSessionCopyCurrentDictionary() as? [String: Any], session[kCGSessionOnConsoleKey as String] as? Bool == true else { emit(["event":"unavailable","reason":"console-session-unavailable"]); return }
        _ = NSApplication.shared; NSApp.setActivationPolicy(.regular)
        screenshotPath = CommandLine.arguments.dropFirst().first
        window = FixtureWindow(contentRect: NSRect(x: 100, y: 180, width: 640, height: 480), styleMask: [.borderless], backing: .buffered, defer: false)
        window.colorSpace = .sRGB
        window.title = "CastLink Native Input Fixture"; window.backgroundColor = .white; window.contentView = FixtureView(frame: NSRect(x: 0, y: 0, width: 640, height: 480)); window.makeKeyAndOrderFront(nil); window.makeFirstResponder(window.contentView); NSApp.activate(ignoringOtherApps: true)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { ready() }
        DispatchQueue(label: "fixture.stdin").async {
            while let line = readLine() {
                guard line.utf8.count <= 4096, let data = line.data(using: .utf8), let command = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { continue }
                DispatchQueue.main.async {
                    let id = command["id"] ?? 0
                    switch command["op"] as? String {
                    case "move": window.setFrameOrigin(NSPoint(x: window.frame.origin.x + 25, y: window.frame.origin.y + 15)); ready(id)
                    case "resize": window.setContentSize(NSSize(width: 700, height: 500)); ready(id)
                    case "occlude":
                        occluder = FixtureWindow(contentRect: window.frame, styleMask: [.borderless], backing: .buffered, defer: false); occluder?.backgroundColor = .black; occluder?.level = .floating; occluder?.makeKeyAndOrderFront(nil); emit(["event":"occluded","id":id])
                    case "focus": occluder?.orderOut(nil); occluder = nil; window.makeKeyAndOrderFront(nil); window.makeFirstResponder(window.contentView); NSApp.activate(ignoringOtherApps: true); ready(id)
                    case "capture":
                        if #available(macOS 14.2, *) { Task { await screenshot(id) } }
                        else { emit(["id":id,"event":"screenshot","verified":false,"reason":"capture-requires-macOS-14.2"]) }
                    case "quit": NSApp.terminate(nil)
                    default: break
                    }
                }
            }
            DispatchQueue.main.async { NSApp.terminate(nil) }
        }
        NSApp.run()
    }
}
