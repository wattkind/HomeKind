import Capacitor
import UIKit

/// The app's bridge view controller (set on Main.storyboard). Its only job is to
/// register the plugins that live in this project rather than in a package.
class BridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(BackupZipPlugin())
    }
}
