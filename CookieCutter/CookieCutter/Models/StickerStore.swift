import Foundation
import UIKit

/// Reads and writes the sticker library in the shared App Group container.
///
/// Compiled into **both** targets: the app writes, the Messages extension reads.
final class StickerStore: ObservableObject {

    /// Messages refuses stickers larger than this.
    static let messagesSizeLimit = 500_000
    /// Candidate square sizes for the Messages copy, largest first.
    /// Messages displays stickers between 300x300 and 618x618 points.
    private static let messagesSizes: [CGFloat] = [618, 512, 408, 300]

    @Published private(set) var stickers: [Sticker] = []

    static let shared = StickerStore()

    init() { reload() }

    // MARK: Reading

    /// Newest first.
    func reload() {
        guard let data = try? Data(contentsOf: AppGroup.indexURL) else {
            stickers = []
            return
        }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let loaded = (try? decoder.decode([Sticker].self, from: data)) ?? []
        // Drop entries whose files went missing (e.g. the container was reset).
        stickers = loaded
            .filter { FileManager.default.fileExists(atPath: $0.url.path) }
            .sorted { $0.createdAt > $1.createdAt }
    }

    func image(for sticker: Sticker) -> UIImage? {
        UIImage(contentsOfFile: sticker.url.path)
    }

    // MARK: Writing

    /// Writes the full-resolution PNG plus the Messages-sized copy, and records it.
    @discardableResult
    func add(image: UIImage, shapeID: String, shapeName: String) throws -> Sticker {
        let id = UUID()
        let fileName = "\(id.uuidString).png"
        let stickerFileName = "\(id.uuidString)-messages.png"

        guard let full = image.pngData() else { throw StickerStoreError.encodingFailed }
        try full.write(to: AppGroup.stickersDirectory.appendingPathComponent(fileName),
                       options: .atomic)

        let small = Self.messagesCopy(of: image) ?? full
        try small.write(to: AppGroup.stickersDirectory.appendingPathComponent(stickerFileName),
                        options: .atomic)

        let sticker = Sticker(id: id, shapeID: shapeID, shapeName: shapeName,
                              fileName: fileName, stickerFileName: stickerFileName)
        stickers.insert(sticker, at: 0)
        try writeIndex()
        return sticker
    }

    func delete(_ sticker: Sticker) {
        stickers.removeAll { $0.id == sticker.id }
        try? FileManager.default.removeItem(at: sticker.url)
        try? FileManager.default.removeItem(at: sticker.stickerURL)
        try? writeIndex()
    }

    private func writeIndex() throws {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        try encoder.encode(stickers).write(to: AppGroup.indexURL, options: .atomic)
    }

    // MARK: Messages-sized copy

    /// The largest PNG under the Messages size limit, or `nil` if the image
    /// cannot be encoded at all.
    static func messagesCopy(of image: UIImage) -> Data? {
        var smallest: Data?
        for side in messagesSizes {
            guard let data = resized(image, to: side)?.pngData() else { continue }
            smallest = data
            if data.count <= messagesSizeLimit { return data }
        }
        // Everything was still too big; the smallest attempt is the best we have.
        return smallest ?? image.pngData()
    }

    private static func resized(_ image: UIImage, to side: CGFloat) -> UIImage? {
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = false
        let size = CGSize(width: side, height: side)
        return UIGraphicsImageRenderer(size: size, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
    }
}

enum StickerStoreError: LocalizedError {
    case encodingFailed

    var errorDescription: String? {
        switch self {
        case .encodingFailed: return "That sticker could not be saved."
        }
    }
}
