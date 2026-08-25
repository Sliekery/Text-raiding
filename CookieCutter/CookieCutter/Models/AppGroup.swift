import Foundation

/// Where stickers live.
///
/// The app and the Messages extension are separate processes, so they can only
/// see the same files through a shared **App Group** container. If the group is
/// not configured yet (or the entitlement is missing), we fall back to the app's
/// own Documents folder: the app keeps working, only the Messages extension comes
/// up empty — see `isSharedContainerAvailable`.
enum AppGroup {

    /// Must match the App Group in both targets' entitlements.
    /// Change this together with `CookieCutter.entitlements` and
    /// `CookieCutterStickers.entitlements` if you use your own bundle identifier.
    static let identifier = "group.com.example.CookieCutter"

    static var isSharedContainerAvailable: Bool {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: identifier) != nil
    }

    private static var containerURL: URL {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: identifier)
            ?? FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }

    /// Created on first access.
    static let stickersDirectory: URL = {
        let directory = containerURL.appendingPathComponent("Stickers", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }()

    static var indexURL: URL { stickersDirectory.appendingPathComponent("index.json") }
}
