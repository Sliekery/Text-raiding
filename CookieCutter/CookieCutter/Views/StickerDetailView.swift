import SwiftUI
import UIKit
import UniformTypeIdentifiers

struct StickerDetailView: View {
    let sticker: Sticker

    @EnvironmentObject private var store: StickerStore
    @Environment(\.dismiss) private var dismiss
    @State private var showingShare = false
    @State private var status: String?
    @State private var errorMessage: String?

    private var image: UIImage? { store.image(for: sticker) }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                if let image {
                    StickerPreview(image: image)
                        .frame(height: 300)
                        .draggable(Image(uiImage: image))
                }

                Text(sticker.createdAt.formatted(date: .abbreviated, time: .shortened))
                    .font(.footnote)
                    .foregroundStyle(.secondary)

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
                            Label("Photos", systemImage: "square.and.arrow.down")
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

                    Button(role: .destructive) {
                        store.delete(sticker)
                        dismiss()
                    } label: {
                        Label("Delete", systemImage: "trash")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 4)
                    }
                    .buttonStyle(.bordered)
                }

                if let status {
                    Text(status)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .padding()
        }
        .navigationTitle(sticker.shapeName)
        .navigationBarTitleDisplayMode(.inline)
        .background(Color(.systemGroupedBackground))
        .sheet(isPresented: $showingShare) {
            ShareSheet(items: [sticker.url])
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

    private func saveToPhotos() async {
        guard let image else { return }
        do {
            try await PhotoSaver.save(image)
            withAnimation { status = "Saved to Photos" }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func copyToPasteboard() {
        guard let data = try? Data(contentsOf: sticker.url) else { return }
        UIPasteboard.general.setData(data, forPasteboardType: UTType.png.identifier)
        withAnimation { status = "Copied — paste it into any chat" }
    }
}
