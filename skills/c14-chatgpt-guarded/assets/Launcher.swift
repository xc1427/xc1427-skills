import AppKit
import Foundation

private let chatGPTBundleID = "com.openai.codex"
private let chatGPTURL = URL(fileURLWithPath: "/Applications/ChatGPT.app")
private let proxyURL = Bundle.main.object(forInfoDictionaryKey: "GuardedProxyURL") as? String
    ?? "http://127.0.0.1:7890"
private let proxyBypassHosts = "localhost,127.0.0.1,::1"
private let chromiumProxyArgument = "--proxy-server=\(proxyURL)"
private let probeURL = Bundle.main.object(forInfoDictionaryKey: "GuardedProbeURL") as? String
    ?? "https://ab.chatgpt.com/v1"
private let proxyProbeMaxAttempts = 3
private let proxyProbeBackoff: [TimeInterval] = [0.4, 0.8]
private let diagnosticLogDirectoryURL = FileManager.default.homeDirectoryForCurrentUser
    .appendingPathComponent("Library/Logs/ChatGPT Guarded", isDirectory: true)
private let diagnosticLogURL = diagnosticLogDirectoryURL.appendingPathComponent("launcher.log")
private let previousDiagnosticLogURL = diagnosticLogDirectoryURL
    .appendingPathComponent("launcher.previous.log")
private let maxDiagnosticLogSizeBytes: UInt64 = 512 * 1024
private let updateReminderInterval: TimeInterval = 3 * 24 * 60 * 60
private let updateReminderDefaultsKey = "lastRemindedUpdateCheckTimestamp"
private let sparkleLastCheckKey = "SULastCheckTime"
private let nodeReplProxyURL = FileManager.default.homeDirectoryForCurrentUser
    .appendingPathComponent(".local/bin/codex-node-repl-proxy")
private let expectedLaunchEntries = [
    "CODEX_NODE_REPL_PATH=\(nodeReplProxyURL.path)",
    "HTTP_PROXY=\(proxyURL)",
    "HTTPS_PROXY=\(proxyURL)",
    "ALL_PROXY=\(proxyURL)",
    "NO_PROXY=\(proxyBypassHosts)",
    "NODE_USE_ENV_PROXY=1",
    chromiumProxyArgument,
]

private struct CommandResult {
    let status: Int32
    let output: String
    let error: String
}

private struct ProxyProbeSummary {
    let result: CommandResult
    let attempts: Int
}

private final class LauncherLog {
    private let sessionID = String(UUID().uuidString.prefix(8))
    private let timestampFormatter = ISO8601DateFormatter()

    init() {
        try? FileManager.default.createDirectory(
            at: diagnosticLogDirectoryURL,
            withIntermediateDirectories: true
        )
        rotateIfNeeded()
    }

    func write(_ event: String) {
        rotateIfNeeded()
        let singleLine = event
            .replacingOccurrences(of: "\r", with: "\\r")
            .replacingOccurrences(of: "\n", with: "\\n")
        let boundedEvent = String(singleLine.prefix(2048))
        let line = "\(timestampFormatter.string(from: Date())) session=\(sessionID) \(boundedEvent)\n"
        guard let data = line.data(using: .utf8) else { return }

        if !FileManager.default.fileExists(atPath: diagnosticLogURL.path) {
            try? data.write(to: diagnosticLogURL, options: .atomic)
            return
        }

        guard let handle = try? FileHandle(forWritingTo: diagnosticLogURL) else { return }
        handle.seekToEndOfFile()
        handle.write(data)
        handle.closeFile()
    }

    private func rotateIfNeeded() {
        guard
            let attributes = try? FileManager.default.attributesOfItem(atPath: diagnosticLogURL.path),
            let size = attributes[.size] as? NSNumber,
            size.uint64Value >= maxDiagnosticLogSizeBytes
        else { return }

        try? FileManager.default.removeItem(at: previousDiagnosticLogURL)
        try? FileManager.default.moveItem(at: diagnosticLogURL, to: previousDiagnosticLogURL)
    }
}

private let launcherLog = LauncherLog()

