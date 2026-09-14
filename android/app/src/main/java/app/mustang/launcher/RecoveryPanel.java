package app.mustang.launcher;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.graphics.Color;
import android.provider.Settings;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

/**
 * What the driver sees if the HMI cannot run.
 *
 * <p>Built from plain framework views on purpose. This panel appears
 * exactly when the WebView, the bundle or React could not be trusted, so
 * it must not depend on any of them — and because the app is a Home
 * candidate, a launcher that fails without an exit is a device the user
 * cannot get back into. Every route out of here is a route to Android.
 */
final class RecoveryPanel {

    /** Automotive minimum touch target. Matches the HMI's own scale. */
    private static final int TOUCH_DP = 76;

    private RecoveryPanel() {
    }

    static View create(Activity activity, Runnable retry) {
        LinearLayout panel = new LinearLayout(activity);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER_VERTICAL);
        panel.setBackgroundColor(Color.BLACK);
        int pad = dp(activity, 48);
        panel.setPadding(pad, pad, pad, pad);

        panel.addView(text(activity, R.string.recovery_title, 28));
        panel.addView(text(activity, R.string.recovery_detail, 18));

        panel.addView(button(activity, R.string.recovery_retry, retry));
        panel.addView(button(activity, R.string.recovery_home,
            () -> openHomeChooser(activity)));
        panel.addView(button(activity, R.string.recovery_settings,
            () -> open(activity, new Intent(Settings.ACTION_SETTINGS))));

        return panel;
    }

    private static TextView text(Activity activity, int res, int sizeSp) {
        TextView view = new TextView(activity);
        view.setText(res);
        view.setTextColor(activity.getColor(R.color.recovery_text));
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp);
        view.setPadding(0, 0, 0, dp(activity, 16));
        return view;
    }

    private static Button button(Activity activity, int res, Runnable action) {
        Button button = new Button(activity);
        button.setText(res);
        button.setAllCaps(false);
        button.setTextColor(activity.getColor(R.color.recovery_text));
        button.setBackgroundColor(activity.getColor(R.color.recovery_button));
        button.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        button.setMinHeight(dp(activity, TOUCH_DP));
        button.setOnClickListener(v -> action.run());

        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(activity, 12);
        button.setLayoutParams(params);
        return button;
    }

    /**
     * Prefers Android's Home-settings screen. If the unit has none, falls
     * back to starting the resolved default Home component directly —
     * which is why the original launcher must stay installed and enabled.
     */
    private static void openHomeChooser(Activity activity) {
        Intent settings = new Intent(Settings.ACTION_HOME_SETTINGS);
        if (settings.resolveActivity(activity.getPackageManager()) != null) {
            open(activity, settings);
            return;
        }
        ComponentName home = AppCatalog.defaultHome(activity);
        if (home != null && !activity.getPackageName().equals(home.getPackageName())) {
            Intent direct = new Intent(Intent.ACTION_MAIN)
                .addCategory(Intent.CATEGORY_HOME)
                .setComponent(home)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            open(activity, direct);
            return;
        }
        Toast.makeText(activity, R.string.recovery_no_settings, Toast.LENGTH_LONG).show();
    }

    private static void open(Activity activity, Intent intent) {
        try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(intent);
        } catch (RuntimeException unavailable) {
            Toast.makeText(activity, R.string.recovery_no_settings, Toast.LENGTH_LONG).show();
        }
    }

    private static int dp(Activity activity, int value) {
        return Math.round(value * activity.getResources().getDisplayMetrics().density);
    }
}
