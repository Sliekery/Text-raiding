import CoreGraphics
import Foundation

/// How the photo sits behind the cutter.
///
/// Everything is stored **relative to the cutter frame**, never in screen points:
/// `zoom` is a multiplier on top of an aspect-fill baseline and `offset` is a
/// fraction of the frame's side. That is what makes the editor WYSIWYG — the same
/// numbers describe a 320pt preview and a 1024px export.
struct PhotoTransform: Equatable {
    var zoom: CGFloat = 1
    var offset: CGSize = .zero
    /// Radians, clockwise on screen.
    var rotation: CGFloat = 0

    static let identity = PhotoTransform()

    static let zoomRange: ClosedRange<CGFloat> = 0.2...8
    static let offsetLimit: CGFloat = 1.5

    var clamped: PhotoTransform {
        PhotoTransform(
            zoom: min(max(zoom, Self.zoomRange.lowerBound), Self.zoomRange.upperBound),
            offset: CGSize(
                width: min(max(offset.width, -Self.offsetLimit), Self.offsetLimit),
                height: min(max(offset.height, -Self.offsetLimit), Self.offsetLimit)
            ),
            rotation: rotation
        )
    }

    /// The size a photo of `imageSize` is drawn at, before `zoom`, so that it
    /// covers a `side` x `side` frame completely.
    static func aspectFillSize(for imageSize: CGSize, in side: CGFloat) -> CGSize {
        guard imageSize.width > 0, imageSize.height > 0 else {
            return CGSize(width: side, height: side)
        }
        let scale = max(side / imageSize.width, side / imageSize.height)
        return CGSize(width: imageSize.width * scale, height: imageSize.height * scale)
    }
}

/// The look of the finished sticker: the white die-cut border and its drop shadow.
struct StickerStyle: Equatable {
    /// Border thickness as a fraction of the sticker's side.
    var borderWidth: CGFloat = 0.035
    var hasShadow: Bool = true
    /// Border colour, stored as RGBA so it survives `Codable` round trips.
    var border: BorderColor = .white

    enum BorderColor: String, CaseIterable, Identifiable, Equatable {
        case white = "White"
        case black = "Black"
        case cream = "Cream"
        case pink = "Pink"
        case mint = "Mint"

        var id: String { rawValue }

        /// Red, green, blue in 0...1.
        var components: (CGFloat, CGFloat, CGFloat) {
            switch self {
            case .white: return (1.00, 1.00, 1.00)
            case .black: return (0.09, 0.09, 0.11)
            case .cream: return (0.99, 0.95, 0.87)
            case .pink:  return (1.00, 0.72, 0.80)
            case .mint:  return (0.71, 0.95, 0.85)
            }
        }
    }

    struct BorderPreset: Identifiable, Equatable {
        let name: String
        let width: CGFloat
        var id: String { name }
    }

    static let borderPresets: [BorderPreset] = [
        BorderPreset(name: "None", width: 0),
        BorderPreset(name: "Thin", width: 0.018),
        BorderPreset(name: "Medium", width: 0.035),
        BorderPreset(name: "Thick", width: 0.06),
    ]

    /// Extra room left around the shape for the border and the shadow.
    var padding: CGFloat { max(borderWidth, 0.012) + (hasShadow ? 0.045 : 0.01) }
}
