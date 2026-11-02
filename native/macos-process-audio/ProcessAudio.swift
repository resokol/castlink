import Foundation
import AppKit
import ScreenCaptureKit
import CoreMedia
import CoreAudio
import Darwin

// Stdout is exclusively CLPA0001 PCM. No system/microphone capture fallback.
private let maxPacketFrames = 4800
private let maxBufferBytes = 131072
private let powerPointBundleID = "com.microsoft.Powerpoint"
private enum Refusal: Error { case source, launchSource, format, capture, output }

private func appendLE<T: FixedWidthInteger>(_ value: T, to data: inout Data) {
    var little = value.littleEndian
    withUnsafeBytes(of: &little) { data.append(contentsOf: $0) }
}
private func audioHeader(pid: pid_t) -> Data {
    var data = Data("CLPA0001".utf8)
    appendLE(UInt32(48000), to: &data)
    appendLE(UInt16(2), to: &data)
    appendLE(UInt16(32), to: &data)
    appendLE(UInt32(pid), to: &data)
    appendLE(UInt32(0), to: &data)
    return data
}
private func diagnostic(_ code: String) {
    // Only internal fixed codes are ever passed here; never stringify OS errors.
    let data = Data(("process-audio-refused:" + code + "\n").utf8)
    data.withUnsafeBytes { bytes in
        if let base = bytes.baseAddress { _ = Darwin.write(STDERR_FILENO, base, bytes.count) }
    }
}
private func decimal(_ raw: String, maximum: UInt64) -> UInt64? {
    guard !raw.isEmpty, raw.first != "0", raw.utf8.allSatisfy({ $0 >= 48 && $0 <= 57 }),
          let number = UInt64(raw), number <= maximum else { return nil }
    return number
}
private struct WindowIdentity {
    let windowID: CGWindowID
    let pid: pid_t
    let started: Int64
    let launched: Date
    // Retain the original application, rather than continually choosing a new PID.
    let application: NSRunningApplication

    static func bind(windowID: CGWindowID, expectedPID: pid_t?, expectedStart: Int64?) throws -> WindowIdentity {
        guard let windows = CGWindowListCopyWindowInfo([.optionIncludingWindow, .excludeDesktopElements], windowID) as? [[String: Any]],
              let info = windows.first(where: { ($0[kCGWindowNumber as String] as? NSNumber)?.uint32Value == windowID }),
              let owner = info[kCGWindowOwnerPID as String] as? NSNumber,
              owner.int32Value > 0, owner.int32Value != getpid(), owner.int32Value != getppid(),
              let application = NSRunningApplication(processIdentifier: owner.int32Value),
              !application.isTerminated, application.bundleIdentifier == powerPointBundleID,
              let started = processBirthMilliseconds(owner.int32Value) else { throw Refusal.source }
        guard let launched = application.launchDate, launched.timeIntervalSince1970.isFinite, launched.timeIntervalSince1970 > 0 else { throw Refusal.launchSource }
        guard expectedPID == nil || expectedPID == owner.int32Value,
              expectedStart == nil || expectedStart == started else { throw Refusal.source }
        let result = WindowIdentity(windowID: windowID, pid: owner.int32Value, started: started, launched: launched, application: application)
        guard result.isLive() else { throw Refusal.source }
        return result
    }
    func isLive() -> Bool {
        guard !application.isTerminated, application.processIdentifier == pid,
              application.bundleIdentifier == powerPointBundleID, application.launchDate == launched,
              let current = NSRunningApplication(processIdentifier: pid), !current.isTerminated,
              current.bundleIdentifier == powerPointBundleID, current.launchDate == launched, processBirthMilliseconds(pid) == started,
              let windows = CGWindowListCopyWindowInfo([.optionIncludingWindow, .excludeDesktopElements], windowID) as? [[String: Any]] else { return false }
        return windows.contains { info in
            (info[kCGWindowNumber as String] as? NSNumber)?.uint32Value == windowID &&
            (info[kCGWindowOwnerPID as String] as? NSNumber)?.int32Value == pid
        }
    }
}

