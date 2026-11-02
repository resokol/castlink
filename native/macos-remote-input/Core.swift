import Foundation
import CoreFoundation

struct InputFailure: Error { let code: String; init(_ code: String) { self.code = code } }
struct InputPoint { var x: Double; var y: Double }
struct InputRect: Equatable {
    var x: Double; var y: Double; var width: Double; var height: Double
    func point(_ x: Int64, _ y: Int64) -> InputPoint { InputPoint(x: self.x + Double(x) * max(0, width - 1) / 65535, y: self.y + Double(y) * max(0, height - 1) / 65535) }
    var json: [String: Any] { ["x": Int(x.rounded()), "y": Int(y.rounded()), "width": Int(width.rounded()), "height": Int(height.rounded())] }
}
struct InputSnapshot {
    var identity: String
    var rect: InputRect
    var pixelWidth: Int
    var pixelHeight: Int
    var scale: Double
    var visible: Bool
    func point(_ x: Int64, _ y: Int64) -> InputPoint {
        InputPoint(x: rect.x + Double(x) * Double(pixelWidth - 1) / (65535 * scale), y: rect.y + Double(y) * Double(pixelHeight - 1) / (65535 * scale))
    }
}
protocol RemoteInputPlatform: AnyObject {
    func bind(_ source: [String: Any]) throws -> InputSnapshot
    func inspect(_ source: InputSnapshot) -> InputSnapshot?
    func safeDesktop() -> Bool
    func visiblePoint(_ source: InputSnapshot, _ point: InputPoint) -> Bool
    func move(_ point: InputPoint) throws
    func button(_ button: Int, _ down: Bool) throws
    func key(_ code: String, _ down: Bool, _ repeatKey: Bool) throws
    func text(_ text: String) throws
    func wheel(_ dx: Int, _ dy: Int) throws
    func releaseAll()
}
enum InputJSON {
    static func exact(_ value: [String: Any], _ keys: [String], optional: [String] = []) throws {
        guard keys.allSatisfy({ value[$0] != nil }), Set(value.keys).isSubset(of: Set(keys + optional)) else { throw InputFailure("REMOTE_INPUT_PROTOCOL") }
    }
    static func number(_ value: [String: Any], _ key: String, _ min: Int64 = 0, _ max: Int64 = 9_007_199_254_740_991) throws -> Int64 {
        guard let n = value[key] as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID(), n.doubleValue.isFinite, n.doubleValue.rounded() == n.doubleValue, n.doubleValue >= Double(min), n.doubleValue <= Double(max) else { throw InputFailure("REMOTE_INPUT_PROTOCOL") }
        return n.int64Value
    }
    static func bool(_ value: [String: Any], _ key: String) throws -> Bool {
        guard let n = value[key] as? NSNumber, CFGetTypeID(n) == CFBooleanGetTypeID() else { throw InputFailure("REMOTE_INPUT_PROTOCOL") }; return n.boolValue
    }
    static func object(_ value: [String: Any], _ key: String) throws -> [String: Any] {
        guard let obj = value[key] as? [String: Any] else { throw InputFailure("REMOTE_INPUT_PROTOCOL") }; return obj
    }
    static func string(_ value: [String: Any], _ key: String) throws -> String {
        guard let str = value[key] as? String else { throw InputFailure("REMOTE_INPUT_PROTOCOL") }; return str
    }
    static func token(_ value: [String: Any], _ key: String) throws -> String {
        let str = try string(value, key)
        guard str.range(of: "^[A-Za-z0-9_-]{1,128}$", options: .regularExpression) != nil else { throw InputFailure("REMOTE_INPUT_PROTOCOL") }; return str
    }
    static func validKey(_ code: String) -> Bool {
        code.range(of: "^(Key[A-Z]|Digit[0-9]|F([1-9]|1[0-9]|2[0-4])|Numpad[0-9]|Numpad(Add|Subtract|Multiply|Divide|Decimal|Enter)|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right)|Meta(Left|Right)|Arrow(Left|Right|Up|Down)|Enter|Tab|Space|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Escape|CapsLock|NumLock|ScrollLock|Pause|PrintScreen|Backquote|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash|IntlBackslash)$", options: .regularExpression) != nil
    }
}
final class RemoteInputCore {
    static let resource = "CastLink.RemoteInput/full-input-pause/2"
    let platform: RemoteInputPlatform
    let now: () -> Int64
    private var source: InputSnapshot?
    private var sourceJSON: [String: Any]?
    private var capture: String?
    private var grant: String?
    private var videoWidth = 1, videoHeight = 1
    private var grantRevision: Int64 = 0, lastGrantRevision: Int64 = 0, serial: Int64 = 0, deadline: Int64 = 0
    private var reliableSeq: Int64 = 0, moveSeq: Int64 = 0, barrier: Int64 = 0, receiverDeadline: Int64 = 0, resetSerial: Int64 = 0
    private(set) var revision: Int64 = 1
    private var ready = false, pointerReady = false, stopped = false, needsEmptyReset = true, fullInputPause = false
    private var pressedKeys = Set<String>(), pressedButtons = Set<Int>()
    private var error: String?
    private var lastID: Int64 = 0
    init(platform: RemoteInputPlatform, now: @escaping () -> Int64) { self.platform = platform; self.now = now }
    func state() -> [String: Any] {
        var result: [String: Any] = ["resourceVersion": Self.resource, "captureId": capture as Any? ?? NSNull(), "geometry": ["width": source?.pixelWidth ?? 1, "height": source?.pixelHeight ?? 1, "revision": revision], "ready": ready && !stopped, "pointerReady": pointerReady && !stopped, "active": ready && (!fullInputPause || pointerReady) && !stopped && !needsEmptyReset && grant != nil && deadline > now(), "stopped": stopped, "needsEmptyReset": needsEmptyReset, "error": error as Any? ?? NSNull()]
        if let source = source { result["rect"] = source.rect.json }; return result
    }
    var isPaused: Bool { needsEmptyReset }
    func authorizedForEffect() -> Bool { ready && !stopped && (!fullInputPause || pointerReady) && !needsEmptyReset && grant != nil && deadline > now() && receiverDeadline > now() }
    private func release() { platform.releaseAll(); pressedKeys.removeAll(); pressedButtons.removeAll() }
    func pause(_ reason: String? = nil) { release(); needsEmptyReset = true; resetSerial = serial; if let reason = reason { error = reason } }
    func stop() { stopped = true; ready = false; pointerReady = false; deadline = 0; release() }
    private func extentMatches(_ physical: Int, _ video: Int) -> Bool { physical == video || (physical % 2 == 1 && physical - 1 == video) }
    private func captureMatches(_ snapshot: InputSnapshot) -> Bool {
        let w = snapshot.pixelWidth, h = snapshot.pixelHeight
        if extentMatches(w, videoWidth) && extentMatches(h, videoHeight) { return true }
        guard w > 1920 || h > 1080 else { return false }
        let projection = w * 1080 >= h * 1920 ? (1920, 2 * (h * 1920 / (2 * w))) : (2 * (w * 1080 / (2 * h)), 1080)
        return videoWidth == projection.0 && videoHeight == projection.1
    }
    @discardableResult func tick() -> Bool {
        guard let previous = source, !stopped else { return false }
        let oldReady = ready, oldPointer = pointerReady, oldRevision = revision
        var changed = false
        if deadline > 0 && deadline <= now() { deadline = 0; pause("REMOTE_INPUT_LEASE"); changed = true }
        if receiverDeadline > 0 && receiverDeadline <= now() && !needsEmptyReset { pause("REMOTE_INPUT_REPLAY"); changed = true }
        if !platform.safeDesktop() { ready = false; pointerReady = false; if oldReady { pause("REMOTE_INPUT_DESKTOP") } }
        else if let current = platform.inspect(previous), current.identity == previous.identity {
            let translatingDrag = !pressedButtons.isEmpty && previous.rect.width == current.rect.width && previous.rect.height == current.rect.height && previous.scale == current.scale
            if (!translatingDrag && previous.rect != current.rect) || previous.scale != current.scale || previous.pixelWidth != current.pixelWidth || previous.pixelHeight != current.pixelHeight {
                pause("REMOTE_INPUT_GEOMETRY"); source = current; revision += 1; changed = true
            }
            ready = true; pointerReady = current.visible && captureMatches(current)
            if !pointerReady && oldPointer { pause("REMOTE_INPUT_GEOMETRY") }
        } else { ready = false; pointerReady = false; if oldReady { pause("REMOTE_INPUT_SOURCE") } }
        if oldReady != ready || oldPointer != pointerReady { if revision == oldRevision { revision += 1 }; changed = true }
        return changed
    }
    private func match(_ value: [String: Any]) throws {
        guard source != nil, !stopped, try InputJSON.token(value, "captureId") == capture, try InputJSON.number(value, "geometryRevision", 1) == revision else { throw InputFailure("REMOTE_INPUT_GEOMETRY") }
    }
    func command(_ value: [String: Any]) throws {
        let id = try InputJSON.number(value, "id", 1)
        guard id > lastID else { throw InputFailure("REMOTE_INPUT_REPLAY") }; lastID = id
        switch try InputJSON.string(value, "op") {
        case "start": try start(value)
        case "renew": try renew(value)
        case "input": try input(value)
        case "releaseAll": try InputJSON.exact(value, ["id", "op"]); pause()
        case "retireAuthority":
            try InputJSON.exact(value, ["id", "op"]); pause(); grant = nil; grantRevision = 0; lastGrantRevision = 0; serial = 0; deadline = 0; receiverDeadline = 0; reliableSeq = 0; moveSeq = 0; barrier = 0; resetSerial = 0
        case "stop": try InputJSON.exact(value, ["id", "op"]); stop()
        default: throw InputFailure("REMOTE_INPUT_PROTOCOL")
        }
    }
    private func start(_ value: [String: Any]) throws {
        try InputJSON.exact(value, ["id", "op", "captureId", "source", "video", "mapping"], optional: ["fullInputPause"])
        let selected = try InputJSON.object(value, "source"), video = try InputJSON.object(value, "video"), mapping = try InputJSON.object(value, "mapping")
        try InputJSON.exact(video, ["width", "height"]); try InputJSON.exact(mapping, ["kind"])
        let kind = try InputJSON.string(selected, "kind"), rule = try InputJSON.string(mapping, "kind")
        guard (kind == "window" && rule == "macos-window") || (kind == "screen" && rule == "macos-display") else { throw InputFailure("REMOTE_INPUT_SOURCE") }
        let nextCapture = try InputJSON.token(value, "captureId"), width = Int(try InputJSON.number(video, "width", 1, 32768)), height = Int(try InputJSON.number(video, "height", 1, 32768))
        let strict = value["fullInputPause"] != nil ? try InputJSON.bool(value, "fullInputPause") : false
        guard strict else { throw InputFailure("REMOTE_INPUT_SOURCE") }
        if source != nil {
            guard !stopped, capture == nextCapture, strict == fullInputPause, let original = sourceJSON, NSDictionary(dictionary: original).isEqual(to: selected) else { throw InputFailure("REMOTE_INPUT_SOURCE") }
            if width != videoWidth || height != videoHeight { pause(); revision += 1 }
        } else { source = try platform.bind(selected); sourceJSON = selected; capture = nextCapture; fullInputPause = strict }
        videoWidth = width; videoHeight = height; tick()
    }
    private func renew(_ value: [String: Any]) throws {
        try InputJSON.exact(value, ["id", "op", "captureId", "grantId", "revision", "leaseSerial", "geometryRevision", "expiresAt", "activate"])
        tick(); try match(value)
        guard ready else { throw InputFailure("REMOTE_INPUT_LEASE") }
        let nextGrant = try InputJSON.token(value, "grantId"), nextRevision = try InputJSON.number(value, "revision", 1), nextSerial = try InputJSON.number(value, "leaseSerial", 1), expiry = try InputJSON.number(value, "expiresAt", 1)
        guard expiry > now(), expiry <= now() + 750 else { throw InputFailure("REMOTE_INPUT_LEASE") }
        if try InputJSON.bool(value, "activate") {
            guard nextRevision > lastGrantRevision else { throw InputFailure("REMOTE_INPUT_LEASE") }
            release(); reliableSeq = 0; moveSeq = 0; barrier = 0; lastGrantRevision = nextRevision; needsEmptyReset = true; resetSerial = nextSerial - 1; receiverDeadline = 0
        } else { guard nextGrant == grant, nextRevision == grantRevision, nextSerial > serial else { throw InputFailure("REMOTE_INPUT_LEASE") } }
        grant = nextGrant; grantRevision = nextRevision; serial = nextSerial; deadline = expiry; error = nil
    }
    private func input(_ value: [String: Any]) throws {
        try InputJSON.exact(value, ["id", "op", "captureId", "grantId", "revision", "geometryRevision", "lane", "seq", "expiresAt", "moveBarrier", "event"])
        tick(); try match(value)
        guard ready, grant != nil, deadline > now(), try InputJSON.token(value, "grantId") == grant, try InputJSON.number(value, "revision", 1) == grantRevision else { throw InputFailure("REMOTE_INPUT_LEASE") }
        let expiry = try InputJSON.number(value, "expiresAt", 1)
        guard expiry > now(), expiry <= now() + 750 else { pause(); throw InputFailure("REMOTE_INPUT_LEASE") }
        let lane = try InputJSON.string(value, "lane"), seq = try InputJSON.number(value, "seq", 1), moveBarrier = try InputJSON.number(value, "moveBarrier"), event = try InputJSON.object(value, "event"), type = try InputJSON.string(event, "type")
        guard lane == "move" || lane == "reliable" else { throw InputFailure("REMOTE_INPUT_EVENT") }
        guard lane == "move" ? seq > moveSeq && seq > barrier : seq > reliableSeq else { throw InputFailure("REMOTE_INPUT_REPLAY") }
        guard (lane == "move") == (type == "move") else { throw InputFailure("REMOTE_INPUT_EVENT") }
        var snapshotKeys = Set<String>(), snapshotButtons = Set<Int>()
        if type == "heartbeat" {
            try InputJSON.exact(event, ["type", "pressedKeys", "pressedButtons"])
            guard let keys = event["pressedKeys"] as? [String], let buttons = event["pressedButtons"] as? [NSNumber], keys.count <= 32, buttons.count <= 3, keys.allSatisfy(InputJSON.validKey), Set(keys).count == keys.count else { throw InputFailure("REMOTE_INPUT_EVENT") }
            for button in buttons { guard CFGetTypeID(button) != CFBooleanGetTypeID(), button.doubleValue.rounded() == button.doubleValue, (0...2).contains(button.intValue) else { throw InputFailure("REMOTE_INPUT_EVENT") }; snapshotButtons.insert(button.intValue) }
            guard snapshotButtons.count == buttons.count else { throw InputFailure("REMOTE_INPUT_EVENT") }; snapshotKeys = Set(keys)
        }
        if fullInputPause && !pointerReady && type != "releaseAll" { throw InputFailure("REMOTE_INPUT_GEOMETRY") }
        let emptyHeartbeat = type == "heartbeat" && snapshotKeys.isEmpty && snapshotButtons.isEmpty
        if lane == "reliable" && (needsEmptyReset || seq != reliableSeq + 1) {
            if !needsEmptyReset { pause() }
            guard emptyHeartbeat, serial > resetSerial else { throw InputFailure("REMOTE_INPUT_REPLAY") }; needsEmptyReset = false
        }
        guard !needsEmptyReset else { throw InputFailure("REMOTE_INPUT_REPLAY") }
        do {
            switch type {
            case "move", "button", "wheel":
                try InputJSON.exact(event, type == "move" ? ["type", "x", "y"] : type == "button" ? ["type", "x", "y", "button", "down"] : ["type", "x", "y", "deltaX", "deltaY"])
                let x = try InputJSON.number(event, "x", 0, 65535), y = try InputJSON.number(event, "y", 0, 65535)
                let button = type == "button" ? Int(try InputJSON.number(event, "button", 0, 2)) : 0
                let down = type == "button" ? try InputJSON.bool(event, "down") : false
                let dx = type == "wheel" ? Int(try InputJSON.number(event, "deltaX", -12000, 12000)) : 0, dy = type == "wheel" ? Int(try InputJSON.number(event, "deltaY", -12000, 12000)) : 0
                guard pointerReady, let source = source else { throw InputFailure("REMOTE_INPUT_GEOMETRY") }
                let point = source.point(x, y)
                guard platform.visiblePoint(source, point) else { throw InputFailure("REMOTE_INPUT_OCCLUDED") }
                try platform.move(point)
                if type == "button" { try platform.button(button, down); if down { pressedButtons.insert(button) } else { pressedButtons.remove(button) } }
                if type == "wheel" { try platform.wheel(dx, dy) }
                if type != "move" { barrier = max(barrier, moveBarrier) }
            case "key":
                try InputJSON.exact(event, ["type", "code", "down", "repeat"])
                let code = try InputJSON.string(event, "code"), down = try InputJSON.bool(event, "down"), repeated = try InputJSON.bool(event, "repeat")
                guard InputJSON.validKey(code) else { throw InputFailure("REMOTE_INPUT_EVENT") }
                try platform.key(code, down, repeated); if down { pressedKeys.insert(code) } else { pressedKeys.remove(code) }
            case "text":
                try InputJSON.exact(event, ["type", "text"]); let text = try InputJSON.string(event, "text")
                guard !text.isEmpty, text.utf16.count <= 256, !text.unicodeScalars.contains(where: { ($0.value < 32 && ![9, 10, 13].contains($0.value)) || $0.value == 127 }) else { throw InputFailure("REMOTE_INPUT_EVENT") }
                try platform.text(text)
            case "heartbeat":
                guard snapshotKeys == pressedKeys, snapshotButtons == pressedButtons else { throw InputFailure("REMOTE_INPUT_REPLAY") }; receiverDeadline = now() + 500
            case "releaseAll": try InputJSON.exact(event, ["type"]); pause()
            default: throw InputFailure("REMOTE_INPUT_EVENT")
            }
        } catch { pause((error as? InputFailure)?.code); throw error }
        if lane == "move" { moveSeq = seq } else { reliableSeq = seq }
    }
}
