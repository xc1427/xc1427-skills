import AppKit
import Foundation

private let chatGPTBundleID = "com.openai.codex"
private let proxyURL = Bundle.main.object(forInfoDictionaryKey: "GuardedProxyURL") as? String
    ?? "http://127.0.0.1:7890"
private let probeURL = Bundle.main.object(forInfoDictionaryKey: "GuardedProbeURL") as? String
    ?? "https://ab.chatgpt.com/v1"
private let noProxy = Bundle.main.object(forInfoDictionaryKey: "GuardedNoProxy") as? String
    ?? "localhost,127.0.0.1,::1,.local"

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

    let output = String(data: outputPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
    let error = String(data: errorPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
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

private func waitUntilChatGPTStops(timeout: TimeInterval) -> Bool {
    let deadline = Date().addingTimeInterval(timeout)
    repeat {
        if runningChatGPT() == nil { return true }
        RunLoop.current.run(until: Date().addingTimeInterval(0.2))
    } while Date() < deadline
    return runningChatGPT() == nil
}

private func probeProxy() -> CommandResult {
    runCommand("/usr/bin/curl", [
        "--proxy", proxyURL,
        "--connect-timeout", "2",
        "--max-time", "4",
        "--silent",
        "--show-error",
        "--output", "/dev/null",
        "--write-out", "HTTP %{http_code} in %{time_total}s",
        probeURL,
    ])
}

private func guardedEnvironment() -> [String: String] {
    var environment = ProcessInfo.processInfo.environment
    [
        "NODE_USE_ENV_PROXY", "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY",
        "http_proxy", "https_proxy", "ALL_PROXY", "all_proxy",
    ].forEach { environment.removeValue(forKey: $0) }
    environment["NODE_USE_ENV_PROXY"] = "1"
    environment["HTTP_PROXY"] = proxyURL
    environment["HTTPS_PROXY"] = proxyURL
    environment["NO_PROXY"] = noProxy
    return environment
}

private func launchChatGPT() -> Result<NSRunningApplication, Error> {
    guard let applicationURL = NSWorkspace.shared.urlForApplication(withBundleIdentifier: chatGPTBundleID) else {
        return .failure(NSError(
            domain: "ChatGPTGuarded",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: "ChatGPT.app could not be located."]
        ))
    }

    let configuration = NSWorkspace.OpenConfiguration()
    configuration.activates = true
    configuration.createsNewApplicationInstance = false
    configuration.environment = guardedEnvironment()

    var result: Result<NSRunningApplication, Error>?
    NSWorkspace.shared.openApplication(at: applicationURL, configuration: configuration) { application, error in
        if let application {
            result = .success(application)
        } else {
            result = .failure(error ?? NSError(
                domain: "ChatGPTGuarded",
                code: 2,
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
        code: 3,
        userInfo: [NSLocalizedDescriptionKey: "Timed out while launching ChatGPT."]
    ))
}

private func hasExpectedEnvironment(processID: pid_t) -> Bool {
    let result = runCommand("/bin/ps", ["eww", "-p", String(processID), "-o", "command="])
    guard result.status == 0 else { return false }
    let values = Set(result.output.split(whereSeparator: { $0.isWhitespace }).map(String.init))
    return values.isSuperset(of: [
        "NODE_USE_ENV_PROXY=1",
        "HTTP_PROXY=\(proxyURL)",
        "HTTPS_PROXY=\(proxyURL)",
        "NO_PROXY=\(noProxy)",
    ])
}

private func runLauncher() {
    let probe = probeProxy()
    guard probe.status == 0, !probe.output.contains("HTTP 000") else {
        let detail = probe.error.isEmpty ? probe.output : probe.error
        showAlert(
            title: "Proxy unavailable",
            message: "\(proxyURL) did not complete the HTTPS proxy check.\n\n\(detail)\n\nChatGPT was not launched.",
            style: .critical
        )
        return
    }

    if let current = runningChatGPT() {
        let response = showAlert(
            title: "ChatGPT is already running",
            message: "Process \(current.processIdentifier) cannot receive a new environment in place. Quit it and relaunch through the guarded proxy?",
            buttons: ["Quit and Relaunch", "Cancel"]
        )
        guard response == .alertFirstButtonReturn else { return }
        guard current.terminate(), waitUntilChatGPTStops(timeout: 12) else {
            showAlert(
                title: "ChatGPT did not quit",
                message: "Close it completely, then open ChatGPT Guarded again.",
                style: .critical
            )
            return
        }
    }

    switch launchChatGPT() {
    case .failure(let error):
        showAlert(title: "ChatGPT did not start", message: error.localizedDescription, style: .critical)
    case .success(let launched):
        guard hasExpectedEnvironment(processID: launched.processIdentifier) else {
            showAlert(
                title: "Environment verification failed",
                message: "ChatGPT started, but one or more guarded proxy variables were missing. Quit ChatGPT before retrying.",
                style: .critical
            )
            return
        }
        showAlert(
            title: "ChatGPT launched safely",
            message: "Proxy check: \(probe.output)\nVerified the guarded proxy environment in process \(launched.processIdentifier)."
        )
        launched.activate(options: [.activateAllWindows])
    }
}

let application = NSApplication.shared
application.setActivationPolicy(.regular)
application.finishLaunching()
runLauncher()
application.terminate(nil)
