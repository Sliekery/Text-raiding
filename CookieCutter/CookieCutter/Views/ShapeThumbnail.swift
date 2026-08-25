import SwiftUI

/// One cutter in the picker strip.
struct ShapeThumbnail: View {
    let shape: CutterShape
    let isSelected: Bool

    private var gradient: LinearGradient {
        LinearGradient(colors: isSelected ? [.accentColor, .accentColor.opacity(0.55)]
                                          : [Color.primary.opacity(0.55),
                                             Color.primary.opacity(0.32)],
                       startPoint: .topLeading, endPoint: .bottomTrailing)
    }

    var body: some View {
        VStack(spacing: 6) {
            CutterShapeView(shape: shape)
                .fill(gradient)
                .frame(width: 44, height: 44)
                .padding(8)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(isSelected ? Color.accentColor.opacity(0.16)
                                         : Color.primary.opacity(0.06))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(isSelected ? Color.accentColor : .clear, lineWidth: 2)
                )

            Text(shape.name)
                .font(.caption2)
                .lineLimit(1)
                .foregroundStyle(isSelected ? Color.accentColor : .secondary)
                .frame(width: 64)
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel(shape.name)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}

#Preview {
    HStack {
        ShapeThumbnail(shape: CutterShapeLibrary.default, isSelected: true)
        ShapeThumbnail(shape: CutterShapeLibrary.all[2], isSelected: false)
    }
}
