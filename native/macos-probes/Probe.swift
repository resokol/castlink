import Foundation
import AppKit
import AVFoundation
import CoreGraphics
import ApplicationServices
import ScreenCaptureKit

// Observation only: never prompts, captures media, sends Apple Events or posts input.
// Successful compilation or existing permission is not evidence of feature parity.
@main
struct Probe {
    static func main() async throws {
        let config = SCStreamConfiguration()
        config.capturesAudio = true
        config.sampleRate = 48_000
        config.channelCount = 2
        config.excludesCurrentProcessAudio = true
        let screenAllowed = CGPreflightScreenCaptureAccess()
        var result: [String: Any] = [
            "schemaVersion": 1,
            "mode": "observation-only",
            "screenPermission": screenAllowed,
            "accessibilityPermission": AXIsProcessTrusted(),
            "microphoneAuthorization": AVCaptureDevice.authorizationStatus(for: .audio).rawValue,
            "cameraAuthorization": AVCaptureDevice.authorizationStatus(for: .video).rawValue,
            "powerPointInstalled": NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.microsoft.Powerpoint") != nil,
            "audioConfiguration": ["sampleRate": config.sampleRate, "channels": config.channelCount],
            "capture": "NOT VERIFIED",
            "audioIsolation": "NOT VERIFIED",
            "powerPointAnimation": "NOT VERIFIED",
            "remoteInput": "NOT VERIFIED"
        ]
        if screenAllowed {
            do {
                let content = try await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: true)
                // Counts only; no window titles, user document names or application paths.
                result["shareableDisplays"] = content.displays.count
                result["shareableWindows"] = content.windows.count
            } catch {
                result["shareableContent"] = "unavailable"
            }
        } else {
            result["shareableContent"] = "not-requested-without-permission"
        }
        let data = try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys])
        FileHandle.standardOutput.write(data)
        FileHandle.standardOutput.write(Data([10]))
    }
}
