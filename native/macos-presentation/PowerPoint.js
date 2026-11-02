/* Fixed JXA entrypoint. The only input is one JSON data argument. No source,
 * shell fragment, arbitrary AppleEvent, or renderer-selected path is accepted.
 * Required terms are checked against the INSTALLED Office dictionary before
 * use. This is deliberately a fail-closed candidate pending real Office tests.
 */
ObjC.import('Foundation');
ObjC.import('AppKit');
ObjC.import('CoreFoundation');
function fail(code) { var error = new Error(code); error.safeCode = code; throw error; }
function unwrap(value) { return ObjC.unwrap(value); }
function camel(term) { return term.replace(/ ([a-z])/g, function (_, c) { return c.toUpperCase(); }); }
function read(owner, term) { return owner[camel(term)](); }
function requireDictionary(bundle) {
    var name = unwrap(bundle.objectForInfoDictionaryKey('OSAScriptingDefinition')) || 'PowerPoint.sdef';
    if (typeof name !== 'string' || !name || name.indexOf('/') !== -1) fail('POWERPOINT_DICTIONARY_UNAVAILABLE');
    var url = bundle.URLForResourceWithExtension(name.replace(/\.sdef$/, ''), 'sdef');
    if (!url) fail('POWERPOINT_DICTIONARY_UNAVAILABLE');
    var xml = $.NSXMLDocument.alloc.initWithContentsOfURLOptionsError(url, 0, null);
    if (!xml) fail('POWERPOINT_DICTIONARY_UNAVAILABLE');
    function exists(xpath) { var nodes = xml.nodesForXPathError(xpath, null); return nodes && Number(nodes.count) > 0; }
    // These terms are from the extracted Office dictionary cited in PROTOCOL.
    // Native AX/CGWindow + process lifetime bind the show; scripting indexes
    // and titles are never treated as native window identity.
    var properties = {
        'presentation': ['full name', 'name', 'slide show settings'],
        'slide show window': ['presentation', 'slideshow view', 'left position', 'top', 'width', 'height'],
        'slide show view': ['slide'],
        'slide': ['slide index']
    };
    Object.keys(properties).forEach(function (klass) {
        properties[klass].forEach(function (property) {
            if (!exists("//class[@name='" + klass + "']/property[@name='" + property + "']")) fail('POWERPOINT_DICTIONARY_UNAVAILABLE');
        });
    });
    ['run slide show', 'go to next slide', 'go to previous slide'].forEach(function (command) {
        if (!exists("//command[@name='" + command + "']")) fail('POWERPOINT_DICTIONARY_UNAVAILABLE');
    });
    if (!exists("//class[@name='presentation']/element[@type='slide']")) fail('POWERPOINT_DICTIONARY_UNAVAILABLE');
}
function localDocument(value) {
    if (typeof value !== 'string' || !value) fail('POWERPOINT_SOURCE_MISMATCH');
    var url;
    if (value.indexOf('file://') === 0) url = $.NSURL.URLWithString(value);
    else if (value.charAt(0) === '/') url = $.NSURL.fileURLWithPath(value);
    else if (value.indexOf(':') > 0 && value.indexOf('://') === -1) {
        var hfs = $.CFURLCreateWithFileSystemPath(null, $(value), $.kCFURLHFSPathStyle, false);
        if (!hfs) fail('POWERPOINT_SOURCE_MISMATCH');
        url = $.NSURL.URLWithString(unwrap($.CFURLGetString(hfs)));
    } else fail('POWERPOINT_SOURCE_MISMATCH');
    if (!url || !url.isFileURL) fail('POWERPOINT_SOURCE_MISMATCH');
    return unwrap(url.URLByStandardizingPath.URLByResolvingSymlinksInPath.absoluteString);
}
function nativeIdentity(payload) {
    var argv = $.NSProcessInfo.processInfo.arguments;
    // Adapter always invokes /usr/bin/osascript -l JavaScript <fixed script>.
    var scripts = [];
    for (var i=0;i<Number(argv.count);i++) {
        var candidate = unwrap(argv.objectAtIndex(i));
        if (typeof candidate === 'string' && candidate.charAt(0) === '/' && /\/PowerPoint\.js$/.test(candidate)) scripts.push(candidate);
    }
    if (scripts.length !== 1) fail('POWERPOINT_NATIVE_UNAVAILABLE');
    var script = scripts[0];
    var task = $.NSTask.alloc.init;
    task.executableURL = $.NSURL.fileURLWithPath(script.replace(/PowerPoint\.js$/, 'CastLink.PowerPointIdentity'));
    task.arguments = $([JSON.stringify(payload)]);
    var pipe = $.NSPipe.pipe;
    task.standardOutput = pipe;
    task.standardError = $.NSFileHandle.fileHandleWithNullDevice;
    if (!task.launchAndReturnError(null)) fail('POWERPOINT_NATIVE_UNAVAILABLE');
    var data = pipe.fileHandleForReading.readDataToEndOfFile;
    task.waitUntilExit;
    if (Number(data.length) > 16384) fail('POWERPOINT_UNAVAILABLE');
    var raw = unwrap($.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding));
    var result;
    try { result = JSON.parse(raw); } catch (_) { fail('POWERPOINT_UNAVAILABLE'); }
    if (result.error) fail(result.error);
    if (task.terminationStatus !== 0) fail('POWERPOINT_UNAVAILABLE');
    return result;
}
function snapshot(app, show, request) {
    var presentation = read(show, 'presentation');
    var view = read(show, 'slideshow view');
    var page = Number(read(read(view, 'slide'), 'slide index'));
    var pages = Number(read(presentation, 'slides').length);
    if (!Number.isInteger(page) || !Number.isInteger(pages) || page < 1 || page > pages || pages > 2147483647) fail('POWERPOINT_UNAVAILABLE');
    var identity = nativeIdentity({
        document: localDocument(read(presentation, 'full name')),
        geometry: ['left position', 'top', 'width', 'height'].map(function (term) { return Number(read(show, term)); }),
        selectedWindowHandle: request.selectedWindowHandle,
        operation: request.nativeOperation,
        page: request.page,
        expiresAt: request.expiresAt,
        windowHandle: request.windowHandle,
        binding: request.binding
    });
    var name = String(read(presentation, 'name'));
    return { windowHandle: identity.windowHandle, binding: identity.binding, name: name, page: page, pages: pages };
}
function selectedShow(app, request) {
    var shows = read(app, 'slide show windows');
    if (!shows.length) fail('POWERPOINT_NO_SLIDESHOW');
    if (!request.windowHandle && !request.selectedWindowHandle) {
        if (shows.length !== 1) fail('POWERPOINT_AMBIGUOUS');
        return { show: shows[0], status: snapshot(app, shows[0], request) };
    }
    var matches = [];
    shows.forEach(function (show) {
        try { matches.push({ show: show, status: snapshot(app, show, request) }); }
        catch (error) {
            if (['POWERPOINT_SOURCE_MISMATCH', 'POWERPOINT_STALE'].indexOf(error.safeCode) === -1) throw error;
        }
    });
    if (matches.length !== 1) fail(request.binding ? 'POWERPOINT_STALE' : 'POWERPOINT_SOURCE_MISMATCH');
    return matches[0];
}
function execute(request) {
    if (!request || ['start', 'status', 'goto', 'step'].indexOf(request.operation) === -1) fail('POWERPOINT_COMMAND');
    var allowed = ['operation', 'windowHandle', 'binding', 'page', 'filePath', 'direction', 'expiresAt', 'selectedWindowHandle', 'requireUniqueShow'];
    if (Object.keys(request).some(function (key) { return allowed.indexOf(key) === -1; })) fail('POWERPOINT_COMMAND');
    var bundleURL = $.NSWorkspace.sharedWorkspace.URLForApplicationWithBundleIdentifier('com.microsoft.Powerpoint');
    if (!bundleURL) fail('POWERPOINT_NATIVE_UNAVAILABLE');
    requireDictionary($.NSBundle.bundleWithURL(bundleURL));
    var app = Application('com.microsoft.Powerpoint');
    if (request.operation === 'start') {
        if (typeof request.filePath !== 'string' || request.filePath.charAt(0) !== '/' || !/\.pptx$/i.test(request.filePath) || /[\u0000-\u001f]/.test(request.filePath)) fail('POWERPOINT_FILE');
        var document = localDocument(request.filePath);
        app.launch();
        var existing = read(app, 'presentations').filter(function (item) { return localDocument(read(item, 'full name')) === document; });
        if (existing.length > 1) fail('POWERPOINT_AMBIGUOUS');
        if (!existing.length) {
            app.open(Path(request.filePath));
            existing = read(app, 'presentations').filter(function (item) { return localDocument(read(item, 'full name')) === document; });
        }
        if (existing.length !== 1) fail('POWERPOINT_UNAVAILABLE');
        // Opening an existing file never saves, closes, converts or overwrites it.
        var before = read(app, 'slide show windows');
        var matching = before.filter(function (show) { return localDocument(read(read(show, 'presentation'), 'full name')) === document; });
        if (matching.length > 1) fail('POWERPOINT_AMBIGUOUS');
        if (!matching.length) {
            app[camel('run slide show')](read(existing[0], 'slide show settings'));
            matching = read(app, 'slide show windows').filter(function (show) { return localDocument(read(read(show, 'presentation'), 'full name')) === document; });
        }
        if (matching.length !== 1) fail('POWERPOINT_UNAVAILABLE');
        return snapshot(app, matching[0], request);
    }
    if (!app.running()) fail('POWERPOINT_COM_UNAVAILABLE');
    var selected = selectedShow(app, request);
    if (request.operation === 'status') return selected.status;
    // Office's AppleEvent goto accepts editor 'view'. The native fallback
    // uses the documented slideshow keyboard shortcut only with exact AX
    // focus/foreground validation, then requires the observed requested page.
    if (request.operation === 'goto') {
        if (!Number.isInteger(request.page) || request.page < 1 || request.page > selected.status.pages) fail('POWERPOINT_PAGE');
        if (!Number.isSafeInteger(request.expiresAt) || request.expiresAt <= Date.now()) fail('POWERPOINT_COMMAND');
        if (selected.status.page === request.page) return selected.status;
        snapshot(app, selected.show, Object.assign({}, request, {nativeOperation:'goto'}));
        while (Date.now() < request.expiresAt) {
            var observed = snapshot(app, selected.show, request);
            if (observed.page === request.page) return observed;
            $.NSThread.sleepForTimeInterval(0.05);
        }
        fail('POWERPOINT_GOTO_UNAVAILABLE');
    }
    // Fresh identity is checked before and after every effect. A timeout or
    // unverifiable completion is consumed by main and revokes the capability.
    selected.status = snapshot(app, selected.show, request);
    var view = read(selected.show, 'slideshow view');
    if (['next', 'previous'].indexOf(request.direction) === -1 || !Number.isSafeInteger(request.expiresAt) || request.expiresAt <= Date.now() || request.expiresAt > Date.now() + 3500) fail('POWERPOINT_COMMAND');
    app[camel(request.direction === 'next' ? 'go to next slide' : 'go to previous slide')](view);
    return snapshot(app, selected.show, request);
}
function run(argv) {
    try {
        if (argv.length !== 1 || argv[0].length > 16384) fail('POWERPOINT_COMMAND');
        return JSON.stringify(execute(JSON.parse(argv[0])));
    } catch (error) {
        var code = error.safeCode || (Number(error.errorNumber) === -1743 ? 'POWERPOINT_AUTOMATION_PERMISSION' : Number(error.errorNumber) === -1712 ? 'POWERPOINT_TIMEOUT' : 'POWERPOINT_UNAVAILABLE');
        // osascript exits successfully for a returned JSON error; main still
        // treats this finite envelope as failure, never as a valid observation.
        return JSON.stringify({ error: code });
    }
}
