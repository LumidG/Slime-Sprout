package com.nightskygames.slimesprout;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(SystemUiPlugin.class);
    super.onCreate(savedInstanceState);
    // Edge-to-edge: WebView draws under status / nav bars; CSS env(safe-area-inset-*) pads HUD.
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    // Hide status/nav bars immediately (before WebView paints loading UI). React syncs Slimes/Market later.
    SystemUiPlugin.applyImmersive(this, true);
  }
}
