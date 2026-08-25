import SwiftUI

@main
struct CookieCutterApp: App {
    @StateObject private var store = StickerStore.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
        }
    }
}
