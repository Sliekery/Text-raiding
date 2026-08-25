import SwiftUI

/// The die-cut border and shadow, with a live preview of the current cutter.
struct StyleSheet: View {
    @Binding var style: StickerStyle
    let shape: CutterShape
    @Environment(\.dismiss) private var dismiss

    private var borderColor: Color {
        let (red, green, blue) = style.border.components
        return Color(red: red, green: green, blue: blue)
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                preview
                    .frame(height: 150)
                    .padding(.top, 8)

                Form {
                    Section("Border") {
                        Picker("Thickness", selection: borderWidthBinding) {
                            ForEach(StickerStyle.borderPresets) { preset in
                                Text(preset.name).tag(preset.width)
                            }
                        }
                        .pickerStyle(.segmented)

                        HStack(spacing: 14) {
                            ForEach(StickerStyle.BorderColor.allCases) { option in
                                let (red, green, blue) = option.components
                                Button {
                                    style.border = option
                                } label: {
                                    Circle()
                                        .fill(Color(red: red, green: green, blue: blue))
                                        .frame(width: 30, height: 30)
                                        .overlay(Circle().strokeBorder(Color.primary.opacity(0.15), lineWidth: 1))
                                        .overlay(
                                            Circle()
                                                .strokeBorder(Color.accentColor, lineWidth: 3)
                                                .padding(-4)
                                                .opacity(style.border == option ? 1 : 0)
                                        )
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel(option.rawValue)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 4)
                    }

                    Section {
                        Toggle("Drop shadow", isOn: $style.hasShadow)
                    } footer: {
                        Text("Stickers keep their transparent background — "
                             + "the border and shadow are drawn into the PNG.")
                    }
                }
            }
            .navigationTitle("Sticker Style")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    /// Mirrors `StickerRenderer`: a filled-and-stroked silhouette in the border
    /// colour, with the "photo" standing in as a gradient.
    private var preview: some View {
        GeometryReader { geometry in
            let side = min(geometry.size.width, geometry.size.height)
            let inset = side * style.padding
            let content = side - inset * 2
            ZStack {
                Checkerboard(square: 10)
                    .frame(width: side, height: side)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                CutterShapeView(shape: shape)
                    .fill(borderColor)
                    .overlay(
                        CutterShapeView(shape: shape)
                            .stroke(borderColor, style: StrokeStyle(lineWidth: style.borderWidth * side * 2,
                                                                    lineCap: .round, lineJoin: .round))
                    )
                    .frame(width: content, height: content)
                    .shadow(color: style.hasShadow ? .black.opacity(0.32) : .clear,
                            radius: side * 0.03, x: 0, y: side * 0.012)

                CutterShapeView(shape: shape)
                    .fill(LinearGradient(colors: [.orange, .pink, .purple],
                                         startPoint: .topLeading, endPoint: .bottomTrailing))
                    .frame(width: content, height: content)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private var borderWidthBinding: Binding<CGFloat> {
        Binding(get: { style.borderWidth }, set: { style.borderWidth = $0 })
    }
}

#Preview {
    StyleSheet(style: .constant(StickerStyle()), shape: CutterShapeLibrary.default)
}