private func trace(_ event: String) {
    launcherLog.write(event)
}

private func runCommand(_ executable: String, _ arguments: [String]) -> CommandResult {
    let process = Process()
    let outputPipe = Pipe()
    let errorPipe = Pipe()
    process.executableURL = URL(fileURLWithPath: executable)
    process.arguments = arguments
    process.standardOutput = outputPipe
    process.standardError = errorPipe

    do {
        try process.run()
        process.waitUntilExit()
    } catch {
        return CommandResult(status: -1, output: "", error: error.localizedDescription)
    }

    let output = String(
        data: outputPipe.fileHandleForReading.readDataToEndOfFile(),
        encoding: .utf8
    ) ?? ""
    let error = String(
        data: errorPipe.fileHandleForReading.readDataToEndOfFile(),
        encoding: .utf8
    ) ?? ""
    return CommandResult(
        status: process.terminationStatus,
        output: output.trimmingCharacters(in: .whitespacesAndNewlines),
        error: error.trimmingCharacters(in: .whitespacesAndNewlines)
    )
}

@discardableResult
private func showAlert(
    title: String,
    message: String,
    style: NSAlert.Style = .informational,
    buttons: [String] = ["OK"]
) -> NSApplication.ModalResponse {
    let alert = NSAlert()
    alert.messageText = title
    alert.informativeText = message
    alert.alertStyle = style
    buttons.forEach { alert.addButton(withTitle: $0) }
    NSApp.activate(ignoringOtherApps: true)
    return alert.runModal()
}

private func runningChatGPT() -> NSRunningApplication? {
    NSWorkspace.shared.runningApplications.first {
        $0.bundleIdentifier == chatGPTBundleID && !$0.isTerminated
    }
}

private func hasExpectedLaunchConfiguration(_ application: NSRunningApplication) -> Bool {
    let result = runCommand(
        "/bin/ps",
        ["eww", "-p", String(application.processIdentifier), "-o", "command="]
    )
    guard result.status == 0 else { return false }
    let entries = result.output
        .split(whereSeparator: { $0.isWhitespace })
    return expectedLaunchEntries.allSatisfy { entries.contains(Substring($0)) }
}

private func waitUntilChatGPTStops(timeout: TimeInterval) -> Bool {
    let deadline = Date().addingTimeInterval(timeout)
    while Date() < deadline {
        if runningChatGPT() == nil { return true }
        RunLoop.current.run(until: Date().addingTimeInterval(0.2))
    }
    return runningChatGPT() == nil
}

private func probeProxy() -> CommandResult {
    runCommand("/usr/bin/curl", [
        "--proxy", proxyURL,
        "--noproxy", "",
        "--connect-timeout", "1.5",
        "--max-time", "3",
        "--silent",
        "--show-error",
        "--output", "/dev/null",
        "--write-out", "HTTP %{http_code} in %{time_total}s",
        probeURL,
    ])
}

private func proxyProbeSucceeded(_ result: CommandResult) -> Bool {
    result.status == 0 && !result.output.contains("HTTP 000")
}

private func probeProxyWithRetry() -> ProxyProbeSummary {
    for attempt in 1...proxyProbeMaxAttempts {
        let result = probeProxy()
        let output = result.output.isEmpty ? "-" : result.output
        let error = result.error.isEmpty ? "-" : result.error
        trace("proxy_probe attempt=\(attempt) exit=\(result.status) output=\(output) error=\(error)")
        if proxyProbeSucceeded(result) || attempt == proxyProbeMaxAttempts {
            return ProxyProbeSummary(result: result, attempts: attempt)
        }

        let delay = proxyProbeBackoff[min(attempt - 1, proxyProbeBackoff.count - 1)]
        RunLoop.current.run(until: Date().addingTimeInterval(delay))
    }

    fatalError("Proxy probe retry loop did not execute")
}

