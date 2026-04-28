package com.nightskygames.slimesprout;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(SystemUiPlugin.class);
    super.onCreate(savedInstanceState);
        hideSystemUI();
        FacebookSdk.sdkInitialize(getApplicationContext());
    // Edge-to-edge: WebView draws under status / nav bars; CSS env(safe-area-inset-*) pads HUD.
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    // Hide status/nav bars immediately (before WebView paints loading UI). React syncs Slimes/Market later.
    SystemUiPlugin.applyImmersive(this, true);
  }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemUI();
        }
    }
    private void hideSystemUI() {

        // Make the status bar transparent
        Window window = getWindow();
        window.setStatusBarColor(Color.TRANSPARENT);
        // Tell the window to draw behind the status and navigation bars
        window.setDecorFitsSystemWindows(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            final WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            //noinspection deprecation
            View decorView = getWindow().getDecorView();
            decorView.setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_FULLSCREEN);
        }
    }
}

