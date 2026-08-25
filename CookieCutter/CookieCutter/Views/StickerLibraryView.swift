import SwiftUI
import UIKit

/// Everything you have cut out so far. The same folder the Messages extension reads.
struct StickerLibraryView: View {
    @EnvironmentObject private var store: StickerStore
    @State private var showingHelp = false

    private let columns = [GridItem(.adaptive(minimum: 104), spacing: 12)]

    var body: some View {
        NavigationStack {
            Group {
                if store.stickers.isEmpty {
                    empty
                } else {
                    grid
                }
            }
            .navigationTitle("My Stickers")
            .background(Color(.systemGroupedBackground))
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingHelp = true
                    } label: {
                        Image(systemName: "questionmark.circle")
                    }
                    .accessibilityLabel("How to use these in Messages")
                }
            }
            .navigationDestination(for: Sticker.self) { sticker in
                StickerDetailView(sticker: sticker)
            }
            .sheet(isPresented: $showingHelp) {
                MessagesHelpView()
            }
            .onAppear { store.reload() }
        }
    }

    private var grid: some View {
        ScrollView {
            LazyVGrid(columns: columns, spacing: 12) {
                ForEach(store.stickers) { sticker in
                    NavigationLink(value: sticker) {
                        cell(for: sticker)
                    }
                    .buttonStyle(.plain)
                    .contextMenu {
                        Button(role: .destructive) {
                            store.delete(sticker)
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
                }
            }
            .padding(16)
        }
    }

    @ViewBuilder
    private func cell(for sticker: Sticker) -> some View {
        if let image = store.image(for: sticker) {
            StickerPreview(image: image, cornerRadius: 16)
                .aspectRatio(1, contentMode: .fit)
                .draggable(Image(uiImage: image))
                .accessibilityLabel(sticker.localizedDescription)
        } else {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color.secondary.opacity(0.15))
                .aspectRatio(1, contentMode: .fit)
        }
    }

    private var empty: some View {
        ContentUnavailableView {
            Label("No stickers yet", systemImage: "square.on.circle")
        } description: {
            Text("Pick a cookie cutter on the Cutter tab, line up a photo, "
                 + "and tap Cut it out.")
        }
    }
}

/// The bit people ask about: where the stickers actually show up.
struct MessagesHelpView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("In Messages") {
                    step(1, "Open a conversation in Messages.")
                    step(2, "Tap the ⊕ next to the text field, then CookieCutter.")
                    step(3, "Tap a sticker to send it, or drag it onto a message "
                          + "bubble to stick it there.")
                }

                Section("Anywhere else") {
                    step(1, "Open a sticker and tap Share to send it straight to "
                          + "WhatsApp, Mail, AirDrop or Files.")
                    step(2, "Or tap Copy and paste it into any chat — the "
                          + "transparent background comes along.")
                }

                if !AppGroup.isSharedContainerAvailable {
                    Section {
                        Label("The Messages extension can't see your stickers yet: "
                              + "the App Group isn't configured for this build. "
                              + "See the project README.",
                              systemImage: "exclamationmark.triangle")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Using your stickers")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private func step(_ number: Int, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text("\(number)")
                .font(.caption.bold())
                .frame(width: 22, height: 22)
                .background(Circle().fill(Color.accentColor.opacity(0.18)))
            Text(text)
        }
        .padding(.vertical, 2)
    }
}

#Preview {
    StickerLibraryView().environmentObject(StickerStore.shared)
}
