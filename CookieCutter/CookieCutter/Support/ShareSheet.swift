import SwiftUI
import UIKit

/// `UIActivityViewController` for SwiftUI — the route into Messages, WhatsApp,
/// Files, AirDrop and anything else that accepts an image.
struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
