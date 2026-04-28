package com.nightskygames.slimeschooltycoon;

import com.getcapacitor.BridgeActivity;

import android.os.Bundle;
import android.util.Log;
import com.singular.sdk.Singular;
import com.singular.sdk.SingularConfig;
import com.facebook.FacebookSdk;
import android.graphics.Color;
import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.view.WindowInsets;
import android.view.WindowInsetsController;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "Singular";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        hideSystemUI();
        FacebookSdk.sdkInitialize(getApplicationContext());
        SingularConfig config = new SingularConfig("lumidlabs_cdb31fca", "aaf9a79c33b9ad6d3df20905f0ac8c15");
        config.withLoggingEnabled();
        Singular.init(this, config);
    }

    @Override
    public void onResume() {
        super.onResume();
        hideSystemUI();
        Log.d(TAG, "onResume: Sending Login event to Singular");
        Singular.event("Login");
        Log.d(TAG, "onResume: Login event sent successfully.");
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



