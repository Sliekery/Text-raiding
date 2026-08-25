import CoreGraphics
import SwiftUI
import UIKit

/// Stamps a photo with a cookie cutter and returns a transparent PNG-ready image.
///
/// The maths deliberately mirrors `CutterEditorView`: the photo is aspect-filled
/// into the square, then zoomed, rotated and offset around its centre — so what
/// you framed on screen is what comes out, at whatever resolution you ask for.
enum StickerRenderer {

    /// Side length of an exported sticker, in pixels.
    static let exportSide: CGFloat = 1024

    static func render(image: UIImage,
                       shape: CutterShape,
                       transform: PhotoTransform,
                       style: StickerStyle,
                       side: CGFloat = exportSide) -> UIImage {
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = false

        let canvas = CGSize(width: side, height: side)
        return UIGraphicsImageRenderer(size: canvas, format: format).image { context in
            let cgContext = context.cgContext

            let padding = style.padding * side
            let content = CGRect(x: padding, y: padding,
                                 width: side - padding * 2, height: side - padding * 2)
            let outline = UIBezierPath(cgPath: shape.path(in: content).cgPath)

            drawBacking(outline, in: cgContext, style: style, side: side)

            cgContext.saveGState()
            outline.addClip()
            draw(image: image, in: content, transform: transform.clamped, context: cgContext)
            cgContext.restoreGState()
        }
    }

    /// The die-cut border and its drop shadow.
    ///
    /// Filling *and* stroking inside a transparency layer means the shadow is cast
    /// once by the combined silhouette instead of twice, so the seam between the
    /// two doesn't darken. Stroking with `2 * borderWidth` grows the outline
    /// evenly outwards, which a plain scale-down could never do on a shape with
    /// thin limbs like the gingerbread person.
    private static func drawBacking(_ outline: UIBezierPath,
                                    in context: CGContext,
                                    style: StickerStyle,
                                    side: CGFloat) {
        let (red, green, blue) = style.border.components
        let color = UIColor(red: red, green: green, blue: blue, alpha: 1)

        context.saveGState()
        if style.hasShadow {
            context.setShadow(offset: CGSize(width: 0, height: side * 0.012),
                              blur: side * 0.03,
                              color: UIColor.black.withAlphaComponent(0.32).cgColor)
        }
        context.beginTransparencyLayer(auxiliaryInfo: nil)
        color.setFill()
        color.setStroke()
        outline.fill()
        if style.borderWidth > 0 {
            outline.lineWidth = style.borderWidth * side * 2
            outline.lineJoinStyle = .round
            outline.lineCapStyle = .round
            outline.stroke()
        }
        context.endTransparencyLayer()
        context.restoreGState()
    }

    /// Draws the photo centred in `content`, honouring the editor's transform.
    private static func draw(image: UIImage, in content: CGRect,
                             transform: PhotoTransform, context: CGContext) {
        let side = min(content.width, content.height)
        let base = PhotoTransform.aspectFillSize(for: image.size, in: side)
        let width = base.width * transform.zoom
        let height = base.height * transform.zoom

        context.saveGState()
        context.translateBy(x: content.midX + transform.offset.width * side,
                            y: content.midY + transform.offset.height * side)
        context.rotate(by: transform.rotation)
        image.draw(in: CGRect(x: -width / 2, y: -height / 2, width: width, height: height))
        context.restoreGState()
    }
}
