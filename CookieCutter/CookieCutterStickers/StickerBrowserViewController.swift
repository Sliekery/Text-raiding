import Messages

/// A plain sticker grid fed from the shared library.
final class StickerBrowserViewController: MSStickerBrowserViewController {
    var stickers: [MSSticker] = []

    override func numberOfStickers(in stickerBrowserView: MSStickerBrowserView) -> Int {
        stickers.count
    }

    override func stickerBrowserView(_ stickerBrowserView: MSStickerBrowserView,
                                     stickerAt index: Int) -> MSSticker {
        stickers[index]
    }
}
