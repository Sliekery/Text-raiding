import Messages
import UIKit

/// The CookieCutter drawer inside Messages.
///
/// It owns a sticker browser and refills it every time it appears, so a sticker
/// you cut out in the app is there the moment you switch back to a conversation.
final class MessagesViewController: MSMessagesAppViewController {

    private let store = StickerStore()
    private var browser: StickerBrowserViewController?

    private lazy var emptyLabel: UILabel = {
        let label = UILabel()
        label.text = "No stickers yet.\nCut some out in CookieCutter."
        label.numberOfLines = 0
        label.textAlignment = .center
        label.textColor = .secondaryLabel
        label.font = .preferredFont(forTextStyle: .subheadline)
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    override func viewDidLoad() {
        super.viewDidLoad()
        installBrowser()
        installEmptyLabel()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        reload()
    }

    override func willBecomeActive(with conversation: MSConversation) {
        super.willBecomeActive(with: conversation)
        reload()
    }

    // MARK: Setup

    private func installBrowser() {
        let browser = StickerBrowserViewController(stickerSize: .regular)
        addChild(browser)
        browser.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(browser.view)
        NSLayoutConstraint.activate([
            browser.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            browser.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            browser.view.topAnchor.constraint(equalTo: view.topAnchor),
            browser.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
        browser.didMove(toParent: self)
        browser.stickerBrowserView.backgroundColor = .clear
        self.browser = browser
    }

    private func installEmptyLabel() {
        view.addSubview(emptyLabel)
        NSLayoutConstraint.activate([
            emptyLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            emptyLabel.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            emptyLabel.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor,
                                                constant: 24),
            emptyLabel.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor,
                                                 constant: -24),
        ])
    }

    private func reload() {
        store.reload()
        let stickers = store.stickers.compactMap { sticker -> MSSticker? in
            try? MSSticker(contentsOfFileURL: sticker.stickerURL,
                           localizedDescription: sticker.localizedDescription)
        }
        browser?.stickers = stickers
        browser?.stickerBrowserView.reloadData()
        emptyLabel.isHidden = !stickers.isEmpty
    }
}