private func ensureProxyAvailable() -> Bool {
    let probe = probeProxyWithRetry()
    guard proxyProbeSucceeded(probe.result) else {
        trace("proxy_unavailable attempts=\(probe.attempts)")
        let detail = probe.result.error.isEmpty ? probe.result.output : probe.result.error
        let message = """
        \(proxyURL) did not complete the HTTPS check after \(probe.attempts) attempts.

        ChatGPT was not launched or restarted.

        \(detail)

        Diagnostic log: \(diagnosticLogURL.path)
        """
        showAlert(
            title: "Proxy unavailable",
            message: message,
            style: .critical
        )
        return false
    }
    trace("proxy_available attempts=\(probe.attempts)")
    return true
}

private func launchEnvironment() -> [String: String] {
    var environment = ProcessInfo.processInfo.environment
    let staleKeys = [
        "BROWSER_USE_DISABLE_AMBIENT_NETWORK",
        "BROWSER_USE_SECURITY_MODE",
        "CODEX_BROWSER_USE_NODE_PATH",
        "CODEX_NODE_REPL_PATH",
        "NODE_REPL_UNTRUSTED_ENV_ALLOWLIST",
        "NODE_USE_ENV_PROXY",
        "NODE_USE_SYSTEM_CA",
        "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY",
        "http_proxy", "https_proxy", "no_proxy",
        "ALL_PROXY", "all_proxy",
    ]
    staleKeys.forEach { environment.removeValue(forKey: $0) }

    // Chromium's app network service needs an explicit launch flag; these variables
    // cover the separately spawned Node and native clients without touching macOS-wide proxy state.
    environment["HTTP_PROXY"] = proxyURL
    environment["HTTPS_PROXY"] = proxyURL
    environment["ALL_PROXY"] = proxyURL
    environment["NO_PROXY"] = proxyBypassHosts
    environment["http_proxy"] = proxyURL
    environment["https_proxy"] = proxyURL
    environment["all_proxy"] = proxyURL
    environment["no_proxy"] = proxyBypassHosts
    environment["NODE_USE_ENV_PROXY"] = "1"
    environment["CODEX_NODE_REPL_PATH"] = nodeReplProxyURL.path
    return environment
}

private func launchChatGPT() -> Result<NSRunningApplication, Error> {
    let configuration = NSWorkspace.OpenConfiguration()
    configuration.activates = true
    configuration.createsNewApplicationInstance = false
    configuration.arguments = [chromiumProxyArgument]
    configuration.environment = launchEnvironment()

    var result: Result<NSRunningApplication, Error>?
    NSWorkspace.shared.openApplication(at: chatGPTURL, configuration: configuration) {
        application, error in
        if let application {
            result = .success(application)
        } else {
            result = .failure(error ?? NSError(
                domain: "ChatGPTGuarded",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "ChatGPT did not return a running application."]
            ))
        }
    }

    let deadline = Date().addingTimeInterval(12)
    while result == nil, Date() < deadline {
        RunLoop.current.run(until: Date().addingTimeInterval(0.2))
    }

    return result ?? .failure(NSError(
        domain: "ChatGPTGuarded",
        code: 2,
        userInfo: [NSLocalizedDescriptionKey: "Timed out while launching ChatGPT."]
    ))
}

private func validateInstallation() -> Bool {
    guard FileManager.default.fileExists(atPath: chatGPTURL.path) else {
        trace("validation_failed reason=chatgpt_missing")
        showAlert(
            title: "ChatGPT is missing",
            message: "Expected to find the original app at \(chatGPTURL.path).",
            style: .critical
        )
        return false
    }
    guard FileManager.default.isExecutableFile(atPath: nodeReplProxyURL.path) else {
        trace("validation_failed reason=node_repl_proxy_missing")
        showAlert(
            title: "Browser helper is missing",
            message: "Reinstall ChatGPT Guarded to restore \(nodeReplProxyURL.path).",
            style: .critical
        )
        return false
    }
    trace("validation_ok")
    return true
}

