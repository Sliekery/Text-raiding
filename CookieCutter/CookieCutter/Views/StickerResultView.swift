import SwiftUI
import UIKit
import UniformTypeIdentifiers

/// Shown straight after a cut: the sticker on a chequerboard, plus what to do next.
struct StickerResultView: View {
    let image: UIImage
    let shapeName: String
    let url: URL

    @Environment(\.dismiss) private var dismiss
    @State private var showingShare = false
    @State private var status: String?
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                StickerPreview(image: image)
                    .frame(maxWidth: .infinity)
                    .frame(height: 260)

                VStack(spacing: 4) {
                    Text("Saved to your stickers")
                        .font(.headline)
                    Text("\(shapeName) · ready to use in Messages")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                VStack(spacing: 10) {
                    Button {
                        showingShare = true
                    } label: {
                        Label("Share", systemImage: "square.and.arrow.up")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 4)
                    }
                    .buttonStyle(.borderedProminent)

                    HStack(spacing: 10) {
                        Button {
                            Task { await saveToPhotos() }
                        } label: {
                            Label("Save to Photos", systemImage: "square.and.arrow.down")
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 4)
                        }
                        .buttonStyle(.bordered)

                        Button {
                            copyToPasteboard()
                        } label: {
                            Label("Copy", systemImage: "doc.on.doc")
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 4)
                        }
                        .buttonStyle(.bordered)
                    }
                }

                if let status {
                    Text(status)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .transition(.opacity)
                }

                Spacer(minLength: 0)
            }
            .padding()
            .navigationTitle("Nice cut")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .sheet(isPresented: $showingShare) {
                ShareSheet(items: [url])
            }
            .alert("Couldn't save", isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )) {
                Button("OK", role: .cancel) { errorMessage = nil }
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    private func saveToPhotos() async {
        do {
            try await PhotoSaver.save(image)
            withAnimation { status = "Saved to Photos" }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func copyToPasteboard() {
        guard let data = image.pngData() else { return }
        UIPasteboard.general.setData(data, forPasteboardType: UTType.png.identifier)
        withAnimation { status = "Copied — paste it into any chat" }
    }
}

/// A sticker on a chequerboard, so its transparency is obvious.
struct StickerPreview: View {
    let image: UIImage
    var cornerRadius: CGFloat = 18

    var body: some View {
        Checkerboard()
            .overlay {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .padding(10)
            }
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
    }
}
