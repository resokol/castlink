// macOS 13+: register this installed CastLink app by its exact URL. Electron's
// bundle-identifier-only setter cannot establish a newly copied app location.
#import <AppKit/AppKit.h>
#import <Foundation/Foundation.h>
#import <CoreServices/CoreServices.h>
#include <mach-o/dyld.h>
#include <stdlib.h>
#include <stdbool.h>
#include <string.h>
#include <unistd.h>

static NSArray<NSString *> *Schemes(void) {
    return @[@"castlink", @"castlink-remote", @"castlink-presenter", @"castlink-share"];
}
static BOOL RegistrationAttempted = NO;
static BOOL HasNativeStatus = NO;
static NSInteger NativeStatus = 0;
static NSString *NativeDomain = nil;
static BOOL HasClaimsStatus = NO;
static OSStatus ClaimsStatus = 0;
static NSArray *SelectionDiagnostics = nil;
static NSString *Canonical(NSString *path) {
    if (![path isKindOfClass:NSString.class] || !path.isAbsolutePath) return nil;
    char *resolved = realpath(path.fileSystemRepresentation, NULL);
    if (!resolved) return nil;
    NSString *result = [NSString stringWithUTF8String:resolved];
    free(resolved); return result;
}
static NSString *OwnExecutable(void) {
    uint32_t size = 0; _NSGetExecutablePath(NULL, &size);
    if (size == 0 || size > 65536) return nil;
    char *buffer = calloc(size, 1); if (!buffer) return nil;
    NSString *result = nil;
    if (_NSGetExecutablePath(buffer, &size) == 0) result = Canonical([NSString stringWithUTF8String:buffer]);
    free(buffer); return result;
}
static BOOL RegularExecutable(NSString *path) {
    NSDictionary *attributes = [NSFileManager.defaultManager attributesOfItemAtPath:path error:nil];
    return [attributes[NSFileType] isEqual:NSFileTypeRegular] && access(path.fileSystemRepresentation, X_OK) == 0;
}
static int Emit(BOOL ok, NSString *code) {
    NSMutableDictionary *value = [@{@"protocol": @1, @"ok": @(ok), @"code": code,
        @"schemes": Schemes(), @"selectedPathMatches": @(ok), @"registrationPerformed": @(RegistrationAttempted)} mutableCopy];
    if (HasNativeStatus) { value[@"nativeStatus"] = @(NativeStatus); value[@"nativeDomain"] = NativeDomain ?: @"OTHER"; }
    if (HasClaimsStatus) value[@"claimsStatus"] = @(ClaimsStatus);
    if (SelectionDiagnostics) value[@"selection"] = SelectionDiagnostics;
    NSData *json = [NSJSONSerialization dataWithJSONObject:value options:0 error:nil];
    if (json) { [[NSFileHandle fileHandleWithStandardOutput] writeData:json]; [[NSFileHandle fileHandleWithStandardOutput] writeData:[@"\n" dataUsingEncoding:NSUTF8StringEncoding]]; }
    return ok ? 0 : 1;
}
static BOOL DeclaresOnlyCastLinkSchemes(NSBundle *bundle) {
    id entries = bundle.infoDictionary[@"CFBundleURLTypes"];
    if (![entries isKindOfClass:NSArray.class]) return NO;
    NSMutableSet *declared = [NSMutableSet set]; NSUInteger count = 0;
    for (id entry in entries) {
        if (![entry isKindOfClass:NSDictionary.class]) return NO;
        id values = entry[@"CFBundleURLSchemes"];
        if (![values isKindOfClass:NSArray.class]) return NO;
        for (id value in values) {
            if (![value isKindOfClass:NSString.class] || ![Schemes() containsObject:value]) return NO;
            [declared addObject:value]; count++;
        }
    }
    return count == 4 && [declared isEqualToSet:[NSSet setWithArray:Schemes()]];
}
static void PumpRunLoop(void) {
    [NSRunLoop.currentRunLoop runMode:NSDefaultRunLoopMode beforeDate:[NSDate dateWithTimeIntervalSinceNow:0.02]];
    [NSThread sleepForTimeInterval:0.005];
}
static NSString *Location(NSString *path, NSString *application) {
    if (!path) return @"none";
    if ([path isEqual:application]) return @"candidate";
    NSString *parent = path.stringByDeletingLastPathComponent.lastPathComponent;
    if ([parent isEqual:@"mac"] || [parent isEqual:@"mac-arm64"]) return @"staged";
    if ([path hasPrefix:@"/Volumes/"]) return @"mounted";
    NSString *temporary = Canonical(NSTemporaryDirectory());
    if (temporary && [path hasPrefix:[temporary stringByAppendingString:@"/"]]) return @"temporary";
    if ([path hasPrefix:@"/Applications/"] || [path hasPrefix:[NSHomeDirectory() stringByAppendingString:@"/Applications/"]]) return @"applications";
    return @"other";
}
int main(int argc, const char *argv[]) {
    @autoreleasepool {
        // A passive packaging probe must never enter the registration branch.
        if (argc == 2 && strcmp(argv[1], "--self-test") == 0) {
            NSDictionary *value = @{@"protocol": @1, @"selfTest": @"passed", @"schemes": Schemes(), @"registrationPerformed": @NO, @"osOperationVerified": @NO};
            NSData *json = [NSJSONSerialization dataWithJSONObject:value options:0 error:nil];
            [[NSFileHandle fileHandleWithStandardOutput] writeData:json]; return 0;
        }
        if (argc != 3 || strcmp(argv[1], "--register") != 0) return Emit(NO, @"REGISTRATION_ARGUMENTS");
        NSString *own = OwnExecutable();
        if (!own || ![own.lastPathComponent isEqual:@"CastLink.ProtocolRegistration"]) return Emit(NO, @"BUNDLE_LOCATION");
        NSString *registration = own.stringByDeletingLastPathComponent;
        NSString *resources = registration.stringByDeletingLastPathComponent;
        NSString *contents = resources.stringByDeletingLastPathComponent;
        NSString *application = contents.stringByDeletingLastPathComponent;
        if (![registration.lastPathComponent isEqual:@"registration"] || ![resources.lastPathComponent isEqual:@"Resources"] ||
            ![contents.lastPathComponent isEqual:@"Contents"] || ![application.pathExtension isEqual:@"app"] ||
            ![Canonical([application stringByAppendingPathComponent:@"Contents/Resources/registration/CastLink.ProtocolRegistration"]) isEqual:own]) return Emit(NO, @"BUNDLE_LOCATION");
        NSBundle *bundle = [NSBundle bundleWithPath:application];
        if (![bundle.bundleIdentifier isEqual:@"ru.castlink.client"] || !DeclaresOnlyCastLinkSchemes(bundle)) return Emit(NO, @"BUNDLE_IDENTITY");
        id executableName = bundle.infoDictionary[@"CFBundleExecutable"];
        if (![executableName isKindOfClass:NSString.class] || [executableName length] == 0 || [executableName length] > 128 ||
            ![executableName isEqual:[executableName lastPathComponent]] || [executableName rangeOfString:@"\\"].location != NSNotFound) return Emit(NO, @"MAIN_EXECUTABLE");
        NSString *expectedMain = Canonical([[contents stringByAppendingPathComponent:@"MacOS"] stringByAppendingPathComponent:executableName]);
        NSString *macOS = [contents stringByAppendingPathComponent:@"MacOS"];
        NSString *suppliedMain = Canonical([NSString stringWithUTF8String:argv[2]]);
        if (!expectedMain || ![Canonical(macOS) isEqual:macOS] || ![expectedMain.stringByDeletingLastPathComponent isEqual:macOS] || ![suppliedMain isEqual:expectedMain] || ![Canonical(bundle.executablePath) isEqual:expectedMain] ||
            !RegularExecutable(expectedMain) || !RegularExecutable(own)) return Emit(NO, @"MAIN_EXECUTABLE");
        NSURL *applicationURL = [NSURL fileURLWithPath:application isDirectory:YES];
        const NSTimeInterval deadline = NSProcessInfo.processInfo.systemUptime + 8.0;
        if (NSProcessInfo.processInfo.systemUptime >= deadline) return Emit(NO, @"REGISTRATION_TIMEOUT");
        // Public LSInfo.h: LSRegisterURL adds a bundle's document and URL
        // claims to the catalog. Selecting a default is a separate operation.
        // Register only our verified own URL, once, refreshing copied metadata.
        RegistrationAttempted = YES; HasClaimsStatus = YES;
        ClaimsStatus = LSRegisterURL((__bridge CFURLRef)applicationURL, true);
        if (ClaimsStatus != noErr) { HasNativeStatus = YES; NativeStatus = ClaimsStatus; NativeDomain = @"NSOSStatusErrorDomain"; return Emit(NO, @"CLAIMS_REGISTRATION_FAILED"); }
        NSWorkspace *workspace = NSWorkspace.sharedWorkspace;
        for (NSString *scheme in Schemes()) {
            if (NSProcessInfo.processInfo.systemUptime >= deadline) return Emit(NO, @"REGISTRATION_TIMEOUT");
            NSLock *lock = [NSLock new]; __block BOOL done = NO; __block BOOL failed = NO; __block NSInteger status = 0; __block NSString *domain = nil;
            RegistrationAttempted = YES;
            [workspace setDefaultApplicationAtURL:applicationURL toOpenURLsWithScheme:scheme completionHandler:^(NSError *error) {
                [lock lock]; failed = error != nil; status = error.code; domain = [error.domain isEqual:NSOSStatusErrorDomain] ? @"NSOSStatusErrorDomain" : [error.domain isEqual:NSCocoaErrorDomain] ? @"NSCocoaErrorDomain" : @"OTHER"; done = YES; [lock unlock];
            }];
            BOOL completed = NO, rejected = NO;
            while (NSProcessInfo.processInfo.systemUptime < deadline) {
                [lock lock]; completed = done; rejected = failed; [lock unlock];
                if (completed) break; PumpRunLoop();
            }
            if (!completed) return Emit(NO, @"REGISTRATION_TIMEOUT");
            if (rejected) { HasNativeStatus = YES; NativeStatus = status; NativeDomain = domain; return Emit(NO, @"REGISTRATION_FAILED"); }
        }
        // Completion and selection are distinct. Read-only convergence checks
        // do not repeat a registration effect or substitute bundle-ID matching.
        do {
            BOOL matches = YES; NSMutableArray *diagnostics = [NSMutableArray array];
            for (NSString *scheme in Schemes()) {
                NSURL *selected = [workspace URLForApplicationToOpenURL:[NSURL URLWithString:[scheme stringByAppendingString:@"://connect"]]];
                NSString *resolved = Canonical(selected.path);
                BOOL exact = [resolved isEqual:application];
                BOOL bundleMatches = resolved && [[NSBundle bundleWithPath:resolved].bundleIdentifier isEqual:@"ru.castlink.client"];
                NSString *state = !selected ? @"none" : !resolved ? @"unresolved" : exact ? @"candidate" : bundleMatches ? @"other-castlink" : @"other-application";
                [diagnostics addObject:@{@"scheme": scheme, @"state": state, @"bundleMatches": @(bundleMatches), @"location": Location(resolved, application)}];
                if (!exact) matches = NO;
            }
            SelectionDiagnostics = diagnostics;
            if (matches) return Emit(YES, @"REGISTERED");
            PumpRunLoop();
        } while (NSProcessInfo.processInfo.systemUptime < deadline);
        return Emit(NO, @"SELECTION_MISMATCH");
    }
}