private func remindIfUpdateCheckIsStale(now: Date = Date()) {
    guard
        let chatGPTDefaults = UserDefaults.standard.persistentDomain(forName: chatGPTBundleID),
        let lastCheck = chatGPTDefaults[sparkleLastCheckKey] as? Date
    else {
        trace("update_reminder_skipped reason=last_check_missing")
        return
    }

    let age = now.timeIntervalSince(lastCheck)
    guard age >= updateReminderInterval else {
        trace("update_reminder_skipped reason=check_recent age_seconds=\(Int(max(0, age)))")
        return
    }

    // 以 Sparkle 最近一次成功检查的时间作为周期标识，同一周期只提醒一次。
    let checkTimestamp = lastCheck.timeIntervalSince1970
    let lastRemindedTimestamp = UserDefaults.standard.object(
        forKey: updateReminderDefaultsKey
    ) as? Double
    guard lastRemindedTimestamp != checkTimestamp else {
        trace("update_reminder_skipped reason=already_reminded")
        return
    }

    let staleDays = max(3, Int(age / (24 * 60 * 60)))
    trace("update_reminder_shown stale_days=\(staleDays)")
    showAlert(
        title: "已经 3 天没有检查更新了",
        message: """
        ChatGPT 已经 \(staleDays) 天没有成功检查更新。这不代表一定有新版本。

        请先在代理工具中打开 System Proxy，然后在 ChatGPT 菜单中选择“检查更新…”。Guarded 将继续启动。
        """,
        buttons: ["继续启动"]
    )
    UserDefaults.standard.set(checkTimestamp, forKey: updateReminderDefaultsKey)
    trace("update_reminder_acknowledged")
}

private func runLauncher() {
    guard validateInstallation() else {
        trace("launcher_stop reason=invalid_installation")
        return
    }

    remindIfUpdateCheckIsStale()

    if let current = runningChatGPT() {
        let isGuarded = hasExpectedLaunchConfiguration(current)
        trace("chatgpt_detected pid=\(current.processIdentifier) guarded=\(isGuarded)")
        if isGuarded {
            trace("chatgpt_activate_existing pid=\(current.processIdentifier)")
            current.activate(options: [.activateAllWindows])
            return
        }

        let response = showAlert(
            title: "ChatGPT needs a guarded restart",
            message: "The running ChatGPT process does not have the required app and Browser proxy settings. Quit and relaunch it now?",
            buttons: ["Quit and Relaunch", "Cancel"]
        )
        guard response == .alertFirstButtonReturn else {
            trace("restart_prompt canceled")
            return
        }
        trace("restart_prompt approved")

        guard ensureProxyAvailable() else { return }

        trace("chatgpt_terminate_requested pid=\(current.processIdentifier)")
        guard current.terminate(), waitUntilChatGPTStops(timeout: 12) else {
            trace("chatgpt_terminate_failed pid=\(current.processIdentifier)")
            showAlert(
                title: "ChatGPT did not quit",
                message: "Close ChatGPT completely, then open ChatGPT Guarded again.",
                style: .critical
            )
            return
        }
        trace("chatgpt_stopped pid=\(current.processIdentifier)")
    } else {
        trace("chatgpt_not_running")
        guard ensureProxyAvailable() else { return }
    }

    switch launchChatGPT() {
    case .failure(let error):
        trace("chatgpt_launch_failed error=\(error.localizedDescription)")
        showAlert(title: "ChatGPT did not start", message: error.localizedDescription, style: .critical)
    case .success(let launched):
        trace("chatgpt_launched pid=\(launched.processIdentifier)")
        guard hasExpectedLaunchConfiguration(launched) else {
            trace("chatgpt_verification_failed pid=\(launched.processIdentifier)")
            launched.terminate()
            showAlert(
                title: "Guarded launch verification failed",
                message: "ChatGPT did not receive the expected app and Browser proxy configuration and was closed.",
                style: .critical
            )
            return
        }
        trace("chatgpt_verification_ok pid=\(launched.processIdentifier)")
        launched.activate(options: [.activateAllWindows])
    }
}

let application = NSApplication.shared
application.setActivationPolicy(.accessory)
application.finishLaunching()
let launcherVersion = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
    ?? "unknown"
trace("launcher_start version=\(launcherVersion) pid=\(ProcessInfo.processInfo.processIdentifier)")
runLauncher()
trace("launcher_exit")
application.terminate(nil)
