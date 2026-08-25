import SwiftUI

struct RootView: View {
    @EnvironmentObject private var store: StickerStore

    var body: some View {
        TabView {
            CutterEditorView()
                .tabItem { Label("Cutter", systemImage: "scissors") }

            StickerLibraryView()
                .tabItem { Label("Stickers", systemImage: "square.on.circle") }
                .badge(store.stickers.count)
        }
    }
}

#Preview {
    RootView().environmentObject(StickerStore.shared)
}
