import CoreGraphics
import SwiftUI

/// One cookie cutter: a name, a category, and the outline it stamps out of a photo.
struct CutterShape: Identifiable, Hashable {
    enum Category: String, CaseIterable, Identifiable {
        case basics = "Basics"
        case cute = "Cute"
        case seasonal = "Seasonal"
        case fun = "Fun"

        var id: String { rawValue }
    }

    let id: String
    let name: String
    let category: Category
    private let build: () -> Path

    init(id: String, name: String, category: Category, build: @escaping () -> Path) {
        self.id = id
        self.name = name
        self.category = category
        self.build = build
    }

    /// The outline inside the unit square.
    func unitPath() -> Path { build() }

    /// The outline scaled to fill (and centred in) `rect`, keeping its aspect ratio.
    func path(in rect: CGRect) -> Path {
        let side = min(rect.width, rect.height)
        let transform = CGAffineTransform(
            translationX: rect.midX - side / 2,
            y: rect.midY - side / 2
        ).scaledBy(x: side, y: side)
        return unitPath().applying(transform)
    }

    static func == (lhs: CutterShape, rhs: CutterShape) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

/// A `CutterShape` as a SwiftUI `Shape`, so it can be used for masks, strokes and fills.
struct CutterShapeView: Shape {
    let shape: CutterShape
    func path(in rect: CGRect) -> Path { shape.path(in: rect) }
}

// MARK: - The shape drawer

enum CutterShapeLibrary {

    static let all: [CutterShape] = basics + cute + seasonal + fun

    static func shape(id: String) -> CutterShape? {
        all.first { $0.id == id }
    }

    static func shapes(in category: CutterShape.Category) -> [CutterShape] {
        all.filter { $0.category == category }
    }

    static var `default`: CutterShape { shape(id: "star") ?? all[0] }

    // MARK: Basics

    private static let basics: [CutterShape] = [
        CutterShape(id: "circle", name: "Circle", category: .basics) {
            UnitPath.circle(0.5, 0.5, 0.5)
        },
        CutterShape(id: "squircle", name: "Rounded Square", category: .basics) {
            UnitPath.roundedRect(0.02, 0.02, 0.96, 0.96, radius: 0.26)
        },
        CutterShape(id: "heart", name: "Heart", category: .basics) {
            var p = Path()
            p.move(to: CGPoint(x: 0.5, y: 0.97))
            p.addCurve(to: CGPoint(x: 0.01, y: 0.32),
                       control1: CGPoint(x: 0.15, y: 0.76),
                       control2: CGPoint(x: 0.01, y: 0.55))
            p.addCurve(to: CGPoint(x: 0.5, y: 0.22),
                       control1: CGPoint(x: 0.01, y: 0.04),
                       control2: CGPoint(x: 0.35, y: 0.02))
            p.addCurve(to: CGPoint(x: 0.99, y: 0.32),
                       control1: CGPoint(x: 0.65, y: 0.02),
                       control2: CGPoint(x: 0.99, y: 0.04))
            p.addCurve(to: CGPoint(x: 0.5, y: 0.97),
                       control1: CGPoint(x: 0.99, y: 0.55),
                       control2: CGPoint(x: 0.85, y: 0.76))
            p.closeSubpath()
            return p
        },
        CutterShape(id: "star", name: "Star", category: .basics) {
            UnitPath.star(points: 5, cx: 0.5, cy: 0.53, outer: 0.5, inner: 0.21)
        },
        CutterShape(id: "sparkle", name: "Sparkle", category: .basics) {
            var p = Path()
            let tips = [CGPoint(x: 0.5, y: 0.0), CGPoint(x: 1.0, y: 0.5),
                        CGPoint(x: 0.5, y: 1.0), CGPoint(x: 0.0, y: 0.5)]
            let waists = [CGPoint(x: 0.62, y: 0.38), CGPoint(x: 0.62, y: 0.62),
                          CGPoint(x: 0.38, y: 0.62), CGPoint(x: 0.38, y: 0.38)]
            p.move(to: tips[0])
            for i in 0..<4 {
                p.addQuadCurve(to: tips[(i + 1) % 4], control: waists[i])
            }
            p.closeSubpath()
            return p
        },
        CutterShape(id: "hexagon", name: "Hexagon", category: .basics) {
            UnitPath.regularPolygon(sides: 6, cx: 0.5, cy: 0.5, r: 0.5)
        },
        CutterShape(id: "diamond", name: "Diamond", category: .basics) {
            UnitPath.polygon([CGPoint(x: 0.5, y: 0.0), CGPoint(x: 1.0, y: 0.5),
                              CGPoint(x: 0.5, y: 1.0), CGPoint(x: 0.0, y: 0.5)])
        },
        CutterShape(id: "egg", name: "Egg", category: .basics) {
            var p = Path()
            p.move(to: CGPoint(x: 0.5, y: 0.02))
            p.addCurve(to: CGPoint(x: 0.5, y: 0.98),
                       control1: CGPoint(x: 0.92, y: 0.16),
                       control2: CGPoint(x: 0.96, y: 0.98))
            p.addCurve(to: CGPoint(x: 0.5, y: 0.02),
                       control1: CGPoint(x: 0.04, y: 0.98),
                       control2: CGPoint(x: 0.08, y: 0.16))
            p.closeSubpath()
            return p
        },
        CutterShape(id: "moon", name: "Crescent", category: .basics) {
            var p = Path()
            p.move(to: CGPoint(x: 0.66, y: 0.03))
            p.addCurve(to: CGPoint(x: 0.66, y: 0.97),
                       control1: CGPoint(x: 0.04, y: 0.14),
                       control2: CGPoint(x: 0.04, y: 0.86))
            p.addCurve(to: CGPoint(x: 0.66, y: 0.03),
                       control1: CGPoint(x: 0.44, y: 0.78),
                       control2: CGPoint(x: 0.44, y: 0.22))
            p.closeSubpath()
            return p
        },
    ]

