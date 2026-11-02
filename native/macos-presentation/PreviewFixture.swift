import AppKit
import ApplicationServices
import CoreText
import PDFKit
import Darwin

// Native QA only. Creates a PDF and an independent system Preview instance.
// Every AX read, event and cleanup is restricted to its verified process birth.
@main enum PreviewFixture {
    static let applicationURL = URL(fileURLWithPath: "/System/Applications/Preview.app").resolvingSymlinksInPath()
    static var directory: URL?
    static var documentURL: URL?
    static var owned: NSRunningApplication?
    static var birth: Int64?
    static var previousPIDs = Set<pid_t>()
    static var retainedProofWindow: AXUIElement?
    static var retainedProofRoot: AXUIElement?
    static var stopping = false
    static var lastTreeDiagnostics: [String:Any] = [:]
    static func emit(_ object: [String:Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject:object,options:[.sortedKeys]) else { return }
        FileHandle.standardOutput.write(data); FileHandle.standardOutput.write(Data([10]))
    }
    static func value(_ node: AXUIElement, _ name: String) -> CFTypeRef? {
        var result: CFTypeRef?
        guard AXUIElementCopyAttributeValue(node,name as CFString,&result) == .success else { return nil }
        return result
    }
    static func node(_ owner: AXUIElement, _ name: String) -> AXUIElement? {
        guard let raw = value(owner,name), CFGetTypeID(raw) == AXUIElementGetTypeID() else { return nil }
        return (raw as! AXUIElement)
    }
    static func frame(_ owner: AXUIElement) -> CGRect? {
        guard let p = value(owner,kAXPositionAttribute), let s = value(owner,kAXSizeAttribute), CFGetTypeID(p) == AXValueGetTypeID(), CFGetTypeID(s) == AXValueGetTypeID() else { return nil }
        var point = CGPoint.zero; var size = CGSize.zero
        guard AXValueGetValue(p as! AXValue,.cgPoint,&point), AXValueGetValue(s as! AXValue,.cgSize,&size) else { return nil }
        return CGRect(origin:point,size:size)
    }
    static func existingPIDs() -> Set<pid_t>? {
        let count = proc_listallpids(nil,0)
        guard count > 0, count < 1_000_000 else { return nil }
        var pids = [pid_t](repeating:0,count:Int(count)+1024)
        let copied = pids.withUnsafeMutableBytes { proc_listallpids($0.baseAddress,Int32($0.count)) }
        guard copied > 0, Int(copied) < pids.count else { return nil }
        return Set(pids.prefix(Int(copied)).filter { $0 > 0 })
    }
    static func isOwned() -> Bool {
        guard let app = owned, let started = birth else { return false }
        return !previousPIDs.contains(app.processIdentifier) && !app.isTerminated &&
            app.bundleIdentifier == "com.apple.Preview" && app.bundleURL?.resolvingSymlinksInPath() == applicationURL &&
            processBirthMilliseconds(app.processIdentifier) == started
    }
    static func application() -> AXUIElement? {
        guard isOwned(), let app = owned else { return nil }
        let result = AXUIElementCreateApplication(app.processIdentifier)
        AXUIElementSetMessagingTimeout(result,0.35)
        return result
    }
    static func ownWindow() -> AXUIElement? {
        guard let app = application(), let document = documentURL,
              let windows = value(app,kAXWindowsAttribute) as? [AXUIElement] else { return nil }
        let matches = windows.filter {
            guard let raw = value($0,kAXDocumentAttribute) as? String, let url = URL(string:raw) else { return false }
            return url.standardizedFileURL.resolvingSymlinksInPath() == document
        }
        return matches.count == 1 ? matches[0] : nil
    }
    static func tree(_ root: AXUIElement) -> [AXUIElement]? {
        var queue: [(AXUIElement,Int)] = [(root,0)], result: [AXUIElement] = []
        var offset = 0
        let started = Date(), deadline = started.addingTimeInterval(3)
        lastTreeDiagnostics = [:]
        while offset < queue.count {
            guard queue.count <= 768, Date() < deadline else {
                lastTreeDiagnostics = ["reason":queue.count > 768 ? "node-bound" : "read-deadline","visited":offset,"queued":queue.count,"elapsedMilliseconds":Int(Date().timeIntervalSince(started)*1000)]
                return nil
            }
            let (item,depth) = queue[offset]; offset += 1
            guard depth <= 28 else { lastTreeDiagnostics = ["reason":"depth-bound","depth":depth,"visited":offset]; return nil }
            result.append(item)
            let children = value(item,kAXChildrenAttribute) as? [AXUIElement] ?? []
            guard children.count <= 256 else { lastTreeDiagnostics = ["reason":"child-bound","children":children.count,"visited":offset]; return nil }
            for child in children { queue.append((child,depth+1)) }
        }
        return result
    }
    static func rectMetadata(_ bounds: CGRect?) -> [String:Any] {
        guard let bounds = bounds, !bounds.isNull, [bounds.minX,bounds.minY,bounds.width,bounds.height].allSatisfy({ $0.isFinite }) else { return ["available":false] }
        return ["available":true,"x":Double(bounds.minX),"y":Double(bounds.minY),"width":Double(bounds.width),"height":Double(bounds.height)]
    }
    static func metadata(_ item: AXUIElement) -> [String:Any] {
        var result: [String:Any] = ["role":value(item,kAXRoleAttribute) as? String ?? "unavailable","rect":rectMetadata(frame(item))]
        if let subrole = value(item,kAXSubroleAttribute) as? String { result["subrole"] = subrole }
        if let editable = value(item,"AXEditable") as? Bool { result["editable"] = editable }
        return result
    }
    static func focusDiagnostics(_ current: AXUIElement) -> [String:Any] {
        guard let app = application() else { return ["ownedProcessValid":false] }
        let focusedWindow = node(app,kAXFocusedWindowAttribute)
        var result: [String:Any] = ["ownedProcessValid":true,"frontmostMatches":NSWorkspace.shared.frontmostApplication?.processIdentifier == owned?.processIdentifier,
            "focusedWindowMatches":focusedWindow.map { CFEqual($0,current) } ?? false,"ownedWindow":metadata(current)]
        if let focusedWindow = focusedWindow { result["focusedWindow"] = metadata(focusedWindow) }
        var ancestry: [[String:Any]] = []
        var ancestor = node(app,kAXFocusedUIElementAttribute)
        let until = Date().addingTimeInterval(1)
        for _ in 0..<20 {
            guard let item = ancestor, Date() < until else { break }
            var itemMetadata = metadata(item)
            itemMetadata["ownedWindowMatches"] = CFEqual(item,current)
            ancestry.append(itemMetadata)
            if CFEqual(item,current) { break }
            ancestor = node(item,kAXParentAttribute)
        }
        result["focusedAncestry"] = ancestry
        return result
    }
    static func diagnostics() -> [String:Any] {
        guard let current = ownWindow() else {
            var result: [String:Any] = ["ok":false,"error":"owned-window-unavailable","ownedProcessValid":isOwned(),"finishedLaunching":owned?.isFinishedLaunching ?? false,"active":owned?.isActive ?? false]
            if let app = application() {
                var raw: CFTypeRef?
                let code = AXUIElementCopyAttributeValue(app,kAXWindowsAttribute as CFString,&raw)
                result["windowsReadCode"] = code.rawValue
                result["windowCount"] = (raw as? [AXUIElement])?.count ?? 0
            }
            return result
        }
        var result = focusDiagnostics(current)
        var queue: [(AXUIElement,Int?,Int)] = [(current,nil,0)], records: [[String:Any]] = []
        var offset = 0
        let until = Date().addingTimeInterval(2)
        while offset < queue.count && offset < 128 && Date() < until {
            let (item,parent,depth) = queue[offset]; let index = offset; offset += 1
            var record = metadata(item); record["index"] = index; record["depth"] = depth
            if let parent = parent { record["parent"] = parent }
            let children = value(item,kAXChildrenAttribute) as? [AXUIElement] ?? []
            record["childCount"] = children.count
            if depth < 20 && queue.count < 128 {
                for child in children.prefix(min(64,128-queue.count)) { queue.append((child,index,depth+1)) }
            }
            records.append(record)
        }
        result["ok"] = true; result["nodes"] = records; result["boundReached"] = offset < queue.count || records.count == 128
        return result
    }
    static func pdfContainers(_ nodes: [AXUIElement]) -> [AXUIElement] {
        nodes.filter { item in
            guard value(item,kAXRoleAttribute) as? String == "AXGroup",
                  value(item,kAXSubroleAttribute) as? String == "AXSharedDocumentContainer",
                  let children = value(item,kAXChildrenAttribute) as? [AXUIElement], !children.isEmpty, children.count <= 256 else { return false }
            // Observed native Preview PDFKit container: real AXPage children,
            // distinct from the thumbnail sidebar's AXList/AXImage subtree.
            return children.allSatisfy { value($0,kAXRoleAttribute) as? String == "AXPage" }
        }
    }
    static func pdfContentFocused(_ current: AXUIElement, _ nodes: [AXUIElement]) -> Bool {
        guard foregroundWindow() != nil, let app = application(), let focused = node(app,kAXFocusedUIElementAttribute) else { return false }
        let containers = pdfContainers(nodes)
        guard containers.count == 1, let container = containers.first else { return false }
        var sawContainer = false, ancestor: AXUIElement? = focused
        for _ in 0..<28 {
            guard let item = ancestor, let role = value(item,kAXRoleAttribute) as? String else { return false }
            let subrole = value(item,kAXSubroleAttribute) as? String ?? ""
            if ["AXTextField","AXTextArea","AXComboBox","AXSearchField","AXSheet","AXDialog"].contains(role) ||
               ["AXDialog","AXSystemDialog","AXApplicationDialog","AXApplicationAlertDialog"].contains(subrole) ||
               value(item,"AXEditable") as? Bool == true { return false }
            if CFEqual(item,container) { sawContainer = true }
            if CFEqual(item,current) { return sawContainer }
            ancestor = node(item,kAXParentAttribute)
        }
        return false
    }
    static func proofIdentity(capture: Bool) -> [String:Any] {
        guard let current = ownWindow(), let nodes = tree(current) else { return ["ok":false,"error":"owned-proof-unavailable","ownedProcessValid":isOwned()] }
        let containers = pdfContainers(nodes)
        guard containers.count == 1, let root = containers.first else { return ["ok":false,"error":"owned-proof-container-ambiguous","containerCount":containers.count] }
        if capture { retainedProofWindow = current; retainedProofRoot = root }
        guard let previousWindow = retainedProofWindow, let previousRoot = retainedProofRoot else { return ["ok":false,"error":"owned-proof-not-captured"] }
        return ["ok":true,"ownedProcessValid":isOwned(),"sameOwnedWindow":CFEqual(previousWindow,current),"samePDFRoot":CFEqual(previousRoot,root),"containerCount":containers.count]
    }
    static func snapshot() -> [String:Any] {
        guard let current = ownWindow() else { return ["ok":false,"error":"owned-window-not-ready","ownedProcessValid":isOwned()] }
        guard let nodes = tree(current) else { return ["ok":false,"error":"owned-tree-unavailable","tree":lastTreeDiagnostics,"focus":focusDiagnostics(current)] }
        var observations: [String] = []
        var roles: [String:Int] = [:]
        let deadline = Date().addingTimeInterval(2)
        for item in nodes {
            guard Date() < deadline else { return ["ok":false,"error":"owned-snapshot-deadline","observedNodeCount":roles.values.reduce(0,+),"totalNodeCount":nodes.count,"roles":roles] }
            let role = value(item,kAXRoleAttribute) as? String ?? "unknown"
            roles[role,default:0] += 1
            if role == "AXScrollBar", let number = value(item,kAXValueAttribute) as? NSNumber, number.doubleValue.isFinite {
                let orientation = value(item,kAXOrientationAttribute) as? String ?? "unknown"
                observations.append("scroll:\(orientation):\(number.doubleValue)")
            }
            // Only our generated page markers may be returned as text evidence.
            let text = (value(item,kAXValueAttribute) as? String) ?? (value(item,kAXTitleAttribute) as? String) ?? ""
            for page in 1...3 where text.contains("CastLink Preview fixture page \(page)") {
                if let bounds = frame(item), let outer = frame(current), bounds.intersects(outer) {
                    observations.append("marker:\(page):\(Int(bounds.minX)):\(Int(bounds.minY)):\(Int(bounds.width)):\(Int(bounds.height))")
                }
            }
        }
        let app = application()
        let focused = app.flatMap { node($0,kAXFocusedUIElementAttribute) }
        return ["ok":true,"observations":observations.sorted(),"nodeCount":nodes.count,"roles":roles,
                "frontmostMatches":NSWorkspace.shared.frontmostApplication?.processIdentifier == owned?.processIdentifier,
                "focusRole":focused.flatMap { value($0,kAXRoleAttribute) as? String } ?? "unavailable",
                "focus":focusDiagnostics(current),"pdfContentFocused":pdfContentFocused(current,nodes)]
    }
    static func foregroundWindow() -> AXUIElement? {
        guard let app = application(), let current = ownWindow(),
              NSWorkspace.shared.frontmostApplication?.processIdentifier == owned?.processIdentifier,
              let focusedWindow = node(app,kAXFocusedWindowAttribute), CFEqual(current,focusedWindow) else { return nil }
        return current
    }
    static func postKey(_ code: CGKeyCode, flags: CGEventFlags = []) -> Bool {
        guard foregroundWindow() != nil, let pid = owned?.processIdentifier,
              CGEventSource.flagsState(.combinedSessionState).intersection([.maskCommand,.maskControl,.maskAlternate,.maskShift]).isEmpty,
              let down = CGEvent(keyboardEventSource:nil,virtualKey:code,keyDown:true),
              let up = CGEvent(keyboardEventSource:nil,virtualKey:code,keyDown:false) else { return false }
        down.flags = flags; up.flags = flags; down.postToPid(pid); up.postToPid(pid)
        return true
    }
    static func focusContent() -> [String:Any] {
        guard let current = ownWindow() else { return ["ok":false,"error":"owned-window-unavailable"] }
        guard foregroundWindow() != nil, let nodes = tree(current), let pid = owned?.processIdentifier, let outer = frame(current) else { return ["ok":false,"error":"owned-window-not-focused","focus":focusDiagnostics(current)] }
        // Preserve Preview's real initial PDF focus. Focusing its enclosing
        // scroll area moves AX focus to the window on macOS 26, so do not alter
        // a proven shared PDF document container that already owns focus.
        let containers = pdfContainers(nodes)
        if pdfContentFocused(current,nodes) {
            return ["ok":true,"method":"preserved-owned-PDF-container-focus","containerCount":containers.count,"focus":focusDiagnostics(current)]
        }
        let choices = containers.isEmpty ? nodes.filter { ["AXScrollArea","AXLayoutArea"].contains(value($0,kAXRoleAttribute) as? String ?? "") } : containers
        let content = choices.compactMap { item -> (AXUIElement,CGRect)? in
            guard let bounds = frame(item) else { return nil }; let visible = bounds.intersection(outer)
            return visible.isNull || visible.width < 100 || visible.height < 100 ? nil : (item,visible)
        }.max {
            let leftLayout = (value($0.0,kAXRoleAttribute) as? String) == "AXLayoutArea"
            let rightLayout = (value($1.0,kAXRoleAttribute) as? String) == "AXLayoutArea"
            return leftLayout != rightLayout ? !leftLayout : $0.1.width * $0.1.height < $1.1.width * $1.1.height
        }
        guard let (item,bounds) = content else { return ["ok":false,"error":"owned-pdf-content-unavailable","focus":focusDiagnostics(current)] }
        let focusCode = AXUIElementSetAttributeValue(item,kAXFocusedAttribute as CFString,kCFBooleanTrue)
        if let app = application(), let focused = node(app,kAXFocusedUIElementAttribute),
           CFEqual(focused,item), pdfContentFocused(current,nodes) {
            return ["ok":true,"method":"owned-content-AX-focus","selectedContent":metadata(item),"visibleRect":rectMetadata(bounds),"focusSetCode":focusCode.rawValue,"candidateCount":choices.count,"focus":focusDiagnostics(current)]
        }
        // Click in visible content, always process-targeted and birth-checked.
        guard isOwned(), let down = CGEvent(mouseEventSource:nil,mouseType:.leftMouseDown,mouseCursorPosition:CGPoint(x:bounds.midX,y:bounds.midY),mouseButton:.left),
              let up = CGEvent(mouseEventSource:nil,mouseType:.leftMouseUp,mouseCursorPosition:CGPoint(x:bounds.midX,y:bounds.midY),mouseButton:.left) else { return ["ok":false,"error":"owned-content-click-unavailable"] }
        down.flags = []; up.flags = []; down.postToPid(pid); up.postToPid(pid)
        return ["ok":true,"method":"owned-content-process-targeted-click","selectedContent":metadata(item),"visibleRect":rectMetadata(bounds),"focusSetCode":focusCode.rawValue,"candidateCount":choices.count,"focus":focusDiagnostics(current)]
    }
    static func makeDocument(_ url: URL) throws -> Int {
        var media = CGRect(x:0,y:0,width:612,height:792)
        guard let context = CGContext(url as CFURL,mediaBox:&media,nil) else { throw NSError(domain:"fixture-pdf",code:1) }
        for page in 1...3 {
            context.beginPDFPage(nil)
            let text = "CastLink Preview fixture page \(page)"
            let font = CTFontCreateWithName("Helvetica" as CFString,26,nil)
            let line = CTLineCreateWithAttributedString(NSAttributedString(string:text,attributes:[NSAttributedString.Key(kCTFontAttributeName as String):font]))
            context.textPosition = CGPoint(x:40,y:700); CTLineDraw(line,context)
            context.endPDFPage()
        }
        context.closePDF()
        guard let document = PDFDocument(url:url), document.pageCount == 3 else { throw NSError(domain:"fixture-pdf",code:2) }
        return document.pageCount
    }
    static func finish(_ reply: [String:Any]? = nil) {
        guard !stopping else { return }; stopping = true
        if isOwned(), let app = owned {
            _ = app.terminate()
            let until = Date().addingTimeInterval(2)
            while isOwned() && Date() < until { RunLoop.current.run(until:Date().addingTimeInterval(0.05)) }
            if isOwned() {
                _ = app.forceTerminate()
                let forcedUntil = Date().addingTimeInterval(1)
                while isOwned() && Date() < forcedUntil { RunLoop.current.run(until:Date().addingTimeInterval(0.05)) }
            }
        }
        if let directory = directory { try? FileManager.default.removeItem(at:directory) }
        if var reply = reply {
            reply["ownedProcessTerminated"] = !isOwned()
            emit(reply)
        }
        exit(0)
    }
    static func command(_ request: [String:Any]) {
        let id = request["id"] as? Int ?? 0
        var result: [String:Any]
        switch request["op"] as? String {
        case "snapshot": result = snapshot()
        case "diagnostics": result = diagnostics()
        case "captureProof": result = proofIdentity(capture:true)
        case "proofIdentity": result = proofIdentity(capture:false)
        case "verifyWindow":
            let requested = (request["windowHandle"] as? String).flatMap(UInt32.init)
            let rows = CGWindowListCopyWindowInfo([.optionAll,.excludeDesktopElements],kCGNullWindowID) as? [[String:Any]] ?? []
            let matches = rows.filter { row in
                guard let requested = requested, let current = ownWindow(), let actual = frame(current),
                      (row[kCGWindowNumber as String] as? NSNumber)?.uint32Value == requested,
                      (row[kCGWindowOwnerPID as String] as? NSNumber)?.int32Value == owned?.processIdentifier,
                      let raw = row[kCGWindowBounds as String] as? NSDictionary,
                      let bounds = CGRect(dictionaryRepresentation:raw as CFDictionary) else { return false }
                return abs(actual.minX-bounds.minX)<1 && abs(actual.minY-bounds.minY)<1 && abs(actual.width-bounds.width)<1 && abs(actual.height-bounds.height)<1
            }
            result = ["ok":isOwned() && matches.count == 1]
        case "focus": result = focusContent()
        case "editable": result = ["ok":postKey(3,flags:.maskCommand)] // Cmd-F, owned Preview search
        case "cancelEditable":
            if let app = application(), let focused = node(app,kAXFocusedUIElementAttribute),
               ["AXTextField","AXTextArea","AXComboBox","AXSearchField"].contains(value(focused,kAXRoleAttribute) as? String ?? "") {
                result = ["ok":postKey(53)] // Escape only the exact owned document's editable search.
            } else { result = ["ok":false,"error":"owned-editable-focus-unavailable"] }
        case "close":
            if let current = ownWindow(), let close = node(current,kAXCloseButtonAttribute), isOwned() {
                result = ["ok":AXUIElementPerformAction(close,kAXPressAction as CFString) == .success]
            } else { result = ["ok":false,"error":"owned-close-unavailable"] }
        case "closed": result = ["ok":true,"closed":ownWindow() == nil]
        case "quit": finish(["id":id,"ok":true]); return
        default: result = ["ok":false,"error":"fixture-command"]
        }
        result["id"] = id; emit(result)
    }
    static func main() {
        guard CommandLine.arguments.count == 1 else { emit(["event":"failed","reason":"No external paths accepted"]); return }
        guard AXIsProcessTrusted(), let session = CGSessionCopyCurrentDictionary() as? [String:Any], session[kCGSessionOnConsoleKey as String] as? Bool == true else {
            emit(["event":"unavailable","reason":"Accessibility permission or console session unavailable"]); return
        }
        _ = NSApplication.shared; NSApp.setActivationPolicy(.prohibited)
        guard Bundle(url:applicationURL)?.bundleIdentifier == "com.apple.Preview" else { emit(["event":"unavailable","reason":"System Preview is unavailable"]); return }
        do {
            let temp = FileManager.default.temporaryDirectory.appendingPathComponent("CastLink-preview-" + UUID().uuidString,isDirectory:true)
            try FileManager.default.createDirectory(at:temp,withIntermediateDirectories:false)
            directory = temp
            let pdf = temp.appendingPathComponent("CastLink-Preview-fixture-" + UUID().uuidString + ".pdf")
            documentURL = pdf.standardizedFileURL.resolvingSymlinksInPath()
            let pages = try makeDocument(pdf)
            guard let existing = existingPIDs() else {
                emit(["event":"failed","reason":"Kernel process snapshot unavailable before launch"]); finish(); return
            }
            previousPIDs = existing.union(NSWorkspace.shared.runningApplications.map(\.processIdentifier))
            let configuration = NSWorkspace.OpenConfiguration()
            configuration.createsNewApplicationInstance = true; configuration.activates = true
            configuration.arguments = ["-ApplePersistenceIgnoreState","YES"]
            NSWorkspace.shared.open([pdf],withApplicationAt:applicationURL,configuration:configuration) { app,error in
                guard error == nil, let app = app, !previousPIDs.contains(app.processIdentifier), app.bundleIdentifier == "com.apple.Preview",
                      app.bundleURL?.resolvingSymlinksInPath() == applicationURL,
                      let started = processBirthMilliseconds(app.processIdentifier) else {
                    emit(["event":"failed","reason":"Independent exact Preview launch identity failed"]); finish(); return
                }
                owned = app; birth = started
                emit(["event":"ready","pid":app.processIdentifier,"kernelBirth":started,"notPreexisting":true,"exactSystemBundle":true,"documentName":pdf.lastPathComponent,"generatedPDFPages":pages])
            }
            DispatchQueue(label:"preview-fixture.stdin").async {
                while let line = readLine() {
                    guard line.utf8.count <= 1024, let data = line.data(using:.utf8), let request = try? JSONSerialization.jsonObject(with:data) as? [String:Any] else { continue }
                    DispatchQueue.main.async { command(request) }
                }
                DispatchQueue.main.async { finish() }
            }
            DispatchQueue.main.asyncAfter(deadline:.now()+90) { emit(["event":"failed","reason":"Preview fixture deadline exceeded"]); finish() }
            NSApp.run()
        } catch { emit(["event":"failed","reason":"Owned Preview PDF fixture setup failed"]); finish() }
    }
}
