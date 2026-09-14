package app.mustang.launcher;

import android.app.Activity;
import android.graphics.Rect;
import android.os.Build;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Display;
import android.view.View;
import android.view.WindowManager;
import android.view.WindowMetrics;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Reports the numbers needed to settle the panel-geometry question on a
 * real unit, instead of reasoning about it.
 *
 * <p>The HMI is composed for 2400x900 CSS pixels, but WebView expresses
 * the CSS viewport in density-independent pixels, so what the page
 * actually sees depends on the density the vendor configured. This class
 * supplies the native half of that picture — physical pixels, density,
 * densityDpi, and the WebView's own measured size — which the debug
 * overlay pairs with the page's `devicePixelRatio`, `innerWidth` and
 * `visualViewport`.
 *
 * <p>Debug builds only. In a release build the bridge refuses the call,
 * so a shipped launcher exposes nothing about the device to the page.
 *
 * <p>It is also written to logcat once at start-up, which makes it
 * available from a bench without touching the screen:
 * {@code adb logcat -s MustangPanel:I}
 */
final class Diagnostics {

    static final String TAG = "MustangPanel";

    /** The composition the HMI is authored against. */
    private static final int PANEL_WIDTH = 2400;
    private static final int PANEL_HEIGHT = 900;

    private Diagnostics() {
    }

    static boolean enabled() {
        return BuildConfig.DEBUG;
    }

    /**
     * @param web the hosting WebView, or null before it exists
     */
    static JSONObject snapshot(Activity activity, View web) throws JSONException {
        JSONObject result = new JSONObject();
        DisplayMetrics metrics = activity.getResources().getDisplayMetrics();

        result.put("panelWidth", PANEL_WIDTH);
        result.put("panelHeight", PANEL_HEIGHT);

        // Density as Android reports it. density == densityDpi / 160, and
        // it is exactly the divisor between physical px and the CSS px a
        // WebView hands the page by default.
        result.put("density", metrics.density);
        result.put("densityDpi", metrics.densityDpi);
        result.put("scaledDensity", metrics.scaledDensity);
        result.put("fontScale", activity.getResources().getConfiguration().fontScale);
        result.put("xdpi", metrics.xdpi);
        result.put("ydpi", metrics.ydpi);

        // The window's own metrics, which is what the WebView is laid out
        // inside — not the raw display, which may include system bars.
        Rect bounds = windowBounds(activity);
        result.put("windowWidthPx", bounds.width());
        result.put("windowHeightPx", bounds.height());

        Rect display = displayBounds(activity);
        result.put("displayWidthPx", display.width());
        result.put("displayHeightPx", display.height());

        result.put("webViewWidthPx", web == null ? 0 : web.getWidth());
        result.put("webViewHeightPx", web == null ? 0 : web.getHeight());

        // What the page should see if nothing corrected the viewport.
        float density = metrics.density <= 0 ? 1f : metrics.density;
        result.put("defaultCssWidth", bounds.width() / density);
        result.put("defaultCssHeight", bounds.height() / density);

        result.put("sdk", Build.VERSION.SDK_INT);
        result.put("release", Build.VERSION.RELEASE);
        result.put("model", Build.MODEL);
        result.put("device", Build.DEVICE);
        result.put("board", Build.BOARD);
        result.put("hardware", Build.HARDWARE);
        return result;
    }

    static void log(Activity activity, View web) {
        if (!enabled()) return;
        try {
            Log.i(TAG, snapshot(activity, web).toString());
        } catch (JSONException | RuntimeException ignored) {
            // Diagnostics must never be the reason the launcher fails.
        }
    }

    @SuppressWarnings("deprecation")
    private static Rect windowBounds(Activity activity) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowManager manager = activity.getWindowManager();
            WindowMetrics metrics = manager.getCurrentWindowMetrics();
            return new Rect(metrics.getBounds());
        }
        DisplayMetrics legacy = new DisplayMetrics();
        activity.getWindowManager().getDefaultDisplay().getMetrics(legacy);
        return new Rect(0, 0, legacy.widthPixels, legacy.heightPixels);
    }

    @SuppressWarnings("deprecation")
    private static Rect displayBounds(Activity activity) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowMetrics metrics = activity.getWindowManager().getMaximumWindowMetrics();
            return new Rect(metrics.getBounds());
        }
        DisplayMetrics real = new DisplayMetrics();
        Display display = activity.getWindowManager().getDefaultDisplay();
        display.getRealMetrics(real);
        return new Rect(0, 0, real.widthPixels, real.heightPixels);
    }
}
