import Darwin

// Real kernel process birth, independent of LaunchServices registration.
// Epoch milliseconds are the shared main/native identity wire representation.
// Unavailable identity fails closed; there is no wall-clock or PID-only fallback.
func processBirthMilliseconds(_ pid: pid_t) -> Int64? {
    guard pid > 0 else { return nil }
    var info = proc_bsdinfo()
    let size = Int32(MemoryLayout<proc_bsdinfo>.stride)
    let received = withUnsafeMutablePointer(to: &info) { buffer in
        proc_pidinfo(pid, PROC_PIDTBSDINFO, 0, buffer, size)
    }
    guard received == size, info.pbi_pid == UInt32(pid),
          info.pbi_start_tvsec > 0, info.pbi_start_tvusec < 1_000_000,
          info.pbi_start_tvsec <= UInt64(Int64.max) / 1000 else { return nil }
    let milliseconds = info.pbi_start_tvsec * 1000 + info.pbi_start_tvusec / 1000
    guard milliseconds > 0, milliseconds <= UInt64(Int64.max) else { return nil }
    return Int64(milliseconds)
}

func processBirthSelfTest() -> Bool {
    guard let started = processBirthMilliseconds(getpid()), started > 0,
          processBirthMilliseconds(getpid()) == started,
          processBirthMilliseconds(0) == nil, processBirthMilliseconds(-1) == nil else { return false }
    return true
}
