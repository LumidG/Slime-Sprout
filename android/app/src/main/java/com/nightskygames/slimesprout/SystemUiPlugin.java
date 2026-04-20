package com.nightskygames.slimesprout;

import android.app.Activity;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SystemUi")
public class SystemUiPlugin extends Plugin {

  /** Apply as soon as the window exists — before WebView/JS, avoids a frame of visible system UI. */
  public static void applyImmersive(Activity activity, boolean hide) {
    if (activity == null) return;
    WindowInsetsControllerCompat controller =
        WindowCompat.getInsetsController(activity.getWindow(), activity.getWindow().getDecorView());
    if (hide) {
      controller.hide(WindowInsetsCompat.Type.systemBars());
      controller.setSystemBarsBehavior(
          WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    } else {
      controller.show(WindowInsetsCompat.Type.systemBars());
    }
  }

  @PluginMethod
  public void setImmersive(PluginCall call) {
    Boolean hide = call.getBoolean("hide", false);
    if (getActivity() == null) {
      call.reject("Activity not available");
      return;
    }
    getActivity()
        .runOnUiThread(
            () -> {
              applyImmersive(getActivity(), Boolean.TRUE.equals(hide));
              call.resolve();
            });
  }
}