    // MARK: Cute

    private static let cute: [CutterShape] = [
        CutterShape(id: "cat", name: "Cat", category: .cute) {
            var p = Path()
            p.move(to: CGPoint(x: 0.18, y: 0.44))
            p.addLine(to: CGPoint(x: 0.09, y: 0.05))
            p.addLine(to: CGPoint(x: 0.40, y: 0.26))
            p.addQuadCurve(to: CGPoint(x: 0.60, y: 0.26), control: CGPoint(x: 0.50, y: 0.22))
            p.addLine(to: CGPoint(x: 0.91, y: 0.05))
            p.addLine(to: CGPoint(x: 0.82, y: 0.44))
            p.addCurve(to: CGPoint(x: 0.50, y: 0.98),
                       control1: CGPoint(x: 1.00, y: 0.62),
                       control2: CGPoint(x: 0.86, y: 0.98))
            p.addCurve(to: CGPoint(x: 0.18, y: 0.44),
                       control1: CGPoint(x: 0.14, y: 0.98),
                       control2: CGPoint(x: 0.00, y: 0.62))
            p.closeSubpath()
            return p
        },
        CutterShape(id: "bear", name: "Bear", category: .cute) {
            UnitPath.union([
                UnitPath.circle(0.20, 0.24, 0.17),
                UnitPath.circle(0.80, 0.24, 0.17),
                UnitPath.circle(0.50, 0.58, 0.40),
            ])
        },
        CutterShape(id: "bunny", name: "Bunny", category: .cute) {
            UnitPath.union([
                UnitPath.ellipse(0.34, 0.27, 0.11, 0.26, rotation: UnitPath.degrees(-12)),
                UnitPath.ellipse(0.66, 0.27, 0.11, 0.26, rotation: UnitPath.degrees(12)),
                UnitPath.ellipse(0.50, 0.71, 0.34, 0.28),
            ])
        },
        CutterShape(id: "paw", name: "Paw", category: .cute) {
            UnitPath.union([
                UnitPath.ellipse(0.16, 0.44, 0.11, 0.14, rotation: UnitPath.degrees(-22)),
                UnitPath.ellipse(0.38, 0.26, 0.11, 0.15, rotation: UnitPath.degrees(-8)),
                UnitPath.ellipse(0.62, 0.26, 0.11, 0.15, rotation: UnitPath.degrees(8)),
                UnitPath.ellipse(0.84, 0.44, 0.11, 0.14, rotation: UnitPath.degrees(22)),
                UnitPath.ellipse(0.50, 0.73, 0.30, 0.25),
            ])
        },
        CutterShape(id: "flower", name: "Flower", category: .cute) {
            var petals: [Path] = []
            for i in 0..<6 {
                let angle = CGFloat(i) * .pi / 3
                petals.append(UnitPath.ellipse(0.5 + cos(angle) * 0.28,
                                               0.5 + sin(angle) * 0.28,
                                               0.21, 0.145,
                                               rotation: angle))
            }
            petals.append(UnitPath.circle(0.5, 0.5, 0.2))
            return UnitPath.union(petals)
        },
        CutterShape(id: "butterfly", name: "Butterfly", category: .cute) {
            UnitPath.union([
                UnitPath.ellipse(0.28, 0.33, 0.25, 0.20, rotation: UnitPath.degrees(-25)),
                UnitPath.ellipse(0.72, 0.33, 0.25, 0.20, rotation: UnitPath.degrees(25)),
                UnitPath.ellipse(0.31, 0.69, 0.21, 0.17, rotation: UnitPath.degrees(25)),
                UnitPath.ellipse(0.69, 0.69, 0.21, 0.17, rotation: UnitPath.degrees(-25)),
                UnitPath.ellipse(0.50, 0.50, 0.06, 0.32),
            ])
        },
        CutterShape(id: "fish", name: "Fish", category: .cute) {
            UnitPath.union([
                UnitPath.polygon([CGPoint(x: 0.26, y: 0.50), CGPoint(x: 0.02, y: 0.20),
                                  CGPoint(x: 0.02, y: 0.80)]),
                UnitPath.ellipse(0.58, 0.50, 0.40, 0.27),
            ])
        },
        CutterShape(id: "leaf", name: "Leaf", category: .cute) {
            var p = Path()
            p.move(to: CGPoint(x: 0.5, y: 0.02))
            p.addCurve(to: CGPoint(x: 0.5, y: 0.98),
                       control1: CGPoint(x: 0.98, y: 0.28),
                       control2: CGPoint(x: 0.86, y: 0.86))
            p.addCurve(to: CGPoint(x: 0.5, y: 0.02),
                       control1: CGPoint(x: 0.14, y: 0.86),
                       control2: CGPoint(x: 0.02, y: 0.28))
            p.closeSubpath()
            return p
        },
        CutterShape(id: "cloud", name: "Cloud", category: .cute) {
            UnitPath.union([
                UnitPath.circle(0.30, 0.52, 0.22),
                UnitPath.circle(0.52, 0.42, 0.27),
                UnitPath.circle(0.74, 0.54, 0.20),
                UnitPath.roundedRect(0.08, 0.56, 0.84, 0.30, radius: 0.15),
            ])
        },
    ]

