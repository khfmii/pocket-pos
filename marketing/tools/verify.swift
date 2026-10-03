// swiftc -O -swift-version 5 verify.swift -o verify ; ./verify video.mp4 outDir t1 t2 ...
import AVFoundation
import AppKit
let a = CommandLine.arguments
let asset = AVURLAsset(url: URL(fileURLWithPath: a[1]))
let v = asset.tracks(withMediaType: .video), au = asset.tracks(withMediaType: .audio)
print("duration \(CMTimeGetSeconds(asset.duration))s  video tracks \(v.count) \(v.first.map { "\(Int($0.naturalSize.width))x\(Int($0.naturalSize.height)) @\($0.nominalFrameRate)fps" } ?? "")  audio tracks \(au.count)")
let gen = AVAssetImageGenerator(asset: asset); gen.requestedTimeToleranceBefore = .zero; gen.requestedTimeToleranceAfter = .zero; gen.appliesPreferredTrackTransform = true
for (i, s) in a.dropFirst(3).enumerated() {
    let t = Double(s)!
    if let cg = try? gen.copyCGImage(at: CMTime(seconds: t, preferredTimescale: 600), actualTime: nil) {
        let rep = NSBitmapImageRep(cgImage: cg)
        try? rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "\(a[2])/v\(i)_\(s).png"))
    }
}
