import Foundation
import AppKit
import AVFoundation
import Darwin

// QA only: a real application rendering a known tone through the normal output
// device. This is not a capture implementation or a replacement for Office QA.
private func appendLE<T: FixedWidthInteger>(_ value: T, to data: inout Data) {
    var value = value.littleEndian
    withUnsafeBytes(of: &value) { data.append(contentsOf: $0) }
}
private func wave(frequency: Double) -> Data {
    let frames = 48000, bytes = frames * 4
    var data = Data("RIFF".utf8)
    appendLE(UInt32(36 + bytes), to: &data); data.append(Data("WAVEfmt ".utf8))
    appendLE(UInt32(16), to: &data); appendLE(UInt16(1), to: &data); appendLE(UInt16(2), to: &data)
    appendLE(UInt32(48000), to: &data); appendLE(UInt32(192000), to: &data)
    appendLE(UInt16(4), to: &data); appendLE(UInt16(16), to: &data)
    data.append(Data("data".utf8)); appendLE(UInt32(bytes), to: &data)
    for frame in 0..<frames {
        let value = Int16((3000 * sin(2 * Double.pi * frequency * Double(frame) / 48000)).rounded())
        appendLE(value, to: &data); appendLE(value, to: &data)
    }
    return data
}
private final class FixtureDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    var window: NSWindow?
    var player: AVAudioPlayer?
    func applicationDidFinishLaunching(_ notification: Notification) {
        do {
            let args = Array(CommandLine.arguments.dropFirst())
            guard args.count == 1, let frequency = Int(args[0]), [440, 880, 1320].contains(frequency) else { Darwin.exit(2) }
            let engine = AVAudioEngine()
            guard engine.outputNode.outputFormat(forBus: 0).sampleRate > 0 else { throw NSError(domain: "qa-no-output", code: 1) }
            let rendered = try AVAudioPlayer(data: wave(frequency: Double(frequency)))
            rendered.numberOfLoops = -1; rendered.volume = 1
            guard rendered.prepareToPlay(), rendered.play() else { throw NSError(domain: "qa-no-output", code: 1) }
            player = rendered
            let ownWindow = NSWindow(contentRect: NSRect(x: CGFloat(80 + frequency / 10), y: 80, width: 420, height: 130),
                styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
            ownWindow.title = "CastLink owned audio QA \(frequency) Hz"
            ownWindow.delegate = self; ownWindow.isReleasedWhenClosed = false
            let label = NSTextField(labelWithString: "Owned rendered tone: \(frequency) Hz\nNative audio filter QA; not Microsoft Office")
            label.frame = NSRect(x: 20, y: 25, width: 380, height: 65); ownWindow.contentView?.addSubview(label)
            ownWindow.makeKeyAndOrderFront(nil); window = ownWindow
            NSApplication.shared.activate(ignoringOtherApps: true)
            guard let launch = NSRunningApplication.current.launchDate else { Darwin.exit(4) }
            let started = Int64((launch.timeIntervalSince1970 * 1000).rounded())
            print("{\"ready\":true,\"windowId\":\"\(ownWindow.windowNumber)\",\"pid\":\(getpid()),\"processStartTime\":\(started),\"frequency\":\(frequency)}")
            fflush(stdout)
        } catch {
            fputs("qa-no-output\n", stderr); Darwin.exit(3)
        }
    }
    func windowWillClose(_ notification: Notification) { player?.stop(); NSApplication.shared.terminate(nil) }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}
@main
private struct ToneFixtureMain {
    static func main() {
        let application = NSApplication.shared
        let delegate = FixtureDelegate()
        application.setActivationPolicy(.regular); application.delegate = delegate
        withExtendedLifetime(delegate) { application.run() }
    }
}