    // MARK: Seasonal

    private static let seasonal: [CutterShape] = [
        CutterShape(id: "gingerbread", name: "Gingerbread", category: .seasonal) {
            UnitPath.union([
                UnitPath.circle(0.5, 0.16, 0.155),
                UnitPath.roundedRect(0.33, 0.26, 0.34, 0.44, radius: 0.15),
                UnitPath.capsule(from: CGPoint(x: 0.50, y: 0.37),
                                 to: CGPoint(x: 0.08, y: 0.50), width: 0.15),
                UnitPath.capsule(from: CGPoint(x: 0.50, y: 0.37),
                                 to: CGPoint(x: 0.92, y: 0.50), width: 0.15),
                UnitPath.capsule(from: CGPoint(x: 0.46, y: 0.62),
                                 to: CGPoint(x: 0.31, y: 0.92), width: 0.16),
                UnitPath.capsule(from: CGPoint(x: 0.54, y: 0.62),
                                 to: CGPoint(x: 0.69, y: 0.92), width: 0.16),
            ])
        },
        CutterShape(id: "tree", name: "Fir Tree", category: .seasonal) {
            UnitPath.union([
                UnitPath.polygon([CGPoint(x: 0.50, y: 0.02), CGPoint(x: 0.76, y: 0.36),
                                  CGPoint(x: 0.24, y: 0.36)]),
                UnitPath.polygon([CGPoint(x: 0.50, y: 0.22), CGPoint(x: 0.86, y: 0.62),
                                  CGPoint(x: 0.14, y: 0.62)]),
                UnitPath.polygon([CGPoint(x: 0.50, y: 0.44), CGPoint(x: 0.97, y: 0.86),
                                  CGPoint(x: 0.03, y: 0.86)]),
                UnitPath.roundedRect(0.42, 0.80, 0.16, 0.18, radius: 0.03),
            ])
        },
        CutterShape(id: "snowman", name: "Snowman", category: .seasonal) {
            UnitPath.union([
                UnitPath.circle(0.5, 0.17, 0.16),
                UnitPath.circle(0.5, 0.45, 0.21),
                UnitPath.circle(0.5, 0.75, 0.25),
            ])
        },
        CutterShape(id: "ghost", name: "Ghost", category: .seasonal) {
            var p = Path()
            p.move(to: CGPoint(x: 0.06, y: 0.92))
            p.addLine(to: CGPoint(x: 0.06, y: 0.45))
            p.addCurve(to: CGPoint(x: 0.94, y: 0.45),
                       control1: CGPoint(x: 0.06, y: 0.04),
                       control2: CGPoint(x: 0.94, y: 0.04))
            p.addLine(to: CGPoint(x: 0.94, y: 0.92))
            p.addQuadCurve(to: CGPoint(x: 0.72, y: 0.92), control: CGPoint(x: 0.83, y: 0.76))
            p.addQuadCurve(to: CGPoint(x: 0.50, y: 0.92), control: CGPoint(x: 0.61, y: 1.00))
            p.addQuadCurve(to: CGPoint(x: 0.28, y: 0.92), control: CGPoint(x: 0.39, y: 0.76))
            p.addQuadCurve(to: CGPoint(x: 0.06, y: 0.92), control: CGPoint(x: 0.17, y: 1.00))
            p.closeSubpath()
            return p
        },
        CutterShape(id: "pumpkin", name: "Pumpkin", category: .seasonal) {
            UnitPath.union([
                UnitPath.roundedRect(0.44, 0.12, 0.12, 0.20, radius: 0.05),
                UnitPath.ellipse(0.28, 0.62, 0.26, 0.35),
                UnitPath.ellipse(0.72, 0.62, 0.26, 0.35),
                UnitPath.ellipse(0.50, 0.62, 0.46, 0.36),
            ])
        },
    ]

