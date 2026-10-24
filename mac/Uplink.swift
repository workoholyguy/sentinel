// Uplink for macOS: a real app around the local Uplink server.
// Dock icon + its own window (the dashboard) + a status dot in the menu bar.
// It starts the server itself when it isn't running. Build with mac/build.sh.
import AppKit
import WebKit

let base = URL(string: ProcessInfo.processInfo.environment["UPLINK_URL"] ?? "http://localhost:3500")!
let repo = Bundle.main.object(forInfoDictionaryKey: "UplinkRepo") as? String ?? FileManager.default.currentDirectoryPath
let ink = NSColor(red: 0.016, green: 0.024, blue: 0.039, alpha: 1)

struct Status: Decodable {
    struct Incident: Decodable {
        struct Diagnosis: Decodable { let summary: String }
        let status: String
        let diagnosis: Diagnosis?
    }
    let incident: Incident?
}

final class App: NSObject, NSApplicationDelegate, NSWindowDelegate {
    var window: NSWindow!
    let web = WKWebView()
    let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    let statusMenu = NSMenu()
    let line = NSMenuItem(title: "Starting Uplink…", action: nil, keyEquivalent: "")
    var server: Process?
    var loaded = false

    func applicationDidFinishLaunching(_ note: Notification) {
        NSApp.applicationIconImage = NSImage(contentsOfFile: Bundle.main.path(forResource: "AppIcon", ofType: "icns") ?? "")
        buildMainMenu()
        buildWindow()
        buildStatusItem()
        poll()
        Timer.scheduledTimer(withTimeInterval: 1.5, repeats: true) { [weak self] _ in self?.poll() }
    }

    // ---- window -------------------------------------------------------------------------
    func buildWindow() {
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1440, height: 900),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
                          backing: .buffered, defer: false)
        window.title = "Uplink"
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        window.backgroundColor = ink
        window.minSize = NSSize(width: 1100, height: 700)
        window.delegate = self
        window.setFrameAutosaveName("UplinkMain")
        if window.frame.origin == .zero { window.center() }
        web.setValue(false, forKey: "drawsBackground") // no white flash before the page paints
        web.underPageBackgroundColor = ink
        window.contentView = web
        web.loadHTMLString("<body style='background:#04060a;color:#8a93a6;font:15px -apple-system;display:grid;place-items:center;height:96vh'>Starting Uplink…</body>", baseURL: nil)
        window.makeKeyAndOrderFront(nil)
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        window.makeKeyAndOrderFront(nil)
        return true
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false } // keeps watching from the menu bar

    func applicationWillTerminate(_ note: Notification) { server?.terminate() }

    // ---- server -------------------------------------------------------------------------
    func startServerIfNeeded() {
        guard server == nil else { return }
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/bin/zsh")
        p.arguments = ["-lc", "cd \"\(repo)\" && exec pnpm dev --port \(base.port ?? 3500)"]
        p.standardOutput = FileHandle(forWritingAtPath: "/dev/null")
        p.standardError = FileHandle(forWritingAtPath: "/dev/null")
        try? p.run()
        server = p
    }

    // ---- menu bar -----------------------------------------------------------------------
    func buildStatusItem() {
        statusMenu.addItem(line)
        statusMenu.addItem(.separator())
        add(statusMenu, "Open Uplink", #selector(openWindow), "o")
        statusMenu.addItem(.separator())
        add(statusMenu, "Simulate ISP outage", #selector(simulateOutage), "")
        add(statusMenu, "Unknown fault (Devin)", #selector(unknownFault), "")
        add(statusMenu, "Restore", #selector(restore), "")
        statusMenu.addItem(.separator())
        add(statusMenu, "Quit Uplink", #selector(quit), "q")
        item.menu = statusMenu
        dot(.systemGray, "Uplink")
    }

    func buildMainMenu() {
        let main = NSMenu()
        let appItem = NSMenuItem()
        main.addItem(appItem)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About Uplink", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Hide Uplink", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(withTitle: "Quit Uplink", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        let viewItem = NSMenuItem()
        main.addItem(viewItem)
        let view = NSMenu(title: "View")
        add(view, "Reload", #selector(reload), "r")
        view.addItem(withTitle: "Enter Full Screen", action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f").keyEquivalentModifierMask = [.command, .control]
        viewItem.submenu = view
        let demoItem = NSMenuItem()
        main.addItem(demoItem)
        let demo = NSMenu(title: "Demo")
        add(demo, "Simulate ISP outage", #selector(simulateOutage), "1")
        add(demo, "Unknown fault (Devin)", #selector(unknownFault), "2")
        add(demo, "Restore", #selector(restore), "0")
        demoItem.submenu = demo
        NSApp.mainMenu = main
    }

    func add(_ menu: NSMenu, _ title: String, _ action: Selector, _ key: String) {
        let m = NSMenuItem(title: title, action: action, keyEquivalent: key)
        m.target = self
        menu.addItem(m)
    }

    func dot(_ color: NSColor, _ text: String) {
        let s = NSMutableAttributedString(string: "● ", attributes: [.foregroundColor: color])
        s.append(NSAttributedString(string: text, attributes: [.font: NSFont.menuBarFont(ofSize: 0)]))
        item.button?.attributedTitle = s
    }

    // ---- status -------------------------------------------------------------------------
    func poll() {
        URLSession.shared.dataTask(with: base.appendingPathComponent("api/status")) { data, _, _ in
            let status = data.flatMap { try? JSONDecoder().decode(Status.self, from: $0) }
            DispatchQueue.main.async { self.render(status, reachable: data != nil) }
        }.resume()
    }

    func render(_ s: Status?, reachable: Bool) {
        guard reachable, let s else {
            startServerIfNeeded()
            dot(.systemGray, "Uplink")
            line.title = "Starting Uplink…"
            return
        }
        if !loaded {
            loaded = true
            web.load(URLRequest(url: base))
        }
        guard let inc = s.incident else {
            dot(.systemGreen, "Uplink")
            line.title = "All systems normal"
            return
        }
        let what = inc.diagnosis?.summary ?? "Network problem"
        switch inc.status {
        case "resolved": dot(.systemGreen, "Uplink"); line.title = "Fixed: \(what)"
        case "ticketed": dot(.systemGreen, "Uplink · ticket open"); line.title = "Provider ticket open"
        case "needs_human": dot(.systemOrange, "Uplink · needs you"); line.title = what
        case "calling": dot(.systemBlue, "Uplink · calling ISP"); line.title = "On the phone with your provider"
        case "informing": dot(.systemBlue, "Uplink · calling you"); line.title = "Calling you with the update"
        default: dot(.systemRed, "Uplink · outage"); line.title = what
        }
    }

    func post(_ path: String) {
        var r = URLRequest(url: base.appendingPathComponent(path))
        r.httpMethod = "POST"
        URLSession.shared.dataTask(with: r).resume()
    }

    @objc func openWindow() { NSApp.activate(ignoringOtherApps: true); window.makeKeyAndOrderFront(nil) }
    @objc func reload() { web.reload() }
    @objc func simulateOutage() { post("api/demo/isp-outage") }
    @objc func unknownFault() { post("api/demo/unknown-fault") }
    @objc func restore() { post("api/demo/restore") }
    @objc func quit() { NSApp.terminate(nil) }
}

let app = NSApplication.shared
app.setActivationPolicy(.regular)
let delegate = App()
app.delegate = delegate
app.activate(ignoringOtherApps: true)
app.run()
