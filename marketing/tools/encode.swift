// swiftc -O -swift-version 5 encode.swift -o encode ;  ./encode <framesDir> <audio.wav> <out.mp4> [fps]
import AVFoundation
import CoreGraphics
import ImageIO
import Foundation

let a = CommandLine.arguments
guard a.count >= 4 else { print("usage: encode <framesDir> <audio.wav> <out.mp4> [fps]"); exit(1) }
let dir = a[1], audioPath = a[2], outPath = a[3]
let fps = Int32(a.count > 4 ? a[4] : "30")!
let files = try FileManager.default.contentsOfDirectory(atPath: dir).filter { $0.hasSuffix(".jpg") }.sorted()
func load(_ f: String) -> CGImage {
    let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: dir + "/" + f) as CFURL, nil)!
    return CGImageSourceCreateImageAtIndex(src, 0, nil)!
}
let first = load(files[0])
let W = first.width, H = first.height
try? FileManager.default.removeItem(atPath: outPath)
let writer = try AVAssetWriter(outputURL: URL(fileURLWithPath: outPath), fileType: .mp4)
let vset: [String: Any] = [
    AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: W, AVVideoHeightKey: H,
    AVVideoColorPropertiesKey: [AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2, AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2, AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2],
    AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 12_000_000, AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel, AVVideoMaxKeyFrameIntervalKey: Int(fps), AVVideoExpectedSourceFrameRateKey: Int(fps)],
]
let vin = AVAssetWriterInput(mediaType: .video, outputSettings: vset)
vin.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: vin, sourcePixelBufferAttributes: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA, kCVPixelBufferWidthKey as String: W, kCVPixelBufferHeightKey as String: H])
writer.add(vin)

let aset: [String: Any] = [AVFormatIDKey: kAudioFormatMPEG4AAC, AVNumberOfChannelsKey: 2, AVSampleRateKey: 44100, AVEncoderBitRateKey: 192_000]
let ain = AVAssetWriterInput(mediaType: .audio, outputSettings: aset)
ain.expectsMediaDataInRealTime = false
writer.add(ain)
let areader = try AVAssetReader(asset: AVURLAsset(url: URL(fileURLWithPath: audioPath)))
let aout = AVAssetReaderTrackOutput(track: areader.asset.tracks(withMediaType: .audio)[0], outputSettings: [AVFormatIDKey: kAudioFormatLinearPCM, AVLinearPCMBitDepthKey: 16, AVLinearPCMIsFloatKey: false, AVLinearPCMIsBigEndianKey: false, AVLinearPCMIsNonInterleaved: false, AVSampleRateKey: 44100, AVNumberOfChannelsKey: 2])
areader.add(aout)

writer.startWriting(); areader.startReading(); writer.startSession(atSourceTime: .zero)
let group = DispatchGroup()
var idx = 0
group.enter()
vin.requestMediaDataWhenReady(on: DispatchQueue(label: "video")) {
    while vin.isReadyForMoreMediaData {
        if idx >= files.count { vin.markAsFinished(); group.leave(); return }
        var pb: CVPixelBuffer?
        CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pb)
        let buf = pb!
        CVPixelBufferLockBaseAddress(buf, [])
        let ctx = CGContext(data: CVPixelBufferGetBaseAddress(buf), width: W, height: H, bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(buf), space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)!
        ctx.draw(load(files[idx]), in: CGRect(x: 0, y: 0, width: W, height: H))
        CVPixelBufferUnlockBaseAddress(buf, [])
        adaptor.append(buf, withPresentationTime: CMTime(value: CMTimeValue(idx), timescale: fps))
        idx += 1
    }
}
group.enter()
ain.requestMediaDataWhenReady(on: DispatchQueue(label: "audio")) {
    while ain.isReadyForMoreMediaData {
        if let s = aout.copyNextSampleBuffer() { ain.append(s) } else { ain.markAsFinished(); group.leave(); return }
    }
}
group.wait()
let sem = DispatchSemaphore(value: 0)
writer.finishWriting { sem.signal() }
sem.wait()
print(writer.status == .completed ? "ok \(files.count) frames \(W)x\(H) -> \(outPath)" : "failed: \(String(describing: writer.error))")
