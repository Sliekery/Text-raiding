import Foundation

/// A saved sticker. The images themselves live next to the index as PNG files.
struct Sticker: Identifiable, Codable, Hashable {
    let id: UUID
    /// The cutter it was stamped with, e.g. `"star"`.
    var shapeID: String
    var shapeName: String
    var createdAt: Date
    /// Full resolution cut-out, used for sharing and saving to Photos.
    var fileName: String
    /// Downscaled copy that fits inside Messages' 500 KB sticker limit.
    var stickerFileName: String

    init(id: UUID = UUID(), shapeID: String, shapeName: String, createdAt: Date = Date(),
         fileName: String, stickerFileName: String) {
        self.id = id
        self.shapeID = shapeID
        self.shapeName = shapeName
        self.createdAt = createdAt
        self.fileName = fileName
        self.stickerFileName = stickerFileName
    }

    var url: URL { AppGroup.stickersDirectory.appendingPathComponent(fileName) }
    var stickerURL: URL { AppGroup.stickersDirectory.appendingPathComponent(stickerFileName) }

    /// Shown by VoiceOver in the Messages sticker browser.
    var localizedDescription: String { "\(shapeName) sticker" }
}