@available(macOS 13.0, *)
private final class AudioCapture: NSObject, SCStreamOutput, SCStreamDelegate {
    private let identity: WindowIdentity
    private let queue = DispatchQueue(label: "org.castlink.process-audio", qos: .userInitiated)
    private var stream: SCStream?
    private var boundWindow: SCWindow?
    private var stopped = false
    private var started = false
    private var output = Data()
    private var blockedSince: UInt64?
    private var writeSource: DispatchSourceWrite?
    private var writeSuspended = true
    private var stdinSource: DispatchSourceRead?
    private var timer: DispatchSourceTimer?
    private var signals: [DispatchSourceSignal] = []
    private let parentPID = getppid()

    init(identity: WindowIdentity) { self.identity = identity; super.init() }

    func run() {
        queue.async { [self] in
            guard identity.isLive(), CGPreflightScreenCaptureAccess() else { stop(code: 4, reason: "source-or-permission"); return }
            guard fcntl(STDOUT_FILENO, F_SETFL, fcntl(STDOUT_FILENO, F_GETFL) | O_NONBLOCK) != -1,
                  fcntl(STDIN_FILENO, F_SETFL, fcntl(STDIN_FILENO, F_GETFL) | O_NONBLOCK) != -1 else { stop(code: 4, reason: "pipe"); return }
            let writer = DispatchSource.makeWriteSource(fileDescriptor: STDOUT_FILENO, queue: queue)
            writer.setEventHandler { [weak self] in self?.flush() }; writeSource = writer
            let reader = DispatchSource.makeReadSource(fileDescriptor: STDIN_FILENO, queue: queue)
            reader.setEventHandler { [weak self] in
                guard let self else { return }
                var byte: UInt8 = 0
                let result = Darwin.read(STDIN_FILENO, &byte, 1)
                if result >= 0 { self.stop(code: 0) }
                else if errno != EAGAIN && errno != EINTR { self.stop(code: 4, reason: "pipe") }
            }
            stdinSource = reader; reader.resume()
            for signalNumber in [SIGTERM, SIGINT] {
                signal(signalNumber, SIG_IGN)
                let source = DispatchSource.makeSignalSource(signal: signalNumber, queue: queue)
                source.setEventHandler { [weak self] in self?.stop(code: 0) }; source.resume(); signals.append(source)
            }
            let watchdog = DispatchSource.makeTimerSource(queue: queue)
            watchdog.schedule(deadline: .now(), repeating: .milliseconds(50))
            watchdog.setEventHandler { [weak self] in
                guard let self, !self.stopped else { return }
                guard getppid() == self.parentPID, self.identity.isLive(), CGPreflightScreenCaptureAccess() else {
                    self.stop(code: 4, reason: "source-or-permission"); return
                }
                if let blocked = self.blockedSince, DispatchTime.now().uptimeNanoseconds - blocked > 1_000_000_000 {
                    self.stop(code: 4, reason: "backpressure")
                }
            }
            timer = watchdog; watchdog.resume()
            Task { await self.startStream() }
        }
    }