    // MARK: Fun

    private static let fun: [CutterShape] = [
        CutterShape(id: "crown", name: "Crown", category: .fun) {
            UnitPath.polygon([
                CGPoint(x: 0.03, y: 0.88), CGPoint(x: 0.03, y: 0.20),
                CGPoint(x: 0.26, y: 0.48), CGPoint(x: 0.50, y: 0.10),
                CGPoint(x: 0.74, y: 0.48), CGPoint(x: 0.97, y: 0.20),
                CGPoint(x: 0.97, y: 0.88),
            ])
        },
        CutterShape(id: "bolt", name: "Lightning", category: .fun) {
            UnitPath.polygon([
                CGPoint(x: 0.62, y: 0.02), CGPoint(x: 0.16, y: 0.56),
                CGPoint(x: 0.44, y: 0.56), CGPoint(x: 0.36, y: 0.98),
                CGPoint(x: 0.86, y: 0.42), CGPoint(x: 0.56, y: 0.42),
            ])
        },
        CutterShape(id: "speech", name: "Speech Bubble", category: .fun) {
            UnitPath.union([
                UnitPath.roundedRect(0.03, 0.10, 0.94, 0.62, radius: 0.18),
                UnitPath.polygon([CGPoint(x: 0.28, y: 0.64), CGPoint(x: 0.32, y: 0.97),
                                  CGPoint(x: 0.54, y: 0.66)]),
            ])
        },
    ]
}
