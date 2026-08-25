import CoreGraphics
import SwiftUI

/// Primitive builders for cutter outlines.
///
/// Every shape in the app is described inside the **unit square** — (0, 0) at the
/// top-left, (1, 1) at the bottom-right, y growing downwards, matching UIKit and
/// SwiftUI. `CutterShape` scales that description into whatever rect it is asked
/// for, so one definition works for a 44pt thumbnail and a 1024px export alike.
///
/// Shapes are allowed to be built out of several overlapping sub-paths: paths are
/// filled with the non-zero winding rule, so overlapping circles and capsules
/// union together (that is how the bear, the paw and the gingerbread person are
/// made) instead of punching holes in each other.
enum UnitPath {

    // MARK: Primitives

    static func circle(_ cx: CGFloat, _ cy: CGFloat, _ r: CGFloat) -> Path {
        ellipse(cx, cy, r, r)
    }

    static func ellipse(_ cx: CGFloat, _ cy: CGFloat, _ rx: CGFloat, _ ry: CGFloat,
                        rotation: CGFloat = 0) -> Path {
        let rect = CGRect(x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2)
        let path = Path(ellipseIn: rect)
        guard rotation != 0 else { return path }
        return path.applying(rotate(rotation, about: CGPoint(x: cx, y: cy)))
    }

    static func roundedRect(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat,
                            radius: CGFloat) -> Path {
        Path(roundedRect: CGRect(x: x, y: y, width: w, height: h), cornerRadius: radius)
    }

    /// A closed polygon through `points`.
    static func polygon(_ points: [CGPoint]) -> Path {
        var path = Path()
        guard let first = points.first else { return path }
        path.move(to: first)
        for point in points.dropFirst() { path.addLine(to: point) }
        path.closeSubpath()
        return path
    }

    /// A regular n-gon. `rotation` is in radians; 0 puts the first vertex to the right.
    static func regularPolygon(sides: Int, cx: CGFloat, cy: CGFloat, r: CGFloat,
                               rotation: CGFloat = -.pi / 2) -> Path {
        let points = (0..<max(sides, 3)).map { i -> CGPoint in
            let angle = rotation + (.pi * 2 / CGFloat(sides)) * CGFloat(i)
            return CGPoint(x: cx + cos(angle) * r, y: cy + sin(angle) * r)
        }
        return polygon(points)
    }

    /// A pointed star with `points` tips, alternating between `outer` and `inner` radius.
    static func star(points: Int, cx: CGFloat, cy: CGFloat, outer: CGFloat, inner: CGFloat,
                     rotation: CGFloat = -.pi / 2) -> Path {
        let tips = max(points, 3)
        let step = CGFloat.pi / CGFloat(tips)
        let vertices = (0..<(tips * 2)).map { i -> CGPoint in
            let radius = i.isMultiple(of: 2) ? outer : inner
            let angle = rotation + step * CGFloat(i)
            return CGPoint(x: cx + cos(angle) * radius, y: cy + sin(angle) * radius)
        }
        return polygon(vertices)
    }

    /// A rounded bar between two points — arms, legs, tree trunks.
    static func capsule(from start: CGPoint, to end: CGPoint, width: CGFloat) -> Path {
        let dx = end.x - start.x
        let dy = end.y - start.y
        let length = max(hypot(dx, dy), width)
        let rect = CGRect(x: -length / 2, y: -width / 2, width: length, height: width)
        let mid = CGPoint(x: (start.x + end.x) / 2, y: (start.y + end.y) / 2)
        let transform = CGAffineTransform(rotationAngle: atan2(dy, dx))
            .concatenating(CGAffineTransform(translationX: mid.x, y: mid.y))
        return Path(roundedRect: rect, cornerRadius: width / 2).applying(transform)
    }

    // MARK: Helpers

    static func rotate(_ angle: CGFloat, about point: CGPoint) -> CGAffineTransform {
        CGAffineTransform(translationX: point.x, y: point.y)
            .rotated(by: angle)
            .translatedBy(x: -point.x, y: -point.y)
    }

    static func degrees(_ value: CGFloat) -> CGFloat { value * .pi / 180 }

    /// Unions several sub-paths into one path (filled non-zero, so they merge).
    static func union(_ paths: [Path]) -> Path {
        var result = Path()
        for path in paths { result.addPath(path) }
        return result
    }
}
