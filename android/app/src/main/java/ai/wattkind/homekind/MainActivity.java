package ai.wattkind.homekind;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins that live in this project rather than in a package.
        registerPlugin(BackupZipPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