    private func startStream() async {
        do {
            let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)
            guard identity.isLive(),
                  let window = content.windows.first(where: { $0.windowID == identity.windowID }),
                  let owner = window.owningApplication, owner.processID == identity.pid,
                  owner.bundleIdentifier == powerPointBundleID else { throw Refusal.source }
            // A display filter's application inclusion limits images but did not
            // isolate audio in native three-process testing. SCK single-window
            // capture scopes audio to that window's owning application and keeps
            // the selected SCWindow as the intrinsic capture target.
            let filter = SCContentFilter(desktopIndependentWindow: window)
            let configuration = SCStreamConfiguration()
            configuration.capturesAudio = true
            configuration.excludesCurrentProcessAudio = true
            configuration.sampleRate = 48000
            configuration.channelCount = 2
            configuration.width = 2
            configuration.height = 2
            configuration.minimumFrameInterval = CMTime(value: 1, timescale: 1)
            configuration.queueDepth = 3
            configuration.showsCursor = false
            if #available(macOS 15.0, *) { configuration.captureMicrophone = false }
            let candidate = SCStream(filter: filter, configuration: configuration, delegate: self)
            // Register only audio output; a microphone output is never registered.
            try candidate.addStreamOutput(self, type: .audio, sampleHandlerQueue: queue)
            let mayStart = queue.sync { () -> Bool in
                guard !stopped, identity.isLive() else { return false }
                boundWindow = window; stream = candidate; return true
            }
            guard mayStart else { return }
            try await candidate.startCapture()
            queue.async { [self] in
                guard !stopped, identity.isLive(), CGPreflightScreenCaptureAccess() else { stop(code: 4, reason: "source-or-permission"); return }
                append(audioHeader(pid: identity.pid)); started = !stopped
            }
        } catch {
            queue.async { [self] in stop(code: 4, reason: "capture") }
        }
    }

    func stream(_ stream: SCStream, didStopWithError error: Error) {
        queue.async { [self] in stop(code: 4, reason: "capture") }
    }
    func stream(_ stream: SCStream, didOutputSampleBuffer sample: CMSampleBuffer, of type: SCStreamOutputType) {
        guard !stopped, started, type == .audio else { return }
        guard identity.isLive(), CGPreflightScreenCaptureAccess(), boundWindow?.owningApplication?.processID == identity.pid else {
            stop(code: 4, reason: "source-or-permission"); return
        }
        do { try deliver(sample) } catch { stop(code: 4, reason: "format") }
    }

    private func deliver(_ sample: CMSampleBuffer) throws {
        guard CMSampleBufferIsValid(sample), CMSampleBufferDataIsReady(sample),
              let description = CMSampleBufferGetFormatDescription(sample),
              let formatPointer = CMAudioFormatDescriptionGetStreamBasicDescription(description) else { throw Refusal.format }
        let format = formatPointer.pointee
        let frameCount = CMSampleBufferGetNumSamples(sample)
        guard frameCount > 0, frameCount <= maxBufferBytes / 8,
              format.mSampleRate == 48000, format.mChannelsPerFrame == 2,
              format.mFormatID == kAudioFormatLinearPCM, format.mBitsPerChannel == 32,
              format.mFormatFlags & kAudioFormatFlagIsFloat != 0,
              format.mFormatFlags & kAudioFormatFlagIsBigEndian == 0 else { throw Refusal.format }
        let planar = format.mFormatFlags & kAudioFormatFlagIsNonInterleaved != 0
        guard format.mBytesPerFrame == (planar ? 4 : 8) else { throw Refusal.format }
        var needed = 0
        _ = CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(sample, bufferListSizeNeededOut: &needed,
            bufferListOut: nil, bufferListSize: 0, blockBufferAllocator: nil, blockBufferMemoryAllocator: nil,
            flags: UInt32(kCMSampleBufferFlag_AudioBufferList_Assure16ByteAlignment), blockBufferOut: nil)
        guard needed >= MemoryLayout<AudioBufferList>.size, needed <= 1024 else { throw Refusal.format }
        let storage = UnsafeMutableRawPointer.allocate(byteCount: needed, alignment: 16)
        defer { storage.deallocate() }
        let list = storage.bindMemory(to: AudioBufferList.self, capacity: 1)
        var block: CMBlockBuffer?
        guard CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(sample, bufferListSizeNeededOut: nil,
            bufferListOut: list, bufferListSize: needed, blockBufferAllocator: nil, blockBufferMemoryAllocator: nil,
            flags: UInt32(kCMSampleBufferFlag_AudioBufferList_Assure16ByteAlignment), blockBufferOut: &block) == noErr else { throw Refusal.format }
        // The retained block keeps all mData storage alive until serialization completes.
        try withExtendedLifetime(block) {
            let buffers = UnsafeMutableAudioBufferListPointer(list)
            guard buffers.count == (planar ? 2 : 1) else { throw Refusal.format }
            for buffer in buffers {
                guard buffer.mNumberChannels == (planar ? 1 : 2), buffer.mData != nil,
                      Int(buffer.mDataByteSize) >= frameCount * (planar ? 4 : 8),
                      Int(buffer.mDataByteSize) <= maxBufferBytes else { throw Refusal.format }
            }
            let left = buffers[0].mData!.assumingMemoryBound(to: Float.self)
            let right = planar ? buffers[1].mData!.assumingMemoryBound(to: Float.self) : left
            var offset = 0
            while offset < frameCount && !stopped {
                guard identity.isLive() else { throw Refusal.source }
                let count = min(maxPacketFrames, frameCount - offset)
                var packet = Data(capacity: 4 + count * 8)
                appendLE(UInt32(count), to: &packet)
                for index in offset..<(offset + count) {
                    let l = left[planar ? index : index * 2], r = right[planar ? index : index * 2 + 1]
                    guard l.isFinite, r.isFinite else { throw Refusal.format }
                    appendLE(l.bitPattern, to: &packet); appendLE(r.bitPattern, to: &packet)
                }
                append(packet); offset += count
            }
        }
    }

    private func append(_ data: Data) {
        guard !stopped else { return }
        guard output.count + data.count <= maxBufferBytes else { stop(code: 4, reason: "backpressure"); return }
        output.append(data); flush()
    }
    private func flush() {
        guard !stopped else { return }
        while !output.isEmpty {
            let result = output.withUnsafeBytes { bytes -> Int in
                guard let base = bytes.baseAddress else { return 0 }
                return Darwin.write(STDOUT_FILENO, base, bytes.count)
            }
            if result > 0 { output.removeFirst(result); continue }
            if result < 0 && errno == EINTR { continue }
            if result < 0 && errno == EAGAIN {
                if blockedSince == nil { blockedSince = DispatchTime.now().uptimeNanoseconds }
                if writeSuspended { writeSuspended = false; writeSource?.resume() }
                return
            }
            stop(code: 4, reason: "pipe"); return
        }
        blockedSince = nil
        if !writeSuspended { writeSource?.suspend(); writeSuspended = true }
    }
    private func stop(code: Int32, reason: String? = nil) {
        guard !stopped else { return }; stopped = true; started = false; output.removeAll(keepingCapacity: false)
        if let reason { diagnostic(reason) }
        timer?.cancel(); stdinSource?.cancel(); signals.forEach { $0.cancel() }
        if writeSuspended { writeSource?.resume(); writeSuspended = false }; writeSource?.cancel()
        guard let owned = stream else { Darwin.exit(code) }
        stream = nil; boundWindow = nil
        owned.stopCapture { _ in Darwin.exit(code) }
        // A dead SCK service must not retain a helper after the parent stopped.
        queue.asyncAfter(deadline: .now() + .seconds(1)) { Darwin.exit(code) }
    }
}

