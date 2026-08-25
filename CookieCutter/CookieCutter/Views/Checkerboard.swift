import SwiftUI

/// The usual grey chequerboard, so transparent parts of a sticker read as
/// transparent instead of white.
struct Checkerboard: View {
    var square: CGFloat = 12

    var body: some View {
        Canvas { context, size in
            context.fill(Path(CGRect(origin: .zero, size: size)),
                         with: .color(Color(white: 0.96)))
            let columns = Int(ceil(size.width / square))
            let rows = Int(ceil(size.height / square))
            var dark = Path()
            for row in 0..<max(rows, 0) {
                for column in 0..<max(columns, 0) where (row + column).isMultiple(of: 2) {
                    dark.addRect(CGRect(x: CGFloat(column) * square, y: CGFloat(row) * square,
                                        width: square, height: square))
                }
            }
            context.fill(dark, with: .color(Color(white: 0.88)))
        }
    }
}
