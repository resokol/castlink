import AppKit
import ApplicationServices
import CryptoKit
import Darwin
import Carbon.HIToolbox

// One bounded invocation per operation. No global keyboard event is posted.
// Preview and Chromium browser PDFs require document/AX viewer evidence.
// Titles, tab labels and a .pdf-looking HTML page never authorize input.
enum Refusal: String, Error {
    case unavailable = "WINDOW_SLIDES_UNAVAILABLE"
    case stale = "WINDOW_SLIDES_STALE"
    case foreground = "WINDOW_SLIDES_FOREGROUND"
    case command = "WINDOW_SLIDES_COMMAND"
    case permission = "WINDOW_SLIDES_ACCESSIBILITY_PERMISSION"
    case ambiguous = "WINDOW_SLIDES_AMBIGUOUS"
}
// Set only by the owned browser fixture; normal broker operations have no
// fixture deadline. Reserve the outer command's final20 seconds for cleanup.
var fixtureWorkDeadline: Date?
func fixtureHasWork() -> Bool { fixtureWorkDeadline.map { Date() < $0 } ?? true }
func fixtureBound(_ deadline: Date) -> Date { fixtureWorkDeadline.map { min(deadline,$0) } ?? deadline }
func fixtureUntil(_ seconds: Double) -> Date { fixtureBound(Date().addingTimeInterval(seconds)) }
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
struct DocumentEvidence {
    let document: String
    let root: AXUIElement
    let viewer: AXUIElement?
}
struct Target {
    let number: UInt32
    let pid: pid_t
    let launched: Int64
    let app: NSRunningApplication
    let window: AXUIElement
    let evidence: DocumentEvidence
    let name: String
    let binding: String
    var document: String { evidence.document }
    var json: [String: String] { ["windowHandle": String(number), "binding": binding, "name": name] }
}
let ownerPID = getppid()
var brokerMode = false
func liveOwner() -> Bool { !brokerMode || (ownerPID > 1 && getppid() == ownerPID && kill(ownerPID,0) == 0) }
var retainedTargets: [Target] = []
var viewerCache: [String: Set<String>] = [:]
let browserBundles = ["com.google.Chrome", "com.microsoft.edgemac"]
func pdfURL(_ value: String) -> URL? {
    guard var components = URLComponents(string: value),
          let scheme = components.scheme?.lowercased(), ["file", "https", "http"].contains(scheme),
          components.user == nil, components.password == nil,
          let url = components.url, url.pathExtension.lowercased() == "pdf",
          url.isFileURL || !(url.host ?? "").isEmpty else { return nil }
    components.fragment = nil
    guard let clean = components.url else { return nil }
    return clean.isFileURL ? clean.standardizedFileURL.resolvingSymlinksInPath() : clean
}
func urlAttribute(_ node: AXUIElement) -> String? {
    if let value = attribute(node, "AXURL") as? URL { return value.absoluteString }
    return string(node, "AXURL")
}
func viewerID(_ resource: Data) -> String? {
    guard resource.count <= 65536, let raw = String(data: resource, encoding: .utf8) else { return nil }
    let source = raw.split(separator: "\n", omittingEmptySubsequences: false).filter { !$0.trimmingCharacters(in: .whitespaces).hasPrefix("//") }.joined(separator: "\n")
    guard let data = source.data(using: .utf8), let manifest = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let mime = manifest["mime_types"] as? [String], mime.contains("application/pdf"),
          let permissions = manifest["permissions"] as? [Any], permissions.contains(where: { ($0 as? String) == "pdfViewerPrivate" }),
          manifest["mime_types_handler"] as? String == "index.html",
          let encoded = manifest["key"] as? String, let key = Data(base64Encoded: encoded), !key.isEmpty else { return nil }
    return SHA256.hash(data: key).prefix(16).map { byte in
        String(UnicodeScalar(97 + Int(byte >> 4))!) + String(UnicodeScalar(97 + Int(byte & 15))!)
    }.joined()
}
// Chromium DataPack v4/v5 public resource format; every offset is validated.
func packResources(_ data: Data) -> [Data] {
    func number(_ at: Int, _ size: Int) -> Int? {
        guard at >= 0, size <= 4, at <= data.count - size else { return nil }
        return (0..<size).reduce(0) { $0 | (Int(data[at+$1]) << ($1*8)) }
    }
    guard data.count >= 12, data.count <= 67108864, let version = number(0,4), [4,5].contains(version) else { return [] }
    let header = version == 5 ? 12 : 9
    let aliases = version == 5 ? (number(10,2) ?? 65536) : 0
    guard let count = number(version == 5 ? 8 : 4, version == 5 ? 2 : 4), count <= 20000,
          header + (count+1)*6 + aliases*4 <= data.count else { return [] }
    var resources: [Data] = []
    for index in 0..<count {
        guard let start = number(header+index*6+2,4), let end = number(header+(index+1)*6+2,4),
              start >= header+(count+1)*6+aliases*4, start <= end, end <= data.count else { return [] }
        if end-start <= 65536 { resources.append(data.subdata(in: start..<end)) }
    }
    return resources
}
func builtinViewerIDs(_ bundle: String) -> Set<String> {
    // Same built-in Chromium PDF origin observed in owned Chrome and Edge
    // fixtures on macOS (ad3adaa); exact bundle and viewer origin still bind.
    browserBundles.contains(bundle) ? ["mhjfbmdgcfjbbpaeojofohoefgiehjai"] : []
}
func viewers(_ app: NSRunningApplication) -> Set<String> {
    guard let appURL = app.bundleURL, let bundle = Bundle(url: appURL), let id = app.bundleIdentifier else { return [] }
    let cacheKey = appURL.path
    if let cached = viewerCache[cacheKey] { return cached }
    guard browserBundles.contains(id) else { return [] }
    var result = builtinViewerIDs(id)
    let framework = id == "com.google.Chrome" ? "Google Chrome Framework.framework" : "Microsoft Edge Framework.framework"
    let base = appURL.appendingPathComponent("Contents/Frameworks/" + framework)
    var versions = ["Current"]
    if let version = bundle.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String,
       version.allSatisfy({ $0.isNumber || $0 == "." }) { versions.append(version) }
    let resourceDirectories = versions.map { base.appendingPathComponent("Versions/" + $0 + "/Resources",isDirectory:true) } + [base.appendingPathComponent("Resources",isDirectory:true)]
    var candidates: [URL] = []
    for directory in resourceDirectories {
        guard let entries = try? FileManager.default.contentsOfDirectory(at:directory,includingPropertiesForKeys:[.isRegularFileKey],options:[.skipsHiddenFiles]) else { continue }
        candidates += entries.filter { $0.pathExtension.lowercased() == "pak" }.prefix(16)
    }
    var total = 0
    for candidate in candidates {
        let canonical = candidate.resolvingSymlinksInPath()
        guard canonical.path.hasPrefix(appURL.resolvingSymlinksInPath().path + "/"),
              let size = try? canonical.resourceValues(forKeys: [.fileSizeKey]).fileSize, size <= 67108864, size >= 0,
              total <= 134217728 - size, let data = try? Data(contentsOf: canonical, options: .mappedIfSafe) else { continue }
        total += data.count
        for resource in packResources(data) { if let viewer = viewerID(resource) { result.insert(viewer) } }
    }
    viewerCache[cacheKey] = result
    return result
}
func trustedViewer(_ raw: String, _ ids: Set<String>) -> Bool {
    guard let url = URL(string: raw), let scheme = url.scheme,
          ["chrome-extension", "edge-extension", "extension"].contains(scheme),
          let host = url.host, ids.contains(host), ["/index.html","/edge_pdf/index.html"].contains(url.path),
          url.user == nil, url.password == nil, url.port == nil else { return false }
    return true
}
struct BrowserNode {
    let element: AXUIElement
    let parent: Int?
    let role: String
    let url: String?
}
func prunePDFContent(role: String, url: String?, originalWebAreaFound: Bool, ids: Set<String>, includeContent: Bool) -> Bool {
    // A native browser AXGroup may carry the original PDF URL while containing
    // the whole browser UI. Only a proven built-in viewer below an original
    // PDF AXWebArea is a valid text-content boundary.
    !includeContent && role == "AXWebArea" && originalWebAreaFound && trustedViewer(url ?? "",ids)
}
func browserTree(_ window: AXUIElement, _ ids: Set<String>, includeContent: Bool = false) -> [BrowserNode]? {
    var nodes: [BrowserNode] = []
    var queue: [(AXUIElement,Int?,Int)] = [(window,nil,0)]
    var offset = 0
    while offset < queue.count {
        guard fixtureHasWork(), queue.count <= 1024 else { return nil }
        let (node,parent,depth) = queue[offset]; offset += 1
        guard depth <= 32, let role = string(node,kAXRoleAttribute) else { return nil }
        let index = nodes.count
        let documentURL = urlAttribute(node)
        nodes.append(BrowserNode(element: node,parent: parent,role: role,url: documentURL))
        if ["AXStaticText","AXImage","AXLink","AXTextField","AXButton","AXTab","AXMenuItem"].contains(role) { continue }
        var owner = parent
        var originalFound = false
        for _ in 0..<32 { guard let at = owner else { break }; if nodes[at].role == "AXWebArea", pdfURL(nodes[at].url ?? "") != nil { originalFound = true; break }; owner = nodes[at].parent }
        if prunePDFContent(role:role,url:documentURL,originalWebAreaFound:originalFound,ids:ids,includeContent:includeContent) { continue }
        var value: CFTypeRef?
        let status = AXUIElementCopyAttributeValue(node,kAXChildrenAttribute as CFString,&value)
        if status == .noValue || status == .attributeUnsupported { continue }
        guard status == .success, let children = value as? [AXUIElement], children.count <= 256 else { return nil }
        for child in children { queue.append((child,index,depth+1)) }
    }
    return nodes
}
func browserProofs(_ nodes: [BrowserNode], _ ids: Set<String>) -> [DocumentEvidence] {
    var proofs: [DocumentEvidence] = []
    for (index,node) in nodes.enumerated() where node.role == "AXWebArea" && trustedViewer(node.url ?? "",ids) {
        // The built-in PDF extension and original PDF web area must be in the
        // same ancestry chain. An HTML title/URL alone cannot provide proof.
        var ancestor = node.parent
        for _ in 0..<32 {
            guard let current = ancestor else { break }
            let owner = nodes[current]
            if owner.role == "AXWebArea", let raw = owner.url, let document = pdfURL(raw) {
                proofs.append(DocumentEvidence(document: document.absoluteString,root: owner.element,viewer: node.element)); break
            }
            ancestor = owner.parent
        }
        // Some Chromium versions expose the original resource URL on the
        // plugin's PDF group below the extension, instead of an outer web area.
        if !proofs.contains(where: { $0.viewer.map { CFEqual($0,node.element) } ?? false }) {
            let descendants = nodes.enumerated().filter { candidate in
                guard candidate.element.role == "AXGroup", pdfURL(candidate.element.url ?? "") != nil else { return false }
                var parent = candidate.element.parent
                for _ in 0..<32 { guard let value = parent else { return false }; if value == index { return true }; parent = nodes[value].parent }
                return false
            }
            if descendants.count == 1, let only = descendants.first, let document = pdfURL(only.element.url ?? "") {
                proofs.append(DocumentEvidence(document: document.absoluteString,root: only.element.element,viewer: node.element))
            }
        }
    }
    return proofs
}
func browserDocument(_ window: AXUIElement, _ app: NSRunningApplication) -> DocumentEvidence? {
    let ids = viewers(app)
    guard !ids.isEmpty, let nodes = browserTree(window,ids) else { return nil }
    let proofs = browserProofs(nodes,ids)
    guard proofs.count == 1 else { return nil }
    return proofs[0]
}
func previewChildren(_ node: AXUIElement, maximum: Int, allowSample: Bool = false) -> [AXUIElement]? {
    var count: CFIndex = 0
    let counted = AXUIElementGetAttributeValueCount(node,kAXChildrenAttribute as CFString,&count)
    if counted == .noValue || counted == .attributeUnsupported { return [] }
    guard counted == .success, count >= 0, allowSample || count <= maximum else { return nil }
    if count == 0 { return [] }
    var values: CFArray?
    guard AXUIElementCopyAttributeValues(node,kAXChildrenAttribute as CFString,0,min(count,maximum),&values) == .success,
          let children = values as? [AXUIElement] else { return nil }
    return children
}
func previewDocumentRoot(_ window: AXUIElement) -> AXUIElement? {
    var queue: [(AXUIElement,Int)] = [(window,0)], offset = 0
    var candidates: [AXUIElement] = []
    while offset < queue.count {
        guard queue.count <= 256 else { return nil }
        let (node,depth) = queue[offset]; offset += 1
        guard depth <= 16, let role = string(node,kAXRoleAttribute) else { return nil }
        if role == "AXGroup", string(node,kAXSubroleAttribute) == "AXSharedDocumentContainer" {
            guard let children = previewChildren(node,maximum:32,allowSample:true), children.contains(where:{ page in
                guard string(page,kAXRoleAttribute) == "AXPage", let parent = element(page,kAXParentAttribute) else { return false }
                return CFEqual(parent,node)
            }) else { return nil }
            candidates.append(node); continue
        }
        if ["AXPage","AXOutline","AXTable","AXList","AXRow","AXCell","AXStaticText","AXImage","AXButton","AXTextField","AXTextArea"].contains(role) { continue }
        guard let children = previewChildren(node,maximum:64) else { return nil }
        for child in children { queue.append((child,depth+1)) }
    }
    guard candidates.count == 1 else { return nil }
    return candidates[0]
}
func previewNearestScroller(_ root: AXUIElement, _ window: AXUIElement) -> AXUIElement? {
    var parent = element(root,kAXParentAttribute)
    for _ in 0..<16 {
        guard let node = parent, !CFEqual(node,window), let role = string(node,kAXRoleAttribute), !blockedFocus(role,string(node,kAXSubroleAttribute)) else { return nil }
        if ["AXScrollArea","AXLayoutArea"].contains(role) { return node }
        parent = element(node,kAXParentAttribute)
    }
    return nil
}
func previewFocusMember(exactContainer: Bool, reachedContainer: Bool, pageAncestor: Bool, nearestScroller: Bool) -> Bool {
    exactContainer || (reachedContainer && pageAncestor) || nearestScroller
}
func documentEvidence(_ window: AXUIElement, _ app: NSRunningApplication) -> DocumentEvidence? {
    if app.bundleIdentifier == "com.apple.Preview" {
        guard let document = string(window,kAXDocumentAttribute), let url = pdfURL(document), url.isFileURL,
              let root = previewDocumentRoot(window) else { return nil }
        return DocumentEvidence(document: url.absoluteString,root: root,viewer: nil)
    }
    guard brokerMode, browserBundles.contains(app.bundleIdentifier ?? "") else { return nil }
    return browserDocument(window,app)
}
func sameEvidence(_ a: DocumentEvidence, _ b: DocumentEvidence) -> Bool {
    guard a.document == b.document, CFEqual(a.root,b.root) else { return false }
    if let left = a.viewer, let right = b.viewer { return CFEqual(left,right) }
    if case .none = a.viewer, case .none = b.viewer { return true }
    return false
}
func trusted() throws {
    guard AXIsProcessTrusted() else { throw Refusal.permission }
}
func targets(onlyPID: pid_t? = nil) throws -> [Target] {
    try trusted()
    guard let rows = CGWindowListCopyWindowInfo([.optionAll, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else { throw Refusal.unavailable }
    var result: [Target] = []
    var windowCache: [pid_t:[AXUIElement]] = [:]
    for row in rows {
        guard let number = row[kCGWindowNumber as String] as? UInt32,
              let pid = row[kCGWindowOwnerPID as String] as? Int32,
              (onlyPID.map { $0 == pid } ?? true),
              let layer = row[kCGWindowLayer as String] as? Int, layer == 0,
              let app = NSRunningApplication(processIdentifier: pid), (["com.apple.Preview"] + browserBundles).contains(app.bundleIdentifier ?? ""),
              let launched = processBirthMilliseconds(pid),
              let bounds = row[kCGWindowBounds as String] as? NSDictionary,
              let cgRect = CGRect(dictionaryRepresentation: bounds as CFDictionary), cgRect.width > 0, cgRect.height > 0 else { continue }
        if windowCache[pid] == nil {
            let axApp = AXUIElementCreateApplication(pid)
            AXUIElementSetMessagingTimeout(axApp,0.75)
            // Read once per process per scan, not once per CG window. A cold
            // browser under native CI load can legitimately need >100 ms.
            _ = string(axApp,kAXRoleAttribute)
            windowCache[pid] = attribute(axApp,kAXWindowsAttribute) as? [AXUIElement] ?? []
        }
        guard let windows = windowCache[pid], !windows.isEmpty else { continue }
        // AX exposes no public window-number attribute. Require a unique exact
        // geometry match within this process; duplicates are never controllable.
        let matched = windows.filter { candidate in
            guard let frame = rect(candidate) else { return false }
            return abs(frame.minX-cgRect.minX) < 1 && abs(frame.minY-cgRect.minY) < 1 && abs(frame.width-cgRect.width) < 1 && abs(frame.height-cgRect.height) < 1
        }
        guard matched.count == 1 else { continue }
        let window = matched[0]
        guard let evidence = documentEvidence(window,app), let url = URL(string: evidence.document) else { continue }
        let name = url.lastPathComponent
        guard !name.isEmpty else { continue }
        let previous = retainedTargets.first { $0.number == number && $0.pid == pid && $0.launched == launched && CFEqual($0.window,window) && sameEvidence($0.evidence,evidence) }
        let nonce = brokerMode ? UUID().uuidString : "preview-cli"
        let stable = "pdf-v2\n\(pid)\n\(launched)\n\(number)\n\(evidence.document)\n\(nonce)"
        let digest = previous?.binding ?? SHA256.hash(data: Data(stable.utf8)).map { String(format: "%02x", $0) }.joined()
        result.append(Target(number: number, pid: pid, launched: launched, app: app, window: window, evidence: evidence, name: name, binding: digest))
    }
    if brokerMode {
        let untouched = onlyPID.map { pid in retainedTargets.filter { $0.pid != pid } } ?? []
        retainedTargets = Array((untouched + result).prefix(64))
    }
    return result
}
func bound(_ args: [String]) throws -> Target {
    guard args.count >= 3, let id = UInt32(args[1]), id > 0, args[2].count == 64,
          args[2].allSatisfy({ "0123456789abcdef".contains($0) }) else { throw Refusal.command }
    let owner = retainedTargets.first { $0.number == id && $0.binding == args[2] }
    let matches = try targets(onlyPID:owner?.pid).filter { $0.number == id && $0.binding == args[2] }
    guard matches.count == 1 else { throw Refusal.stale }
    return matches[0]
}
func safeContentRole(_ role: String, browser: Bool) -> Bool {
    (browser ? ["AXWebArea","AXGroup","AXScrollArea","AXLayoutArea","AXStaticText"] : ["AXGroup","AXPage","AXStaticText","AXImage","AXScrollArea","AXLayoutArea"]).contains(role)
}
func blockedFocus(_ role: String, _ subrole: String?) -> Bool {
    ["AXTextField","AXTextArea","AXComboBox","AXSearchField","AXSheet","AXDialog"].contains(role) ||
    ["AXDialog","AXSystemDialog","AXApplicationDialog","AXApplicationAlertDialog"].contains(subrole ?? "")
}
func focusedPDF(_ target: Target) throws {
    guard NSWorkspace.shared.frontmostApplication?.processIdentifier == target.pid,
          CGEventSource.flagsState(.combinedSessionState).intersection([.maskCommand,.maskControl,.maskAlternate,.maskShift]).isEmpty else { throw Refusal.foreground }
    let axApp = AXUIElementCreateApplication(target.pid)
    AXUIElementSetMessagingTimeout(axApp,0.75)
    guard let focusedWindow = element(axApp,kAXFocusedWindowAttribute), CFEqual(focusedWindow,target.window),
          let focused = element(axApp,kAXFocusedUIElementAttribute),
          let role = string(focused,kAXRoleAttribute),
          safeContentRole(role,browser: target.evidence.viewer.map { _ in true } ?? false) else { throw Refusal.foreground }
    let browser = target.evidence.viewer.map { _ in true } ?? false
    let ownScroller = !browser && previewNearestScroller(target.evidence.root,target.window).map { CFEqual($0,focused) } == true
    var parent: AXUIElement? = focused
    var sawRoot = ownScroller, sawPage = false
    var sawViewer = !browser
    for _ in 0..<40 {
        guard let node = parent, let nodeRole = string(node,kAXRoleAttribute) else { break }
        let subrole = string(node,kAXSubroleAttribute)
        if blockedFocus(nodeRole,subrole) || (attribute(node,"AXEditable") as? Bool) == true { throw Refusal.foreground }
        if nodeRole == "AXPage" { sawPage = true }
        if CFEqual(node,target.evidence.root) {
            sawRoot = true
            if !browser, !previewFocusMember(exactContainer:CFEqual(focused,node),reachedContainer:true,pageAncestor:sawPage,nearestScroller:ownScroller) { throw Refusal.foreground }
        }
        if let viewer = target.evidence.viewer, CFEqual(node,viewer) { sawViewer = true }
        if CFEqual(node,target.window) {
            guard sawRoot && sawViewer else { throw Refusal.foreground }
            return
        }
        parent = element(node,kAXParentAttribute)
    }
    throw Refusal.foreground
}
// Developer/CI fixture only. Creates its own browser profile and PDF and never
// activates, navigates or closes a user's existing browser process.
func fixturePDF() -> Data {
    let stream1 = "BT /F1 32 Tf 72 720 Td (CastLink fixture page 1) Tj ET\n"
    let stream2 = "BT /F1 32 Tf 72 720 Td (CastLink fixture page 2) Tj ET\n"
    let objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>",
        "<< /Length \(stream1.utf8.count) >>\nstream\n" + stream1 + "endstream",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>",
        "<< /Length \(stream2.utf8.count) >>\nstream\n" + stream2 + "endstream",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
    ]
    var output = "%PDF-1.4\n"; var offsets = [0]
    for (index,object) in objects.enumerated() { offsets.append(output.utf8.count); output += "\(index+1) 0 obj\n\(object)\nendobj\n" }
    let xref = output.utf8.count
    output += "xref\n0 \(objects.count+1)\n0000000000 65535 f \n"
    for offset in offsets.dropFirst() { output += String(format:"%010d 00000 n \n",offset) }
    output += "trailer\n<< /Size \(objects.count+1) /Root 1 0 R >>\nstartxref\n\(xref)\n%%EOF\n"
    return Data(output.utf8)
}
func fixtureObservation(_ target: Target, observed: (([String:Any]) -> Void)? = nil) -> String? {
    let root = target.evidence.viewer ?? target.window
    guard let nodes = browserTree(root,viewers(target.app),includeContent:true) else { observed?(["treeReadable":false,"root":"retained-pdf-viewer"]); return nil }
    var values: [String] = []
    var scrollValues = 0, fixtureTextValues = 0
    for node in nodes {
        if node.role == "AXScrollBar", let value = attribute(node.element,kAXValueAttribute) as? NSNumber { values.append("scroll:" + value.stringValue); scrollValues += 1 }
        let text = string(node.element,kAXValueAttribute) ?? string(node.element,kAXTitleAttribute) ?? ""
        if text.contains("CastLink fixture page"), let bounds = rect(node.element) { values.append(text + ":" + String(describing:bounds)); fixtureTextValues += 1 }
    }
    observed?(["treeReadable":true,"root":"retained-pdf-viewer","nodes":nodes.count,"scrollValues":scrollValues,"fixtureTextValues":fixtureTextValues,"finishedLaunching":target.app.isFinishedLaunching])
    guard !values.isEmpty else { return nil }
    return SHA256.hash(data:Data(values.sorted().joined(separator:"\n").utf8)).map { String(format:"%02x",$0) }.joined()
}
func ownedBrowser(_ executable: URL, _ profile: URL, _ url: URL, newWindow: Bool = true) throws -> Process {
    guard fixtureHasWork() else { throw Refusal.command }
    let process = Process(); process.executableURL = executable
    process.arguments = ["--user-data-dir="+profile.path,"--no-first-run","--no-default-browser-check","--disable-background-mode","--force-renderer-accessibility"] + (newWindow ? ["--new-window"] : []) + [url.absoluteString]
    process.standardOutput = FileHandle.nullDevice; process.standardError = FileHandle.nullDevice
    try process.run(); return process
}
func finishOwned(_ process: Process) {
    guard process.isRunning else { return }
    process.terminate()
    let deadline = Date().addingTimeInterval(2)
    while process.isRunning && Date() < deadline { Thread.sleep(forTimeInterval:0.05) }
    if process.isRunning { kill(process.processIdentifier,SIGKILL) }
    process.waitUntilExit()
}
// Diagnostics are restricted to a process launched by this fixture. No title,
// text value, query, fragment, path, profile directory or user URL is emitted.
func fixtureURLSummary(_ raw: String?, _ fixture: URL) -> [String:Any]? {
    guard let raw = raw, let url = URL(string:raw) else { return nil }
    var value: [String:Any] = ["scheme":url.scheme ?? "","host":url.host ?? "","extension":url.pathExtension.lowercased()]
    if pdfURL(raw) == fixture.standardizedFileURL.resolvingSymlinksInPath() { value["ownedFixture"] = true; value["filename"] = "CastLink-fixture.pdf" }
    return value
}
func fixtureDiagnostics(_ owned: Process, _ fixture: URL) -> [String:Any] {
    let pid = owned.processIdentifier
    var output: [String:Any] = ["ownedProcessRunning":owned.isRunning,"kernelBirthAvailable":processBirthMilliseconds(pid) != nil]
    guard owned.isRunning, let app = NSRunningApplication(processIdentifier:pid) else { output["stage"] = "owned-running-application-unavailable"; return output }
    output["bundleIdentifier"] = app.bundleIdentifier ?? "unavailable"
    output["viewerIDs"] = viewers(app).sorted()
    let application = AXUIElementCreateApplication(pid)
    AXUIElementSetMessagingTimeout(application,0.75)
    output["applicationRole"] = string(application,kAXRoleAttribute) ?? "unavailable"
    output["applicationAXTimeoutMilliseconds"] = 750
    output["finishedLaunching"] = app.isFinishedLaunching
    output["active"] = app.isActive
    var rawWindows: CFTypeRef?
    let windowStatus = AXUIElementCopyAttributeValue(application,kAXWindowsAttribute as CFString,&rawWindows)
    output["windowsReadCode"] = windowStatus.rawValue
    guard windowStatus == .success, let windows = rawWindows as? [AXUIElement] else { output["stage"] = "ax-windows-unavailable"; return output }
    let rows = (CGWindowListCopyWindowInfo([.optionAll,.excludeDesktopElements],kCGNullWindowID) as? [[String:Any]] ?? []).filter { ($0[kCGWindowOwnerPID as String] as? Int32) == pid && ($0[kCGWindowLayer as String] as? Int) == 0 }
    output["cgWindowCount"] = rows.count; output["axWindowCount"] = windows.count
    var reports: [[String:Any]] = []
    for window in windows.prefix(4) {
        var report: [String:Any] = ["role":string(window,kAXRoleAttribute) ?? "unavailable"]
        if let frame = rect(window) {
            report["geometryMatches"] = rows.filter { row in
                guard let raw = row[kCGWindowBounds as String] as? NSDictionary, let bounds = CGRect(dictionaryRepresentation:raw as CFDictionary) else { return false }
                return abs(frame.minX-bounds.minX)<1 && abs(frame.minY-bounds.minY)<1 && abs(frame.width-bounds.width)<1 && abs(frame.height-bounds.height)<1
            }.count
        }
        if let doc = fixtureURLSummary(string(window,kAXDocumentAttribute),fixture) { report["document"] = doc }
        if let nodes = browserTree(window,viewers(app)) {
            report["productionTreeNodes"] = nodes.count
            report["trustedViewerNodes"] = nodes.filter { $0.role == "AXWebArea" && trustedViewer($0.url ?? "",viewers(app)) }.count
            report["originalPDFNodes"] = nodes.filter { pdfURL($0.url ?? "") != nil }.count
            report["proofCount"] = browserProofs(nodes,viewers(app)).count
        } else { report["productionTree"] = "unavailable-or-bounded-out" }
        var records: [[String:Any]] = []
        var queue: [(AXUIElement,Int?,Int)] = [(window,nil,0)]
        var offset = 0
        while offset < queue.count && offset < 256 && fixtureHasWork() {
            let (node,parent,depth) = queue[offset]; let index = offset; offset += 1
            var record: [String:Any] = ["index":index,"depth":depth,"role":string(node,kAXRoleAttribute) ?? "unavailable"]
            if let parent = parent { record["parent"] = parent }
            if let subrole = string(node,kAXSubroleAttribute) { record["subrole"] = subrole }
            if let raw = attribute(node,"AXURL") { record["urlType"] = CFGetTypeID(raw) == CFURLGetTypeID() ? "CFURL" : CFGetTypeID(raw) == CFStringGetTypeID() ? "CFString" : "other" }
            if let raw = urlAttribute(node), var url = fixtureURLSummary(raw,fixture) {
                // Exact built-in extension resources are public application
                // code paths, not document paths; queries remain redacted.
                if let parsed = URL(string:raw), ["chrome-extension","edge-extension","extension"].contains(parsed.scheme ?? ""), viewers(app).contains(parsed.host ?? ""), parsed.user == nil, parsed.password == nil {
                    url["builtinResourcePath"] = String(parsed.path.prefix(256))
                }
                record["url"] = url
            }
            if let document = fixtureURLSummary(string(node,kAXDocumentAttribute),fixture) { record["document"] = document }
            var value: CFTypeRef?
            let read = AXUIElementCopyAttributeValue(node,kAXChildrenAttribute as CFString,&value)
            record["childrenReadCode"] = read.rawValue
            if read == .success, let children = value as? [AXUIElement] {
                record["childCount"] = children.count
                if depth < 24 && queue.count < 256 { for child in children.prefix(min(64,256-queue.count)) { queue.append((child,index,depth+1)) } }
            }
            records.append(record)
        }
        report["nodes"] = records; report["diagnosticBoundReached"] = offset < queue.count || records.count == 256
        reports.append(report)
    }
    output["windows"] = reports; output["stage"] = "owned-ax-evidence-captured"
    return output
}
func fixtureBackoff(_ attempt: Int) -> Double { [0.1,0.2,0.4,0.8][min(max(attempt,0),3)] }
func fixtureBindingDeadline(_ started: Date, _ ready: Date?) -> Date {
    fixtureBound(min(started.addingTimeInterval(36),ready?.addingTimeInterval(6) ?? started.addingTimeInterval(30)))
}
func fixtureAXReady(finishedLaunching: Bool, roleCode: AXError, windowsCode: AXError, windows: Int) -> Bool {
    finishedLaunching && roleCode == .success && windowsCode == .success && windows > 0
}
func fixtureReadiness(_ owned: Process) -> (Bool,[String:Any]) {
    let started = Date()
    guard fixtureHasWork() else { return (false,["stage":"fixture-work-deadline"]) }
    var report: [String:Any] = ["running":owned.isRunning,"accessibilityPermission":AXIsProcessTrusted(),"timeoutMilliseconds":750]
    guard owned.isRunning, let app = NSRunningApplication(processIdentifier:owned.processIdentifier) else { report["stage"] = "launch-services-pending"; return (false,report) }
    report["finishedLaunching"] = app.isFinishedLaunching; report["active"] = app.isActive
    let application = AXUIElementCreateApplication(owned.processIdentifier)
    AXUIElementSetMessagingTimeout(application,0.75)
    var role: CFTypeRef?, windows: CFTypeRef?
    let roleCode = AXUIElementCopyAttributeValue(application,kAXRoleAttribute as CFString,&role)
    let windowsCode = AXUIElementCopyAttributeValue(application,kAXWindowsAttribute as CFString,&windows)
    report["roleReadCode"] = roleCode.rawValue; report["windowsReadCode"] = windowsCode.rawValue
    let count = (windows as? [AXUIElement])?.count ?? 0
    report["windowCount"] = count; report["elapsedMilliseconds"] = Int(Date().timeIntervalSince(started)*1000)
    return (fixtureAXReady(finishedLaunching:app.isFinishedLaunching,roleCode:roleCode,windowsCode:windowsCode,windows:count),report)
}
func fixtureRect(_ value: CGRect?) -> [String:Any] {
    guard let value = value, !value.isNull, [value.minX,value.minY,value.width,value.height].allSatisfy({ $0.isFinite }) else { return ["available":false] }
    return ["available":true,"x":Double(value.minX),"y":Double(value.minY),"width":Double(value.width),"height":Double(value.height)]
}
func modalMetadata(_ role: String, _ subrole: String?) -> Bool {
    ["AXSheet","AXDialog"].contains(role) || ["AXDialog","AXSystemDialog","AXApplicationDialog","AXApplicationAlertDialog"].contains(subrole ?? "")
}
func uniqueModalChild(_ children: [(String,String?)]) -> Bool { children.filter { modalMetadata($0.0,$0.1) }.count == 1 }
func fixtureOwnedDialog(_ target: Target) -> Bool? {
    let application = AXUIElementCreateApplication(target.pid)
    AXUIElementSetMessagingTimeout(application,0.75)
    guard NSWorkspace.shared.frontmostApplication?.processIdentifier == target.pid,
          let window = element(application,kAXFocusedWindowAttribute),
          let windows = attribute(application,kAXWindowsAttribute) as? [AXUIElement], windows.contains(where:{ CFEqual($0,window) }) else { return nil }
    var windowPID: pid_t = 0
    guard AXUIElementGetPid(window,&windowPID) == .success, windowPID == target.pid,
          let windowRole = string(window,kAXRoleAttribute) else { return nil }
    if modalMetadata(windowRole,string(window,kAXSubroleAttribute)) { return true }
    // Intel Chrome's owned alert has AXWindow/AXUnknown with exactly one
    // AXApplicationAlertDialog child and no focused UI element. That direct
    // public AX child proves the dialog even when focus ancestry is absent.
    guard let children = attribute(window,kAXChildrenAttribute) as? [AXUIElement], children.count <= 64 else { return nil }
    var metadata: [(String,String?)] = []
    for child in children { guard let role = string(child,kAXRoleAttribute) else { return nil }; metadata.append((role,string(child,kAXSubroleAttribute))) }
    if uniqueModalChild(metadata) { return true }
    guard !metadata.contains(where:{ modalMetadata($0.0,$0.1) }),
          var ancestor = element(application,kAXFocusedUIElementAttribute) else { return nil }
    var modal = false
    for _ in 0..<32 {
        guard let role = string(ancestor,kAXRoleAttribute) else { return nil }
        modal = modal || modalMetadata(role,string(ancestor,kAXSubroleAttribute))
        if CFEqual(ancestor,window) { return modal }
        guard let parent = element(ancestor,kAXParentAttribute) else { return nil }
        ancestor = parent
    }
    return nil
}
func fixtureEscapeOwnedDialog(_ target: Target) -> Bool {
    guard fixtureHasWork(), fixtureOwnedDialog(target) == true, processBirthMilliseconds(target.pid) == target.launched,
          CGEventSource.flagsState(.hidSystemState).intersection([.maskCommand,.maskControl,.maskAlternate,.maskShift]).isEmpty,
          !CGEventSource.keyState(.hidSystemState,key:CGKeyCode(kVK_Escape)),
          let down = CGEvent(keyboardEventSource:nil,virtualKey:CGKeyCode(kVK_Escape),keyDown:true),
          let up = CGEvent(keyboardEventSource:nil,virtualKey:CGKeyCode(kVK_Escape),keyDown:false) else { return false }
    // Cancel only an exact owned browser dialog, never approve a button or
    // send input to an external/system prompt or a user's browser process.
    down.flags = []; up.flags = []; down.postToPid(target.pid); up.postToPid(target.pid)
    return true
}
func fixtureFocusState(_ target: Target, _ content: AXUIElement) -> [String:Any] {
    guard fixtureHasWork() else { return ["reason":"fixture-work-deadline"] }
    let application = AXUIElementCreateApplication(target.pid)
    AXUIElementSetMessagingTimeout(application,0.75)
    let focusedWindow = element(application,kAXFocusedWindowAttribute)
    let focused = element(application,kAXFocusedUIElementAttribute)
    let contentBounds = rect(content), windowBounds = rect(target.window)
    var report: [String:Any] = ["frontmostMatches":NSWorkspace.shared.frontmostApplication?.processIdentifier == target.pid,
        "active":target.app.isActive,"focusedWindowReadable":focusedWindow != nil,
        "focusedWindowMatches":focusedWindow.map { CFEqual($0,target.window) } ?? false,
        "focusedElementReadable":focused != nil,"contentRect":fixtureRect(contentBounds),"windowRect":fixtureRect(windowBounds)]
    if let window = focusedWindow { report["focusedWindowRole"] = string(window,kAXRoleAttribute) ?? "unavailable"; report["focusedWindowSubrole"] = string(window,kAXSubroleAttribute) ?? "none"; report["focusedWindowRect"] = fixtureRect(rect(window)) }
    if let focused = focused { report["focusedElementRole"] = string(focused,kAXRoleAttribute) ?? "unavailable"; report["focusedElementSubrole"] = string(focused,kAXSubroleAttribute) ?? "none" }
    if let dialog = fixtureOwnedDialog(target) { report["ownedDialogFocused"] = dialog }
    else { report["ownedDialogMetadata"] = "unavailable" }
    if let content = contentBounds, let window = windowBounds { report["intersectionRect"] = fixtureRect(content.intersection(window)) }
    return report
}
func fixtureContentFocus(_ target: Target) -> [String:Any] {
    guard let viewer = target.evidence.viewer,
          let nodes = browserTree(viewer,viewers(target.app),includeContent:true) else { return ["status":"FAILED","reason":"Owned PDF content tree unavailable"] }
    var content: AXUIElement = viewer
    var bestDepth = -1
    for node in nodes where node.role == "AXWebArea" && !CFEqual(node.element,viewer) {
        var parent = node.parent; var depth = 0
        for _ in 0..<32 {
            guard let index = parent else { break }
            if CFEqual(nodes[index].element,viewer) { if depth > bestDepth { content = node.element; bestDepth = depth }; break }
            parent = nodes[index].parent; depth += 1
        }
    }
    let activationAccepted = target.app.activate(options:[.activateIgnoringOtherApps])
    let raiseCode = AXUIElementPerformAction(target.window,kAXRaiseAction as CFString)
    let deadline = fixtureUntil(2)
    var states: [[String:Any]] = [], escaped = false
    repeat {
        let state = fixtureFocusState(target,content)
        if states.count == 12 { states.removeFirst() }; states.append(state)
        if state["frontmostMatches"] as? Bool == true, state["focusedWindowMatches"] as? Bool == true, state["ownedDialogFocused"] as? Bool == false { break }
        if !escaped, fixtureEscapeOwnedDialog(target) {
            escaped = true
            RunLoop.current.run(until:Date().addingTimeInterval(0.1))
            _ = AXUIElementPerformAction(target.window,kAXRaiseAction as CFString)
        }
        RunLoop.current.run(until:Date().addingTimeInterval(0.1))
    } while Date() < deadline
    var result: [String:Any] = ["activationAccepted":activationAccepted,"raiseCode":raiseCode.rawValue,"states":states,"ownedDialogEscapeCount":escaped ? 1 : 0]
    guard let last = states.last, last["frontmostMatches"] as? Bool == true, last["focusedWindowMatches"] as? Bool == true, last["ownedDialogFocused"] as? Bool == false,
          let bounds = rect(content), let windowBounds = rect(target.window), !bounds.intersection(windowBounds).isNull else { result["status"] = "NOT VERIFIED"; result["reason"] = "Owned PDF focus or geometry unavailable after bounded activation wait"; return result }
    let visible = bounds.intersection(windowBounds)
    guard visible.width >= 10, visible.height >= 10,
          let down = CGEvent(mouseEventSource:nil,mouseType:.leftMouseDown,mouseCursorPosition:CGPoint(x:visible.midX,y:visible.midY),mouseButton:.left),
          let up = CGEvent(mouseEventSource:nil,mouseType:.leftMouseUp,mouseCursorPosition:CGPoint(x:visible.midX,y:visible.midY),mouseButton:.left),
          processBirthMilliseconds(target.pid) == target.launched else { result["status"] = "FAILED"; result["reason"] = "Owned PDF click geometry or lifetime changed"; return result }
    down.flags = []; up.flags = []; down.postToPid(target.pid); up.postToPid(target.pid)
    let postClickDeadline = fixtureUntil(2)
    var postClickStates: [[String:Any]] = []
    repeat {
        RunLoop.current.run(until:Date().addingTimeInterval(0.1))
        let state = fixtureFocusState(target,content)
        if postClickStates.count == 12 { postClickStates.removeFirst() }; postClickStates.append(state)
        do {
            try focusedPDF(target)
            result["status"] = "VERIFIED"; result["method"] = "owned-process-pdf-content-click"; result.removeValue(forKey:"reason")
            break
        } catch { result["status"] = "NOT VERIFIED"; result["reason"] = (error as? Refusal)?.rawValue ?? "UNAVAILABLE" }
        if !escaped, fixtureEscapeOwnedDialog(target) {
            escaped = true
            RunLoop.current.run(until:Date().addingTimeInterval(0.1))
            _ = AXUIElementPerformAction(target.window,kAXRaiseAction as CFString)
        }
    } while Date() < postClickDeadline
    result["afterClick"] = postClickStates.last ?? [:]
    result["postClickStates"] = postClickStates
    result["ownedDialogEscapeCount"] = escaped ? 1 : 0
    return result
}
let browserRequiredProofs = ["documentIdentity","contentFocus","navigation","editableFocusRefusal","sameURLTabRefusal"]
func browserFixtureVerdict(installed: Bool, accessibilityPermission: Bool, proofs: [String:String]) -> String {
    if !installed || !accessibilityPermission { return "NOT VERIFIED" }
    return browserRequiredProofs.allSatisfy { proofs[$0] == "VERIFIED" } ? "VERIFIED" : "FAILED"
}
func browserFixture() throws -> Any {
    let previousDeadline = fixtureWorkDeadline
    fixtureWorkDeadline = Date().addingTimeInterval(100)
    defer { fixtureWorkDeadline = previousDeadline }
    var reports: [[String:Any]] = []
    for bundleID in browserBundles {
        var report: [String:Any] = ["browser":bundleID,"osOperationVerified":false]
        guard let appURL = NSWorkspace.shared.urlForApplication(withBundleIdentifier:bundleID), let executable = Bundle(url:appURL)?.executableURL else { report["installed"] = false; report["status"] = "NOT VERIFIED"; report["reason"] = "Browser not installed"; reports.append(report); continue }
        report["installed"] = true
        guard AXIsProcessTrusted() else { report["status"] = "NOT VERIFIED"; report["reason"] = "Accessibility permission unavailable"; reports.append(report); continue }
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("castlink-browser-pdf-"+UUID().uuidString,isDirectory:true)
        try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
        defer { try? FileManager.default.removeItem(at:directory) }
        let profile = directory.appendingPathComponent("profile",isDirectory:true), pdf = directory.appendingPathComponent("CastLink-fixture.pdf")
        try fixturePDF().write(to:pdf,options:.atomic)
        let owned = try ownedBrowser(executable,profile,pdf)
        do {
            defer { finishOwned(owned); try? FileManager.default.removeItem(at:directory) }
            brokerMode = true
            var selected: Target?
            let started = Date()
            var firstAXReady: Date?
            var attempt = 0, activated = false
            var readiness: [[String:Any]] = []
            while Date() < fixtureBindingDeadline(started,firstAXReady) && owned.isRunning {
                if !activated, let application = NSRunningApplication(processIdentifier:owned.processIdentifier), application.isFinishedLaunching {
                    activated = application.activate(options:[.activateIgnoringOtherApps])
                }
                let (ready,record) = fixtureReadiness(owned)
                var probe = record
                if ready {
                    if firstAXReady == nil { firstAXReady = Date() }
                    let scanStarted = Date()
                    let matches = try targets(onlyPID:owned.processIdentifier).filter { $0.document == pdf.standardizedFileURL.resolvingSymlinksInPath().absoluteString }
                    selected = matches.first
                    probe["phase"] = "pdf-content-readiness"; probe["matchingPDFTargets"] = matches.count
                    probe["targetReadMilliseconds"] = Int(Date().timeIntervalSince(scanStarted)*1000)
                } else { probe["phase"] = firstAXReady == nil ? "application-readiness" : "pdf-content-readiness" }
                if readiness.count == 20 { readiness.removeFirst() }; readiness.append(probe)
                if selected != nil { break }
                let deadline = fixtureBindingDeadline(started,firstAXReady)
                RunLoop.current.run(until:Date().addingTimeInterval(min(fixtureBackoff(attempt),max(0,deadline.timeIntervalSinceNow))))
                attempt += 1
            }
            report["bindingWaitMilliseconds"] = Int(Date().timeIntervalSince(started)*1000)
            report["readiness"] = readiness
            guard let target = selected else {
                let permission = AXIsProcessTrusted(); report["accessibilityPermission"] = permission
                report["status"] = browserFixtureVerdict(installed:true,accessibilityPermission:permission,proofs:[:])
                report["reason"] = permission ? "Installed browser with granted Accessibility did not bind the fixture PDF" : "Accessibility permission unavailable"
                report["diagnostics"] = fixtureDiagnostics(owned,pdf); reports.append(report); continue
            }
            report["documentIdentity"] = "VERIFIED"
            report["contentFocus"] = fixtureContentFocus(target)
            RunLoop.current.run(until:Date().addingTimeInterval(0.1))
            var before = fixtureObservation(target) { report["navigationBaselineObservation"] = $0 }
            let contentDeadline = fixtureUntil(4)
            while before == nil && Date() < contentDeadline {
                RunLoop.current.run(until:Date().addingTimeInterval(0.1)); before = fixtureObservation(target) { report["navigationBaselineObservation"] = $0 }
            }
            report["navigationBaselineAvailable"] = before != nil
            do {
                // A delayed owned alert can settle during content readiness.
                // Revalidate actual focus without another click/Escape or any
                // navigation retry; this is the authoritative pre-effect proof.
                let focusDeadline = fixtureUntil(2)
                var focusValidated = false
                repeat {
                    do { try focusedPDF(target); focusValidated = true; break } catch {}
                    RunLoop.current.run(until:Date().addingTimeInterval(0.1))
                } while Date() < focusDeadline
                guard focusValidated, fixtureHasWork() else { throw Refusal.foreground }
                var focus = report["contentFocus"] as? [String:Any] ?? [:]
                focus["acquisitionStatus"] = focus["status"]
                if let reason = focus["reason"] { focus["acquisitionReason"] = reason; focus.removeValue(forKey:"reason") }
                focus["status"] = "VERIFIED"; focus["preNavigationFocusGuard"] = "VERIFIED"
                report["contentFocus"] = focus
                _ = try run(["step",String(target.number),target.binding,"next",String(Int(Date().timeIntervalSince1970*1000)+2500)])
                var after: String?
                let effectDeadline = fixtureUntil(4)
                repeat {
                    RunLoop.current.run(until:Date().addingTimeInterval(0.1)); after = fixtureObservation(target) { report["navigationAfterObservation"] = $0 }
                    if let first = before, let last = after, first != last { break }
                } while Date() < effectDeadline
                report["navigationAfterAvailable"] = after != nil
                if let first = before, let last = after, first != last { report["navigation"] = "VERIFIED"; report["navigationEvidence"] = "Observed scroll or PDF text-position change"; report["osOperationVerified"] = true }
                else { report["navigation"] = "NOT VERIFIED"; report["navigationReason"] = "No observable content change" }
            } catch { report["navigation"] = "NOT VERIFIED"; report["navigationReason"] = (error as? Refusal)?.rawValue ?? "UNAVAILABLE"; report["diagnostics"] = fixtureDiagnostics(owned,pdf) }
            // Focus an editable browser control, not its PDF renderer. The
            // production focus fence must refuse a PageDown in that control.
            if let nodes = browserTree(target.window,viewers(target.app)), let editable = nodes.first(where:{ ["AXTextField","AXComboBox"].contains($0.role) }) {
                let focusSet = AXUIElementSetAttributeValue(editable.element,kAXFocusedAttribute as CFString,kCFBooleanTrue)
                report["editableFocusSetCode"] = focusSet.rawValue
                var actualMatches = false
                if focusSet == .success {
                    let deadline = fixtureUntil(2)
                    repeat {
                        if let actual = element(AXUIElementCreateApplication(target.pid),kAXFocusedUIElementAttribute), CFEqual(actual,editable.element) { actualMatches = true; break }
                        RunLoop.current.run(until:Date().addingTimeInterval(0.1))
                    } while Date() < deadline
                }
                report["editableFocusActualMatches"] = actualMatches
                if actualMatches {
                    do { try focusedPDF(target); report["editableFocusRefusal"] = "FAILED" }
                    catch { report["editableFocusRefusal"] = "VERIFIED" }
                } else { report["editableFocusRefusal"] = "NOT VERIFIED" }
            }
            let other = try ownedBrowser(executable,profile,pdf,newWindow:false)
            defer { finishOwned(other) }
            let replacedDeadline = fixtureUntil(3)
            var stale = false
            while Date() < replacedDeadline {
                do { _ = try bound(["status",String(target.number),target.binding]) }
                catch { stale = true; break }
                Thread.sleep(forTimeInterval:0.1)
            }
            report["sameURLTabRefusal"] = stale ? "VERIFIED" : "NOT VERIFIED"
            var proofs = Dictionary(uniqueKeysWithValues:browserRequiredProofs.map { ($0,report[$0] as? String ?? "NOT VERIFIED") })
            proofs["contentFocus"] = (report["contentFocus"] as? [String:Any])?["status"] as? String ?? "NOT VERIFIED"
            let permission = AXIsProcessTrusted(); report["accessibilityPermission"] = permission
            report["status"] = browserFixtureVerdict(installed:true,accessibilityPermission:permission,proofs:proofs)
            report["incompleteProofs"] = browserRequiredProofs.filter { proofs[$0] != "VERIFIED" }
            if !permission { report["reason"] = "Accessibility permission unavailable" }
        } catch {
            let permission = AXIsProcessTrusted(); report["accessibilityPermission"] = permission
            report["status"] = browserFixtureVerdict(installed:true,accessibilityPermission:permission,proofs:[:])
            report["reason"] = permission ? (error as? Refusal)?.rawValue ?? "UNAVAILABLE" : "Accessibility permission unavailable"
        }
        reports.append(report)
    }
    let statuses = reports.map { $0["status"] as? String ?? "NOT VERIFIED" }
    let status = statuses.contains("FAILED") ? "FAILED" : statuses.allSatisfy({ $0 == "VERIFIED" }) ? "VERIFIED" : "NOT VERIFIED"
    return ["protocol":1,"fixture":"isolated-browser-pdf","status":status,"browsers":reports] as [String:Any]
}
func run(_ args: [String]) throws -> Any {
    guard let operation = args.first else { throw Refusal.command }
    if operation == "--browser-fixture" { guard args.count == 1 else { throw Refusal.command }; return try browserFixture() }
    if operation == "--self-test" {
        let id = "mhjfbmdgcfjbbpaeojofohoefgiehjai"
        let key = "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDN6hM0rsDYGbzQPQfOygqlRtQgKUXMfnSjhIBL7LnReAVBEd7ZmKtyN2qmSasMl4HZpMhVe2rPWVVwBDl6iyNE/Kok6E6v6V3vCLGsOpQAuuNVye/3QxzIldzG/jQAdWZiyXReRVapOhZtLjGfywCvlWq7Sl/e3sbc0vWybSDI2QIDAQAB"
        let manifest = try JSONSerialization.data(withJSONObject:["key":key,"mime_types":["application/pdf"],"permissions":["pdfViewerPrivate"],"mime_types_handler":"index.html"])
        var pack = Data([5,0,0,0,1,0,0,0,1,0,0,0,1,0,24,0,0,0,0,0])
        let end = 24+manifest.count
        for shift in [0,8,16,24] { pack.append(UInt8((end >> shift)&255)) }
        pack.append(manifest)
        let fake = AXUIElementCreateApplication(getpid())
        let original = BrowserNode(element:fake,parent:nil,role:"AXWebArea",url:"file:///tmp/fixture.pdf")
        let viewer = BrowserNode(element:fake,parent:0,role:"AXWebArea",url:"chrome-extension://"+id+"/index.html")
        let spoof = BrowserNode(element:fake,parent:0,role:"AXWebArea",url:"https://example.test/"+id+"/index.html")
        let completeProofs = Dictionary(uniqueKeysWithValues:browserRequiredProofs.map { ($0,"VERIFIED") })
        var incompleteProofs = completeProofs; incompleteProofs["navigation"] = "NOT VERIFIED"
        var missingFocusProof = completeProofs; missingFocusProof.removeValue(forKey:"contentFocus")
        let redacted = fixtureURLSummary("https://private:password@example.test/private/customer.pdf?secret=hidden#token",URL(fileURLWithPath:"/tmp/CastLink-fixture.pdf"))
        guard !fixtureAXReady(finishedLaunching:false,roleCode:.success,windowsCode:.success,windows:1),
              fixtureAXReady(finishedLaunching:true,roleCode:.success,windowsCode:.success,windows:1),
              !fixtureAXReady(finishedLaunching:true,roleCode:.cannotComplete,windowsCode:.success,windows:1),
              browserFixtureVerdict(installed:true,accessibilityPermission:true,proofs:completeProofs) == "VERIFIED",
              browserFixtureVerdict(installed:true,accessibilityPermission:true,proofs:incompleteProofs) == "FAILED",
              browserFixtureVerdict(installed:true,accessibilityPermission:true,proofs:missingFocusProof) == "FAILED",
              browserFixtureVerdict(installed:true,accessibilityPermission:true,proofs:[:]) == "FAILED",
              browserFixtureVerdict(installed:false,accessibilityPermission:true,proofs:[:]) == "NOT VERIFIED",
              browserFixtureVerdict(installed:true,accessibilityPermission:false,proofs:completeProofs) == "NOT VERIFIED",
              redacted?["scheme"] as? String == "https", redacted?["host"] as? String == "example.test", redacted?["extension"] as? String == "pdf", redacted?.count == 3,
              fixtureBindingDeadline(Date(timeIntervalSince1970:0),nil).timeIntervalSince1970 == 30,
              fixtureBindingDeadline(Date(timeIntervalSince1970:0),Date(timeIntervalSince1970:28)).timeIntervalSince1970 == 34,
              fixtureBindingDeadline(Date(timeIntervalSince1970:0),Date(timeIntervalSince1970:35)).timeIntervalSince1970 == 36,
              uniqueModalChild([("AXGroup","AXApplicationAlertDialog")]),
              !uniqueModalChild([("AXGroup",nil)]),
              !uniqueModalChild([("AXGroup","AXApplicationAlertDialog"),("AXGroup","AXApplicationAlertDialog")]),
              modalMetadata("AXGroup","AXApplicationAlertDialog"), modalMetadata("AXSheet",nil),
              !modalMetadata("AXTextField",nil), !modalMetadata("AXWindow","AXStandardWindow"),
              fixtureRect(CGRect.null)["available"] as? Bool == false,
              fixtureBackoff(-1) == 0.1, fixtureBackoff(0) == 0.1, fixtureBackoff(1) == 0.2, fixtureBackoff(1000) == 0.8,
              previewFocusMember(exactContainer:true,reachedContainer:true,pageAncestor:false,nearestScroller:false),
              previewFocusMember(exactContainer:false,reachedContainer:true,pageAncestor:true,nearestScroller:false),
              !previewFocusMember(exactContainer:false,reachedContainer:true,pageAncestor:false,nearestScroller:false),
              !previewFocusMember(exactContainer:false,reachedContainer:false,pageAncestor:true,nearestScroller:false),
              previewFocusMember(exactContainer:false,reachedContainer:false,pageAncestor:false,nearestScroller:true),
              processBirthSelfTest(), builtinViewerIDs("com.google.Chrome") == [id], builtinViewerIDs("com.microsoft.edgemac") == [id], builtinViewerIDs("com.example.fake").isEmpty,
              !prunePDFContent(role:"AXGroup",url:"file:///tmp/fixture.pdf",originalWebAreaFound:true,ids:[id],includeContent:false),
              prunePDFContent(role:"AXWebArea",url:viewer.url,originalWebAreaFound:true,ids:[id],includeContent:false),
              !prunePDFContent(role:"AXWebArea",url:viewer.url,originalWebAreaFound:false,ids:[id],includeContent:false),
              !prunePDFContent(role:"AXWebArea",url:viewer.url,originalWebAreaFound:true,ids:[id],includeContent:true),
              browserProofs([original,viewer],[id]).count == 1,
              browserProofs([original],[id]).isEmpty,
              browserProofs([original,spoof],[id]).isEmpty,
              browserProofs([original,viewer,viewer],[id]).count == 2,
              UInt32("4294967296") == nil, pdfURL("file:///tmp/a.pdf") != nil,
              pdfURL("https://example.test/a.PDF#page=2")?.fragment == nil,
              pdfURL("https://example.test/a.pdf.exe") == nil,
              pdfURL("https://private@example.test/a.pdf") == nil,
              trustedViewer("chrome-extension://"+id+"/index.html",[id]),
              trustedViewer("chrome-extension://"+id+"/edge_pdf/index.html",[id]),
              !trustedViewer("chrome-extension://"+id+"/other.html",[id]),
              !trustedViewer("chrome-extension://"+id+"/edge_pdf/other.html",[id]),
              !trustedViewer("chrome-extension://"+id+"/index.html/other",[id]),
              !trustedViewer("https://example.test/"+id+"/index.html",[id]),
              !trustedViewer("chrome-extension://untrusted/index.html",[id]),
              viewerID(manifest) == id, packResources(pack).count == 1,
              packResources(Data([5,0,0,0])).isEmpty,
              safeContentRole("AXWebArea",browser:true),
              !safeContentRole("AXTextField",browser:true), blockedFocus("AXComboBox",nil),
              blockedFocus("AXGroup","AXApplicationDialog") else { throw Refusal.command }
        return ["protocol":1,"selfTest":"passed","browserPDFContract":"passed","processBirthVerified":true,"osOperationVerified":false] as [String:Any]
    }
    if operation == "list" { guard args.count == 1 else { throw Refusal.command }; return Array(try targets().prefix(64)).map(\.json) }
    let target = try bound(args)
    if operation == "status" { guard args.count == 3 else { throw Refusal.command }; return target.json }
    if operation == "activate" {
        guard args.count == 3, liveOwner() else { throw Refusal.command }
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
    guard deadline > Date().timeIntervalSince1970 * 1000, liveOwner(), fixtureHasWork() else { throw Refusal.command }
    let code: CGKeyCode = args[3] == "next" ? 121 : 116
    guard let down = CGEvent(keyboardEventSource: nil, virtualKey: code, keyDown: true),
          let up = CGEvent(keyboardEventSource: nil, virtualKey: code, keyDown: false) else { throw Refusal.unavailable }
    down.flags = []; up.flags = []
    down.postToPid(verified.pid); up.postToPid(verified.pid)
    return try bound(args).json
}
@main
struct WindowSlidesMain {
static func main() {
do {
    if CommandLine.arguments.count == 2 && CommandLine.arguments[1] == "--server" {
        brokerMode = true
        while let line = readLine(strippingNewline: true) {
            guard liveOwner(), line.utf8.count <= 16384, let data = line.data(using: .utf8),
                  let request = try JSONSerialization.jsonObject(with: data) as? [String:Any],
                  request.count == 2, let requestID = request["requestId"] as? Int, requestID > 0,
                  let args = request["args"] as? [String], args.count <= 5,
                  args.allSatisfy({ $0.utf8.count <= 4096 }),
                  ["list","status","activate","step"].contains(args.first ?? "") else { throw Refusal.command }
            let value: Any
            do { value = try run(args) } catch { value = ["error": (error as? Refusal)?.rawValue ?? Refusal.unavailable.rawValue] }
            let output = try JSONSerialization.data(withJSONObject: ["requestId":requestID,"value":value],options:[.sortedKeys])
            FileHandle.standardOutput.write(output); FileHandle.standardOutput.write(Data([10]))
        }
    } else {
        let value = try run(Array(CommandLine.arguments.dropFirst()))
        let data = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
        FileHandle.standardOutput.write(data)
        if CommandLine.arguments.dropFirst().elementsEqual(["--browser-fixture"]), (value as? [String:Any])?["status"] as? String == "FAILED" { exit(1) }
    }
} catch {
    let code = (error as? Refusal)?.rawValue ?? Refusal.unavailable.rawValue
    FileHandle.standardOutput.write(try! JSONSerialization.data(withJSONObject: ["error": code]))
    exit(1)
}

}
}
