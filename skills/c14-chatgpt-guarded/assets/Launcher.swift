import AppKit
import Foundation

private let chatGPTBundleID = "com.openai.codex"
private let chatGPTURL = URL(fileURLWithPath: "/Applications/ChatGPT.app")
private let proxyURL = Bundle.main.object(forInfoDictionaryKey: "GuardedProxyURL") as? String
    ?? "http://127.0.0.1:7890"
private let probeURL = Bundle.main.object(forInfoDictionaryKey: "GuardedProbeURL") as? String
    ?? "https://ab.chatgpt.com/v1"
private let nodeReplProxyURL = FileManager.default.homeDirectoryForCurrentUser
    .appendingPathComponent(".local/bin/codex-node-repl-proxy")
private let expectedEnvironmentEntry = "CODEX_NODE_REPL_PATH=\(nodeReplProxyURL.path)"

private struct CommandResult {
    let status: Int32
    let output: String
    let error: String
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

private func hasExpectedEnvironment(_ application: NSRunningApplication) -> Bool {
    let result = runCommand(
        "/bin/ps",
        ["eww", "-p", String(application.processIdentifier), "-o", "command="]
    )
    guard result.status == 0 else { return false }
    return result.output
        .split(whereSeparator: { $0.isWhitespace })
        .contains(Substring(expectedEnvironmentEntry))
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
        "--connect-timeout", "2",
        "--max-time", "4",
        "--silent",
        "--show-error",
        "--output", "/dev/null",
        "--write-out", "HTTP %{http_code} in %{time_total}s",
        probeURL,
    ])
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
    environment["CODEX_NODE_REPL_PATH"] = nodeReplProxyURL.path
    return environment
}

private func launchChatGPT() -> Result<NSRunningApplication, Error> {
    let configuration = NSWorkspace.OpenConfiguration()
    configuration.activates = true
    configuration.createsNewApplicationInstance = false
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
        showAlert(
            title: "ChatGPT is missing",
            message: "Expected to find the original app at \(chatGPTURL.path).",
            style: .critical
        )
        return false
    }
    guard FileManager.default.isExecutableFile(atPath: nodeReplProxyURL.path) else {
        showAlert(
            title: "Browser helper is missing",
            message: "Reinstall ChatGPT Guarded to restore \(nodeReplProxyURL.path).",
            style: .critical
        )
        return false
    }
    return true
}

private func runLauncher() {
    guard validateInstallation() else { return }

    if let current = runningChatGPT() {
        if hasExpectedEnvironment(current) {
            current.activate(options: [.activateAllWindows])
            return
        }

        let response = showAlert(
            title: "ChatGPT needs a guarded restart",
            message: "The running ChatGPT process does not have the Browser helper proxy. Quit and relaunch it now?",
            buttons: ["Quit and Relaunch", "Cancel"]
        )
        guard response == .alertFirstButtonReturn else { return }

        let probe = probeProxy()
        guard probe.status == 0, !probe.output.contains("HTTP 000") else {
            let detail = probe.error.isEmpty ? probe.output : probe.error
            showAlert(
                title: "Proxy unavailable",
                message: "\(proxyURL) did not complete the HTTPS check.\n\n\(detail)",
                style: .critical
            )
            return
        }

        guard current.terminate(), waitUntilChatGPTStops(timeout: 12) else {
            showAlert(
                title: "ChatGPT did not quit",
                message: "Close ChatGPT completely, then open ChatGPT Guarded again.",
                style: .critical
            )
            return
        }
    } else {
        let probe = probeProxy()
        guard probe.status == 0, !probe.output.contains("HTTP 000") else {
            let detail = probe.error.isEmpty ? probe.output : probe.error
            showAlert(
                title: "Proxy unavailable",
                message: "\(proxyURL) did not complete the HTTPS check.\n\n\(detail)",
                style: .critical
            )
            return
        }
    }

    switch launchChatGPT() {
    case .failure(let error):
        showAlert(title: "ChatGPT did not start", message: error.localizedDescription, style: .critical)
    case .success(let launched):
        guard hasExpectedEnvironment(launched) else {
            launched.terminate()
            showAlert(
                title: "Guarded launch verification failed",
                message: "ChatGPT did not receive the expected Browser helper path and was closed.",
                style: .critical
            )
            return
        }
        launched.activate(options: [.activateAllWindows])
    }
}

let application = NSApplication.shared
application.setActivationPolicy(.accessory)
application.finishLaunching()
runLauncher()
application.terminate(nil)
