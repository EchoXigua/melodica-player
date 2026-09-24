import AppKit
import ApplicationServices
import Darwin

// This helper posts only instrument keys; no shell commands or arbitrary key codes.
let keys: [String: CGKeyCode] = ["Z": 6, "X": 7, "C": 8, "V": 9, "B": 11, "N": 45, "M": 46, ",": 43]
let buttons: [String: CGMouseButton] = ["left": .left, "right": .right, "middle": .center]
var testPoint: CGPoint?
var interrupted: Int32 = 0
signal(SIGTERM) { _ in interrupted = 1 }
signal(SIGINT) { _ in interrupted = 1 }
func output(_ value: String) { print(value); fflush(stdout) }
struct Failure: Error { let message: String; init(_ message: String) { self.message = message } }
func options() -> [String: String] {
    var result: [String: String] = [:]
    let args = Array(CommandLine.arguments.dropFirst())
    if args.count % 2 != 0 { return result }
    for i in stride(from: 0, to: args.count, by: 2) { result[args[i]] = args[i + 1] }
    return result
}
func post(_ device: String, _ code: String, _ down: Bool) throws {
    let source = CGEventSource(stateID: .privateState)
    let event: CGEvent?
    if device == "key", let key = keys[code] {
        event = CGEvent(keyboardEventSource: source, virtualKey: key, keyDown: down)
    } else if device == "mouse", let button = buttons[code] {
        let type: CGEventType = button == .left ? (down ? .leftMouseDown : .leftMouseUp) : button == .right ? (down ? .rightMouseDown : .rightMouseUp) : (down ? .otherMouseDown : .otherMouseUp)
        guard let location = testPoint ?? CGEvent(source: nil)?.location else { throw Failure("无法读取鼠标位置") }
        event = CGEvent(mouseEventSource: source, mouseType: type, mouseCursorPosition: location, mouseButton: button)
    } else { throw Failure("不支持的乐器按键") }
    guard let event else { throw Failure("无法创建键鼠事件") }
    event.flags = []
    event.post(tap: .cghidEventTap)
}
struct Entry { let at: Double; let device: String; let code: String; let down: Bool; let index: String }
func play(_ args: [String: String]) {
    var held: [(String, String)] = []
    var terminal = "DONE"
    defer {
        for (device, code) in held.reversed() {
            do { try post(device, code, false) }
            catch { terminal = "ERROR 释放输入失败，请手动松开乐器按键" }
        }
        output(terminal)
    }
    do {
        guard AXIsProcessTrusted(), CGPreflightPostEventAccess() else {
            throw Failure("请在系统设置 → 隐私与安全性 → 辅助功能中允许 Melodica Studio（开发模式为 Electron 或启动终端），然后重启应用")
        }
        guard let file = args["-Plan"], let target = args["-Target"], target.hasPrefix("mac:"), let pid = Int32(target.dropFirst(4)), pid > 0,
              let ownerText = args["-Owner"], let owner = Int32(ownerText), owner > 0, let stop = args["-StopFile"] else { throw Failure("演奏参数无效") }
        if let point = args["-TestPoint"] {
            let xy = point.split(separator: ":")
            guard xy.count == 2, let x = Double(xy[0]), let y = Double(xy[1]), x.isFinite, y.isFinite else { throw Failure("测试接收位置无效") }
            testPoint = CGPoint(x: x, y: y)
        }
        let text = try String(contentsOfFile: file, encoding: .utf8)
        let lines = text.split(separator: "\n")
        guard !lines.isEmpty, lines.count <= 160002 else { throw Failure("演奏计划无效") }
        var previous = 0.0
        let entries: [Entry] = try lines.map { line in
            let p = line.components(separatedBy: "\t")
            guard p.count >= 2, let at = Double(p[0]), at.isFinite, at >= previous, at <= 1800000 else { throw Failure("音符时间无效") }
            previous = at
            if p[1] == "end" { return Entry(at: at, device: "end", code: "", down: false, index: "") }
            guard p.count >= 4, p[3] == "0" || p[3] == "1", (p[1] == "key" && keys[p[2]] != nil) || (p[1] == "mouse" && buttons[p[2]] != nil) else { throw Failure("音符输入无效") }
            return Entry(at: at, device: p[1], code: p[2], down: p[3] == "1", index: p.count > 4 ? p[4] : "")
        }
        func cancelled() -> Bool { interrupted != 0 || FileManager.default.fileExists(atPath: stop) || kill(owner, 0) != 0 || CGEventSource.keyState(.combinedSessionState, key: 100) }
        func focused() -> Bool { NSWorkspace.shared.frontmostApplication?.processIdentifier == pid }
        func ms() -> Double { ProcessInfo.processInfo.systemUptime * 1000 }
        output("COUNTDOWN 5")
        let countdown = ms()
        while ms() - countdown < 5000 {
            if cancelled() { terminal = "STOP 已取消"; return }
            Thread.sleep(forTimeInterval: 0.005)
        }
        guard focused() else { throw Failure("请在倒计时结束前切换到选定的目标应用") }
        guard !keys.values.contains(where: { CGEventSource.keyState(.combinedSessionState, key: $0) }), !buttons.values.contains(where: { CGEventSource.buttonState(.combinedSessionState, button: $0) }) else { throw Failure("请松开乐器按键和鼠标后再开始") }
        output("PLAYING")
        let start = ms()
        for e in entries {
            while ms() - start < e.at {
                if cancelled() { terminal = "STOP 已取消"; return }
                if !focused() { terminal = "STOP 目标应用失去焦点"; return }
                Thread.sleep(forTimeInterval: 0.002)
            }
            if cancelled() { terminal = "STOP 已取消"; return }
            if !focused() { terminal = "STOP 目标应用失去焦点"; return }
            guard ms() - start - e.at <= 250 else { throw Failure("演奏计时落后，已停止以避免连续补发输入") }
            if e.device == "end" { continue }
            if e.down { held.append((e.device, e.code)) }
            try post(e.device, e.code, e.down)
            if !e.down { held.removeAll { $0.0 == e.device && $0.1 == e.code } }
            if !e.index.isEmpty { output("NOTE \(e.index)") }
        }
    } catch let error as Failure { terminal = "ERROR \(error.message)" }
      catch { terminal = "ERROR \(error.localizedDescription)" }
}
let args = options()
switch args["-Mode"] {
case "list":
    let owner = Int32(args["-Owner"] ?? "0")
    for app in NSWorkspace.shared.runningApplications where app.activationPolicy == .regular && !app.isTerminated && app.processIdentifier != owner {
        let name = app.localizedName ?? "应用 \(app.processIdentifier)"
        output("mac:\(app.processIdentifier)\t\(Data(name.utf8).base64EncodedString())")
    }
case "check":
    output(AXIsProcessTrusted() && CGPreflightPostEventAccess() ? "READY" : "DENIED")
case "play": play(args)
default: output("ERROR 不支持的模式"); exit(1)
}
