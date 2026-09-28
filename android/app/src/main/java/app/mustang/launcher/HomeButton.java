package app.mustang.launcher;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageView;

/**
 * A floating Home button drawn over other apps while the launcher is in
 * the background, so Waze or YouTube is always one tap from the HMI even
 * on a unit with no hardware Home key.
 *
 * <p>It exists only while the launcher is stopped, only with the user's
 * "display over other apps" grant, and does exactly one thing: bring the
 * launcher back. It can be dragged along the driver-side edge so it never
 * sits on top of a control the other app needs.
 */
final class HomeButton {

    /** Share of the panel height, so the target scales with the glass. */
    private static final float SIZE_OF_HEIGHT = 0.13f;

    private final Context context;
    private final WindowManager windows;
    private View view;
    private WindowManager.LayoutParams params;
    /** Remembered across show/hide so a dragged button stays put. */
    private int y = Integer.MIN_VALUE;

    HomeButton(Context context) {
        this.context = context.getApplicationContext();
        this.windows = (WindowManager) this.context.getSystemService(Context.WINDOW_SERVICE);
    }

    static boolean allowed(Context context) {
        return Settings.canDrawOverlays(context);
    }

    static Intent grantIntent(Context context) {
        return new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            android.net.Uri.fromParts("package", context.getPackageName(), null))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    }

    void show() {
        if (view != null || windows == null || !allowed(context)) return;
        DisplayMetrics metrics = context.getResources().getDisplayMetrics();
        int size = Math.round(Math.min(metrics.widthPixels, metrics.heightPixels) * SIZE_OF_HEIGHT);
        if (y == Integer.MIN_VALUE) y = (metrics.heightPixels - size) / 2;

        ImageView button = new ImageView(context);
        button.setImageResource(R.drawable.ic_home_button);
        button.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        int pad = size / 4;
        button.setPadding(pad, pad, pad, pad);
        GradientDrawable disc = new GradientDrawable();
        disc.setShape(GradientDrawable.OVAL);
        disc.setColor(Color.argb(210, 18, 20, 22));
        disc.setStroke(Math.max(1, size / 60), Color.argb(60, 255, 255, 255));
        button.setBackground(disc);
        button.setContentDescription("الرئيسية");
        button.setOnTouchListener(new Drag(size));

        params = new WindowManager.LayoutParams(
            size, size,
            Build.VERSION.SDK_INT >= 26
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.TOP | Gravity.LEFT;
        params.x = size / 6;
        params.y = y;
        try {
            windows.addView(button, params);
            view = button;
        } catch (RuntimeException refused) {
            // Permission revoked between the check and the add.
            view = null;
        }
    }

    void hide() {
        if (view == null) return;
        try {
            windows.removeView(view);
        } catch (RuntimeException alreadyGone) {
            // Nothing to remove.
        }
        view = null;
    }

    private void goHome() {
        Intent home = new Intent(context, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        context.startActivity(home);
    }

    /** Vertical drag along the edge; a touch that barely moves is a tap. */
    private final class Drag implements View.OnTouchListener {
        private final int slop;
        private float downY;
        private int startY;
        private boolean dragging;

        Drag(int size) {
            this.slop = size / 5;
        }

        @SuppressLint("ClickableViewAccessibility")
        @Override
        public boolean onTouch(View v, MotionEvent event) {
            switch (event.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    downY = event.getRawY();
                    startY = params.y;
                    dragging = false;
                    v.setAlpha(0.7f);
                    return true;
                case MotionEvent.ACTION_MOVE: {
                    float dy = event.getRawY() - downY;
                    if (!dragging && Math.abs(dy) > slop) dragging = true;
                    if (dragging) {
                        int max = context.getResources().getDisplayMetrics().heightPixels - params.height;
                        params.y = Math.max(0, Math.min(max, startY + Math.round(dy)));
                        y = params.y;
                        try {
                            windows.updateViewLayout(v, params);
                        } catch (RuntimeException gone) {
                            // Removed mid-drag.
                        }
                    }
                    return true;
                }
                case MotionEvent.ACTION_UP:
                    v.setAlpha(1f);
                    if (!dragging) goHome();
                    return true;
                case MotionEvent.ACTION_CANCEL:
                    v.setAlpha(1f);
                    return true;
                default:
                    return false;
            }
        }
    }
}
