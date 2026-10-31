import Capacitor
import UIKit

/// The app's bridge view controller, created by SceneDelegate. Its only job is to
/// register the plugins that live in this project rather than in a package.
/// `capacitorDidLoad` runs before the web view loads, so the plugin's JS header is
/// in place when the app's JavaScript calls `registerPlugin('BackupZip')`.
class BridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(BackupZipPlugin())
    }
}
