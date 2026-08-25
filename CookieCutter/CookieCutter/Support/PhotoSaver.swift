import Photos
import UIKit

/// Saves a finished sticker into the user's photo library as a transparent PNG.
enum PhotoSaver {

    enum SaveError: LocalizedError {
        case denied
        case encodingFailed
        case underlying(Error)

        var errorDescription: String? {
            switch self {
            case .denied:
                return "CookieCutter needs permission to add photos. "
                     + "Turn it on in Settings › Privacy › Photos."
            case .encodingFailed:
                return "That sticker could not be encoded as a PNG."
            case .underlying(let error):
                return error.localizedDescription
            }
        }
    }

    static func save(_ image: UIImage) async throws {
        let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
        guard status == .authorized || status == .limited else { throw SaveError.denied }
        guard let data = image.pngData() else { throw SaveError.encodingFailed }

        do {
            try await PHPhotoLibrary.shared().performChanges {
                let request = PHAssetCreationRequest.forAsset()
                request.addResource(with: .photo, data: data, options: nil)
            }
        } catch {
            throw SaveError.underlying(error)
        }
    }
}
