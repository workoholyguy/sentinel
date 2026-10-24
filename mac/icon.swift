// Draws Uplink's app icon (1024×1024 PNG): a dark tile with a signal rising from a dot.
import AppKit

let size = 1024.0
let img = NSImage(size: NSSize(width: size, height: size))
img.lockFocus()
let tile = NSBezierPath(roundedRect: NSRect(x: 100, y: 100, width: 824, height: 824), xRadius: 185, yRadius: 185)
NSGradient(starting: NSColor(red: 0.07, green: 0.09, blue: 0.13, alpha: 1), ending: NSColor(red: 0.02, green: 0.03, blue: 0.05, alpha: 1))!.draw(in: tile, angle: -90)
let green = NSColor(red: 0.20, green: 0.83, blue: 0.60, alpha: 1)
let center = NSPoint(x: 512, y: 400)
for (i, r) in [150.0, 250.0, 350.0].enumerated() {
    let arc = NSBezierPath()
    arc.appendArc(withCenter: center, radius: r, startAngle: 40, endAngle: 140)
    arc.lineWidth = 46
    arc.lineCapStyle = .round
    green.withAlphaComponent(1 - Double(i) * 0.28).setStroke()
    arc.stroke()
}
green.setFill()
NSBezierPath(ovalIn: NSRect(x: center.x - 52, y: center.y - 52, width: 104, height: 104)).fill()
img.unlockFocus()
let rep = NSBitmapImageRep(data: img.tiffRepresentation!)!
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
