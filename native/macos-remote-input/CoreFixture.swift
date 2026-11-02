import Foundation

// Pure state-machine fixture. No CGEvent/Accessibility imports and no OS input.
final class FixturePlatform: RemoteInputPlatform {
    var safe = true
    var visible = true
    var identity = "42:100:launch"
    var rect = InputRect(x: 10, y: 20, width: 800, height: 600)
    var effects: [String] = []
    var releases = 0
    var physicalCursor = InputPoint(x: 9000, y: 9000)
    var buttonPoints: [InputPoint] = []
    func bind(_ source: [String: Any]) throws -> InputSnapshot { snapshot() }
    func inspect(_ source: InputSnapshot) -> InputSnapshot? { snapshot() }
    func snapshot() -> InputSnapshot { InputSnapshot(identity: identity, rect: rect, pixelWidth: Int(rect.width * 2), pixelHeight: Int(rect.height * 2), scale: 2, visible: visible) }
    func safeDesktop() -> Bool { safe }
    func visiblePoint(_ source: InputSnapshot, _ point: InputPoint) -> Bool { visible }
    func move(_ point: InputPoint) throws { effects.append("move") }
    func button(_ button: Int, _ down: Bool, _ point: InputPoint) throws { effects.append("button"); buttonPoints.append(point) }
    func key(_ code: String, _ down: Bool, _ repeatKey: Bool) throws { effects.append("key") }
    func text(_ text: String) throws { effects.append("text") }
    func wheel(_ dx: Int, _ dy: Int) throws { effects.append("wheel") }
    func releaseAll() { releases += 1 }
}
@main enum CoreFixture {
    static func main() throws {
        precondition(InputJSON.validKey("F20") && !InputJSON.validKey("F21") && !InputJSON.validKey("F24"), "unmapped Mac keys must fail finite protocol validation")
        let dockProof = InputDockTrackingProof(appleDockCode: true, displaySized: true, layer: 20, axQuerySucceeded: true, axOwnerMatches: true, axWindowMatches: true)
        var visibleThroughDock = InputPointOcclusion()
        visibleThroughDock.add(selected: false, dock: dockProof); precondition(visibleThroughDock.decision == nil)
        visibleThroughDock.add(selected: true, dock: nil); precondition(visibleThroughDock.decision == true)
        var foreignModalBehindDock = InputPointOcclusion()
        foreignModalBehindDock.add(selected: false, dock: dockProof); foreignModalBehindDock.add(selected: false, dock: nil); foreignModalBehindDock.add(selected: true, dock: nil)
        precondition(foreignModalBehindDock.decision == false, "a Dock rectangle never hides a following real blocker")
        var noSelectedWindow = InputPointOcclusion(); noSelectedWindow.add(selected: false, dock: dockProof); precondition(noSelectedWindow.decision == nil)
        for rejected in [
            InputDockTrackingProof(appleDockCode: false, displaySized: true, layer: 20, axQuerySucceeded: true, axOwnerMatches: true, axWindowMatches: true),
            InputDockTrackingProof(appleDockCode: true, displaySized: false, layer: 20, axQuerySucceeded: true, axOwnerMatches: true, axWindowMatches: true),
            InputDockTrackingProof(appleDockCode: true, displaySized: true, layer: 3, axQuerySucceeded: true, axOwnerMatches: true, axWindowMatches: true),
            InputDockTrackingProof(appleDockCode: true, displaySized: true, layer: 20, axQuerySucceeded: false, axOwnerMatches: true, axWindowMatches: true),
            InputDockTrackingProof(appleDockCode: true, displaySized: true, layer: 20, axQuerySucceeded: true, axOwnerMatches: false, axWindowMatches: true),
            InputDockTrackingProof(appleDockCode: true, displaySized: true, layer: 20, axQuerySucceeded: true, axOwnerMatches: true, axWindowMatches: false)
        ] { var blocked = InputPointOcclusion(); blocked.add(selected: false, dock: rejected); precondition(blocked.decision == false) }
        let highDockProof = InputDockTrackingProof(appleDockCode: true, displaySized: true, layer: 2006, axQuerySucceeded: true, axOwnerMatches: true, axWindowMatches: true)
        precondition(highDockProof.permitsContinuing)
        let geometry = InputSnapshot(identity: "retina", rect: InputRect(x: -100, y: 20, width: 800, height: 600), pixelWidth: 1600, pixelHeight: 1200, scale: 2, visible: true)
        let edge = geometry.point(65535, 65535)
        precondition(edge.x == 699.5 && edge.y == 619.5, "Retina endpoint must use backing-pixel extent")
        let platform = FixturePlatform()
        var time: Int64 = 100_000
        let core = RemoteInputCore(platform: platform, now: { time })
        var commandID = 0
        func command(_ op: String, _ fields: [String: Any] = [:]) throws {
            commandID += 1
            var command = fields; command["id"] = commandID; command["op"] = op
            try core.command(command)
        }
        func denied(_ code: String, _ op: String, _ fields: [String: Any]) {
            do { try command(op, fields); fatalError("accepted \(code)") }
            catch let error as InputFailure { precondition(error.code == code, "expected \(code), got \(error.code)") }
            catch { fatalError("unexpected failure") }
        }
        func proof(_ serial: Int = 1, _ expiry: Int64 = 100_700, _ activate: Bool = false) -> [String: Any] {
            ["captureId": "capture", "grantId": "grant", "revision": 1, "leaseSerial": serial, "geometryRevision": core.revision, "expiresAt": expiry, "activate": activate]
        }
        func frame(_ seq: Int, _ event: [String: Any], _ lane: String = "reliable", _ expiry: Int64 = 100_200) -> [String: Any] {
            ["captureId": "capture", "grantId": "grant", "revision": 1, "geometryRevision": core.revision, "expiresAt": expiry, "lane": lane, "seq": seq, "moveBarrier": 0, "event": event]
        }
        let empty: [String: Any] = ["type": "heartbeat", "pressedKeys": [String](), "pressedButtons": [Int]()]
        let key: [String: Any] = ["type": "key", "code": "MetaLeft", "down": true, "repeat": false]
        try command("start", ["captureId": "capture", "source": ["kind": "window", "windowId": "42"], "video": ["width": 1600, "height": 1200], "mapping": ["kind": "macos-window"], "fullInputPause": true])
        denied("REMOTE_INPUT_LEASE", "input", frame(1, key)); precondition(platform.effects.isEmpty)
        denied("REMOTE_INPUT_LEASE", "renew", proof(1, 100_751, true))
        try command("renew", proof(1, 100_700, true))
        denied("REMOTE_INPUT_REPLAY", "input", frame(1, key))
        try command("input", frame(1, empty)); try command("input", frame(2, key))
        denied("REMOTE_INPUT_REPLAY", "input", frame(2, key)); precondition(platform.effects == ["key"])
        denied("REMOTE_INPUT_REPLAY", "input", frame(4, key)); let releases = platform.releases
        try command("renew", proof(2)); try command("input", frame(5, empty))
        try command("input", frame(6, ["type": "text", "text": "中文 😀"]))
        time += 501; _ = core.tick(); precondition(platform.releases > releases)
        denied("REMOTE_INPUT_REPLAY", "input", frame(7, key, "reliable", 100_650))
        try command("renew", proof(3, 101_200)); try command("input", frame(8, empty, "reliable", 100_650))
        let revision = core.revision; platform.rect.x += 10; _ = core.tick(); precondition(core.revision > revision)
        denied("REMOTE_INPUT_REPLAY", "input", frame(9, key, "reliable", 100_650))
        try command("renew", proof(4, 101_200)); try command("input", frame(10, empty, "reliable", 100_650))
        platform.safe = false; _ = core.tick(); denied("REMOTE_INPUT_LEASE", "input", frame(11, key, "reliable", 100_650))
        platform.safe = true; _ = core.tick(); platform.identity = "reused"; _ = core.tick(); precondition(core.state()["ready"] as? Bool == false)
        try command("retireAuthority"); core.stop(); precondition(core.state()["stopped"] as? Bool == true)
        let timeoutPlatform = FixturePlatform(); var timeoutNow: Int64 = 200_000
        let timeoutCore = RemoteInputCore(platform: timeoutPlatform, now: { timeoutNow }); var timeoutID = 0
        func timeoutCommand(_ op: String, _ fields: [String: Any] = [:]) throws {
            timeoutID += 1; var value = fields; value["id"] = timeoutID; value["op"] = op; try timeoutCore.command(value)
        }
        try timeoutCommand("start", ["captureId":"expiry", "source":["kind":"window","windowId":"42"], "video":["width":1600,"height":1200], "mapping":["kind":"macos-window"], "fullInputPause":true])
        let timeoutRevision = timeoutCore.revision
        try timeoutCommand("renew", ["captureId":"expiry","grantId":"expiry-grant","revision":1,"leaseSerial":1,"geometryRevision":timeoutRevision,"expiresAt":200_700,"activate":true])
        func timeoutFrame(_ sequence: Int, _ event: [String: Any]) -> [String: Any] {
            ["captureId":"expiry","grantId":"expiry-grant","revision":1,"geometryRevision":timeoutRevision,"expiresAt":200_600,"lane":"reliable","seq":sequence,"moveBarrier":0,"event":event]
        }
        try timeoutCommand("input", timeoutFrame(1, empty)); try timeoutCommand("input", timeoutFrame(2, key))
        timeoutNow += 701; let beforeExpiry = timeoutPlatform.releases; _ = timeoutCore.tick()
        precondition(timeoutPlatform.releases > beforeExpiry && !timeoutCore.authorizedForEffect())
        precondition(timeoutCore.state()["needsEmptyReset"] as? Bool == true)
        var gateNow: Int64 = 300_000
        let gate = NativeInputGate(now: { gateNow })
        gate.update(deadline: 300_700, heartbeat: 300_500, enabled: true); precondition(gate.allowed())
        gateNow += 501; precondition(gate.expired() && !gate.allowed() && !gate.expired())
        gate.update(deadline: 301_000, heartbeat: 301_000, enabled: true); precondition(gate.allowed()); gate.revoke(); precondition(!gate.allowed())
        let cursorPlatform = FixturePlatform()
        // A move post is asynchronous: the OS cursor deliberately remains elsewhere.
        // The core must pass this command's verified mapped point into button DOWN.
        let pointerCore = RemoteInputCore(platform: cursorPlatform, now: { 400_000 }); var pointerID = 0
        func pointerCommand(_ op: String, _ fields: [String: Any]) throws { pointerID += 1; var value = fields; value["id"] = pointerID; value["op"] = op; try pointerCore.command(value) }
        try pointerCommand("start", ["captureId":"pointer","source":["kind":"window","windowId":"42"],"video":["width":1600,"height":1200],"mapping":["kind":"macos-window"],"fullInputPause":true])
        try pointerCommand("renew", ["captureId":"pointer","grantId":"pointer-grant","revision":1,"leaseSerial":1,"geometryRevision":pointerCore.revision,"expiresAt":400_700,"activate":true])
        func pointerFrame(_ sequence: Int, _ event: [String: Any]) -> [String: Any] { ["captureId":"pointer","grantId":"pointer-grant","revision":1,"geometryRevision":pointerCore.revision,"expiresAt":400_500,"lane":"reliable","seq":sequence,"moveBarrier":0,"event":event] }
        try pointerCommand("input", pointerFrame(1, empty))
        try pointerCommand("input", pointerFrame(2, ["type":"button","button":0,"down":true,"x":65535,"y":0]))
        precondition(cursorPlatform.buttonPoints.last?.x == 809.5 && cursorPlatform.buttonPoints.last?.y == 20)
        precondition(cursorPlatform.physicalCursor.x == 9000 && cursorPlatform.physicalCursor.y == 9000, "fixture physical cursor must remain different from accepted point")
        print("PASS: lease, replay, empty reset, watchdog, Retina geometry, identity, locked desktop, release, stop, Dock occlusion, authenticated button point")
    }
}