@main
private struct ProcessAudioMain {
    static func main() {
        signal(SIGPIPE, SIG_IGN)
        guard #available(macOS 13.0, *) else { diagnostic("unsupported-macos"); Darwin.exit(3) }
        let args = Array(CommandLine.arguments.dropFirst())
        do {
            if args == ["--self-test"] {
                guard processBirthSelfTest(), audioHeader(pid: 1).count == 24, MemoryLayout<Float>.size == 4, Float(0.5).bitPattern == 0x3f000000 else { throw Refusal.format }
                print("{\"protocol\":\"CLPA0001\",\"sampleRate\":48000,\"channels\":2,\"maxPacketFrames\":4800,\"processBirthVerified\":true}")
                return
            }
            guard args.count == 2 || args.count == 6,
                  args[0] == "--window" || args[0] == "--probe",
                  let window = decimal(args[1], maximum: UInt64(UInt32.max)) else { throw Refusal.source }
            var pid: pid_t?, start: Int64?
            if args.count == 6 {
                guard args[0] == "--window", args[2] == "--pid", args[4] == "--started",
                      let rawPID = decimal(args[3], maximum: UInt64(Int32.max)),
                      let rawStart = decimal(args[5], maximum: UInt64(Int64.max)) else { throw Refusal.source }
                pid = pid_t(rawPID); start = Int64(rawStart)
            }
            let identity = try WindowIdentity.bind(windowID: CGWindowID(window), expectedPID: pid, expectedStart: start)
            if args[0] == "--probe" {
                print("{\"windowId\":\"\(identity.windowID)\",\"pid\":\(identity.pid),\"processStartTime\":\(identity.started)}")
                return
            }
            let capture = AudioCapture(identity: identity)
            capture.run()
            withExtendedLifetime(capture) { dispatchMain() }
        } catch Refusal.launchSource { diagnostic("source-launch-services"); Darwin.exit(4) }
        catch { diagnostic("source"); Darwin.exit(4) }
    }
}
