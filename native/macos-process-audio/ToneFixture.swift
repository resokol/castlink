import Foundation
import AppKit
import AVFoundation
import CoreAudio
import Darwin

// QA only: a real application rendering a known tone through the normal output
// device. This is not a capture implementation or a replacement for Office QA.
private func appendLE<T: FixedWidthInteger>(_ value: T, to data: inout Data) {
    var value = value.littleEndian
    withUnsafeBytes(of: &value) { data.append(contentsOf: $0) }
}
private func fixtureDiagnostic(_ value: String) { fputs(value + "\n", stderr); fflush(stderr) }
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
// Passive metadata for this owned fixture PID only. Unsupported HAL properties
// remain diagnostic return codes; they never change playback/capture acceptance.
@available(macOS 14.2, *)
private func ownedAudioIdentity() -> [String: Any] {
    let requestedPID = getpid()
    var qualifierPID = requestedPID
    var processObject: AudioObjectID = kAudioObjectUnknown
    var size = UInt32(MemoryLayout<AudioObjectID>.size)
    var address = AudioObjectPropertyAddress(mSelector: kAudioHardwarePropertyTranslatePIDToProcessObject,
        mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
    let status = AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &address,
        UInt32(MemoryLayout<pid_t>.size), &qualifierPID, &size, &processObject)
    var result: [String: Any] = ["requestedPID": requestedPID, "translateStatus": status, "processObject": processObject,
        "available": status == noErr && processObject != kAudioObjectUnknown && size == UInt32(MemoryLayout<AudioObjectID>.size)]
    guard status == noErr, processObject != kAudioObjectUnknown, size == UInt32(MemoryLayout<AudioObjectID>.size) else { return result }
    func readInteger(_ selector: AudioObjectPropertySelector) -> (OSStatus, UInt32, UInt32) {
        var value: UInt32 = 0, size = UInt32(MemoryLayout<UInt32>.size)
        var property = AudioObjectPropertyAddress(mSelector: selector, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
        let status = AudioObjectGetPropertyData(processObject, &property, 0, nil, &size, &value)
        return (status, value, size)
    }
    let (pidStatus, audioPID, pidSize) = readInteger(kAudioProcessPropertyPID)
    result["pidStatus"] = pidStatus
    if pidStatus == noErr && pidSize == UInt32(MemoryLayout<pid_t>.size) { result["audioPID"] = Int32(bitPattern: audioPID) }
    let (outputStatus, running, outputSize) = readInteger(kAudioProcessPropertyIsRunningOutput)
    result["outputStatus"] = outputStatus
    if outputStatus == noErr && outputSize == UInt32(MemoryLayout<UInt32>.size) { result["runningOutput"] = running != 0 }
    var bundle: Unmanaged<CFString>?
    var bundleSize = UInt32(MemoryLayout<Unmanaged<CFString>?>.size)
    address.mSelector = kAudioProcessPropertyBundleID
    let bundleStatus = AudioObjectGetPropertyData(processObject, &address, 0, nil, &bundleSize, &bundle)
    result["bundleStatus"] = bundleStatus
    if bundleStatus == noErr, bundleSize == UInt32(MemoryLayout<Unmanaged<CFString>?>.size), let bundle {
        let value = bundle.takeRetainedValue() as String
        result["bundleID"] = String(value.prefix(160)).replacingOccurrences(of: "[^A-Za-z0-9._-]", with: "?", options: .regularExpression)
    }
    return result
}
private final class FixtureDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    var window: NSWindow?
    var player: AVAudioPlayer?
    func applicationDidFinishLaunching(_ notification: Notification) {
        do {
            let args = Array(CommandLine.arguments.dropFirst())
            guard args.count == 1, let frequency = Int(args[0]), [440, 880, 1320].contains(frequency) else { Darwin.exit(2) }
            fixtureDiagnostic("qa-stage:application-ready")
            let engine = AVAudioEngine()
            fixtureDiagnostic("qa-stage:output-format")
            let outputFormat = engine.outputNode.outputFormat(forBus: 0)
            guard outputFormat.sampleRate > 0, outputFormat.channelCount > 0 else { fixtureDiagnostic("qa-no-output"); Darwin.exit(3) }
            fixtureDiagnostic("qa-stage:player-create")
            let rendered = try AVAudioPlayer(data: wave(frequency: Double(frequency)))
            rendered.numberOfLoops = -1; rendered.volume = 1
            fixtureDiagnostic("qa-stage:player-prepare")
            guard rendered.prepareToPlay() else { throw NSError(domain: "qa-player-prepare", code: 1) }
            fixtureDiagnostic("qa-stage:player-start")
            guard rendered.play() else { throw NSError(domain: "qa-player-start", code: 1) }
            fixtureDiagnostic("qa-stage:window-create")
            player = rendered
            let ownWindow = NSWindow(contentRect: NSRect(x: CGFloat(80 + frequency / 10), y: 80, width: 420, height: 130),
                styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
            ownWindow.title = "CastLink owned audio QA \(frequency) Hz"
            ownWindow.delegate = self; ownWindow.isReleasedWhenClosed = false
            let label = NSTextField(labelWithString: "Owned rendered tone: \(frequency) Hz\nNative audio filter QA; not Microsoft Office")
            label.frame = NSRect(x: 20, y: 25, width: 380, height: 65); ownWindow.contentView?.addSubview(label)
            ownWindow.makeKeyAndOrderFront(nil); window = ownWindow
            NSApplication.shared.activate(ignoringOtherApps: true)
            fixtureDiagnostic("qa-stage:launch-identity")
            guard let started = processBirthMilliseconds(getpid()) else { fixtureDiagnostic("qa-refused:kernel-process-birth"); Darwin.exit(4) }
            var ready: [String: Any] = ["ready": true, "windowId": String(ownWindow.windowNumber), "pid": getpid(),
                "processStartTime": started, "frequency": frequency, "outputSampleRate": outputFormat.sampleRate,
                "outputChannels": outputFormat.channelCount, "playerDuration": rendered.duration, "playerPlaying": rendered.isPlaying,
                "launchServicesLaunchDateAvailable": NSRunningApplication.current.launchDate != nil]
            if #available(macOS 14.2, *) { ready["audioIdentity"] = ownedAudioIdentity() }
            else { ready["audioIdentity"] = ["available": false, "reason": "macos-before-14.2"] }
            FileHandle.standardOutput.write(try JSONSerialization.data(withJSONObject: ready, options: [.sortedKeys]))
            FileHandle.standardOutput.write(Data([10]))
        } catch {
            let native = error as NSError
            let domain = String(native.domain.prefix(80)).replacingOccurrences(of: "[^A-Za-z0-9._-]", with: "?", options: .regularExpression)
            fixtureDiagnostic("qa-error:\(domain):\(native.code)"); Darwin.exit(4)
        }
    }
    func windowWillClose(_ notification: Notification) { player?.stop(); NSApplication.shared.terminate(nil) }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}
// Cleanup for the exact app launched by this QA binary. No name/bundle lookup,
// wildcard kill, unrelated application, or PID-only termination is permitted.
private func terminateFixtureApplication(_ app: NSRunningApplication, expectedBirth: Int64, expectedURL: URL) -> Int32 {
    let pid = app.processIdentifier
    guard processBirthMilliseconds(pid) == expectedBirth, let bundleURL = app.bundleURL,
          let executableURL = app.executableURL, let ownExecutable = Bundle.main.executableURL,
          bundleURL.standardizedFileURL.resolvingSymlinksInPath() == expectedURL,
          expectedURL == Bundle.main.bundleURL.standardizedFileURL.resolvingSymlinksInPath(),
          executableURL.standardizedFileURL.resolvingSymlinksInPath() == ownExecutable.standardizedFileURL.resolvingSymlinksInPath(),
          ["com.microsoft.Powerpoint", "org.castlink.qa.private-return", "org.castlink.qa.other-rendered"].contains(app.bundleIdentifier ?? "") else { return 4 }
    if app.isTerminated { return 0 }
    if app.terminate() {
        for _ in 0..<50 {
            if app.isTerminated || processBirthMilliseconds(pid) == nil { return 0 }
            usleep(20_000)
        }
    }
    guard processBirthMilliseconds(pid) == expectedBirth, !app.isTerminated else { return 0 }
    return app.forceTerminate() ? 0 : 4
}
private func terminateOwnedFixture(_ args: [String]) -> Int32 {
    if args.first == "--terminate-owned-url" {
        guard args.count == 2 else { return 2 }
        let expected = URL(fileURLWithPath: args[1]).standardizedFileURL.resolvingSymlinksInPath()
        guard expected == Bundle.main.bundleURL.standardizedFileURL.resolvingSymlinksInPath() else { return 4 }
        // Covers a fixture that hung before it could emit readiness. This scans
        // only an exact private app URL and snapshots each retained app's birth.
        for app in NSWorkspace.shared.runningApplications where app.processIdentifier != getpid() && app.bundleURL?.standardizedFileURL.resolvingSymlinksInPath() == expected {
            guard let birth = processBirthMilliseconds(app.processIdentifier) else { continue }
            let result = terminateFixtureApplication(app, expectedBirth: birth, expectedURL: expected)
            if result != 0 { return result }
        }
        return 0
    }
    guard args.count == 4, let pid = Int32(args[1]), pid > 0, let expectedBirth = Int64(args[2]), expectedBirth > 0 else { return 2 }
    guard processBirthMilliseconds(pid) != nil else { return 0 }
    guard let app = NSRunningApplication(processIdentifier: pid) else { return 0 }
    return terminateFixtureApplication(app, expectedBirth: expectedBirth,
        expectedURL: URL(fileURLWithPath: args[3]).standardizedFileURL.resolvingSymlinksInPath())
}

@main
private struct ToneFixtureMain {
    static func main() {
        let args = Array(CommandLine.arguments.dropFirst())
        if args.first == "--terminate" || args.first == "--terminate-owned-url" { Darwin.exit(terminateOwnedFixture(args)) }
        let application = NSApplication.shared
        let delegate = FixtureDelegate()
        application.setActivationPolicy(.regular); application.delegate = delegate
        withExtendedLifetime(delegate) { application.run() }
    }
}
