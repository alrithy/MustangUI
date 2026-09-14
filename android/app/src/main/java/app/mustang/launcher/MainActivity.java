package app.mustang.launcher;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/**
 * The launcher itself: a black window hosting the bundled Mustang HMI.
 *
 * <p>Start-up contract, in order, with no other colour anywhere in it:
 * the theme's black launch window, the black splash on Android 12+, this
 * activity's black decor, a black WebView, the bundle's own inline black
 * first paint, and only then the approved pony sequence.
 */
public final class MainActivity extends Activity implements HostChannel, NativeBridge.Host {

    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final String HOST = "appassets.androidplatform.net";
    private static final String BUNDLE_PREFIX = "/web";
    private static final String JS_OBJECT = "MustangHost";

    /**
     * How long the HMI gets to report itself up before the native
     * recovery panel takes over. Generous: a cold QCM6125 start with a
     * cold WebView is not a fast machine.
     */
    private static final long READY_TIMEOUT_MS = 20_000L;

    /**
     * The bundle is composed for a 2400x900 panel in CSS pixels. A
     * WebView defaults to 1 CSS px == 1 dp, so on any unit whose density
     * is not 1.0 the layout viewport would come out as 2400/density and
     * the approved composition would be cropped or letterboxed. Pinning
     * the scale to 100 makes 1 CSS px == 1 physical px, which reproduces
     * the approved geometry exactly whatever density the vendor reports.
     * Verify with `adb shell wm size` and `wm density`.
     */
    private static final int PIXEL_EXACT_SCALE = 100;

    private static final String CSP =
        "default-src 'self'; "
            + "script-src 'self'; "
            + "style-src 'self' 'unsafe-inline'; "
            + "img-src 'self' data:; "
            + "font-src 'self'; "
            + "connect-src 'none'; "
            + "frame-src 'none'; "
            + "object-src 'none'; "
            + "base-uri 'none'; "
            + "form-action 'none'";

    private final Handler main = new Handler(Looper.getMainLooper());

    private WebView web;
    private WebViewAssetLoader assets;
    private NativeBridge bridge;
    private MediaHub media;
    private AppCatalog apps;
    private SystemMonitor system;

    private JavaScriptReplyProxy channel;
    private boolean uiReady;
    private boolean recovered;

    private final Runnable watchdog = () -> {
        if (!uiReady) recover();
    };

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().getDecorView().setBackgroundColor(Color.BLACK);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        goImmersive();
        startHmi();
    }

    /* ---------------- HMI host ---------------- */

    private void startHmi() {
        uiReady = false;
        recovered = false;
        try {
            buildWebView();
        } catch (RuntimeException | Error failure) {
            // A unit without a usable WebView must still reach Android.
            recover();
        }
    }

    private void buildWebView() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            // Without this the only alternative is addJavascriptInterface,
            // which cannot be origin-scoped. Recovery beats a weaker bridge.
            recover();
            return;
        }

        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);
        // A head unit has no text-selection or context-menu affordances.
        web.setLongClickable(false);
        web.setHapticFeedbackEnabled(false);
        web.setOnLongClickListener(v -> true);
        web.setInitialScale(PIXEL_EXACT_SCALE);

        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);       // the HMI is a React app
        settings.setDomStorageEnabled(true);       // settings persistence
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setGeolocationEnabled(false);
        settings.setSaveFormData(false);
        settings.setDatabaseEnabled(false);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        // Ignore the document's own viewport meta so PIXEL_EXACT_SCALE is
        // what actually decides the layout viewport.
        settings.setUseWideViewPort(false);
        settings.setLoadWithOverviewMode(false);
        // The panel's font size is part of the approved design; a vendor
        // system font-size setting must not reflow the HMI.
        settings.setTextZoom(100);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        WebView.setWebContentsDebuggingEnabled(false);

        assets = new WebViewAssetLoader.Builder()
            .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();

        WebViewCompat.addWebMessageListener(
            web, JS_OBJECT, Collections.singleton(ORIGIN), this::onWebMessage);

        web.setWebViewClient(new HmiWebViewClient());
        setContentView(web);
        web.loadUrl(ORIGIN + "/index.html");
        main.postDelayed(watchdog, READY_TIMEOUT_MS);

        startNativeServices();
    }

    private void startNativeServices() {
        media = new MediaHub(this, this);
        apps = new AppCatalog(this, this);
        system = new SystemMonitor(this, this);
        bridge = new NativeBridge(this, media, apps, system);
        media.start();
        apps.start();
        system.start();
    }

    private void onWebMessage(WebView view, WebMessageCompat message, Uri sourceOrigin,
                              boolean isMainFrame, JavaScriptReplyProxy reply) {
        // Origin and frame are both checked: a subframe is not the HMI.
        if (!isMainFrame || !ORIGIN.equals(sourceOrigin.toString())) return;
        String data = message.getData();
        if (data == null) return;

        JSONObject request;
        try {
            request = new JSONObject(data);
        } catch (Exception malformed) {
            // A frame we cannot parse has no authority to do anything.
            return;
        }

        channel = reply;
        if (bridge == null) return;
        JSONObject response = bridge.handle(request);
        try {
            reply.postMessage(response.toString());
        } catch (RuntimeException gone) {
            // The page went away between request and reply.
        }
    }

    /* ---------------- HostChannel ---------------- */

    @Override
    public void event(String name, String data) {
        main.post(() -> {
            JavaScriptReplyProxy target = channel;
            if (target == null || web == null) return;
            try {
                target.postMessage("{\"event\":\"" + name + "\",\"data\":" + data + "}");
            } catch (RuntimeException gone) {
                // Page torn down; the next subscribe re-establishes it.
            }
        });
    }

    /* ---------------- NativeBridge.Host ---------------- */

    @Override
    public void onUiReady() {
        main.post(() -> {
            uiReady = true;
            main.removeCallbacks(watchdog);
        });
    }

    @Override
    public void onUiFailure(String message) {
        main.post(this::recover);
    }

    /* ---------------- Recovery ---------------- */

    /**
     * Always posted, never called inline from a WebView callback: tearing
     * down a WebView from inside one of its own callbacks is a crash.
     */
    private void recover() {
        main.post(() -> {
            if (recovered) return;
            recovered = true;
            main.removeCallbacks(watchdog);
            destroyWebView();
            setContentView(RecoveryPanel.create(this, this::startHmi));
        });
    }

    private void destroyWebView() {
        channel = null;
        if (web == null) return;
        WebView doomed = web;
        web = null;
        doomed.setWebViewClient(new WebViewClient());
        doomed.stopLoading();
        doomed.loadUrl("about:blank");
        ViewGroup parent = (ViewGroup) doomed.getParent();
        if (parent != null) parent.removeView(doomed);
        doomed.destroy();
    }

    /* ---------------- Window ---------------- */

    private void goImmersive() {
        View decor = getWindow().getDecorView();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController controller = decor.getWindowInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.systemBars());
                controller.setSystemBarsBehavior(
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            legacyImmersive(decor);
        }
    }

    @SuppressWarnings("deprecation")
    private void legacyImmersive(View decor) {
        decor.setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    /* ---------------- Lifecycle ---------------- */

    @Override
    protected void onResume() {
        super.onResume();
        goImmersive();
        if (web != null) web.onResume();
        // Notification access may have been granted while we were away.
        if (media != null) media.refresh();
        if (system != null) system.push();
        if (apps != null) apps.push();
    }

    @Override
    protected void onPause() {
        if (web != null) web.onPause();
        super.onPause();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        // Pressing Home while already here should land on the HMI's Home,
        // which is what a launcher is expected to do.
        goHome();
    }

    @Override
    public void onWindowFocusChanged(boolean focused) {
        super.onWindowFocusChanged(focused);
        if (focused) goImmersive();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        // A launcher has nothing to go back to. Back returns to the HMI's
        // Home rather than finishing the activity and showing whatever is
        // behind it.
        goHome();
    }

    private void goHome() {
        if (web == null) return;
        web.evaluateJavascript("window.dispatchEvent(new Event('mustang:home'))", null);
    }

    @Override
    protected void onDestroy() {
        main.removeCallbacksAndMessages(null);
        if (media != null) media.release();
        if (apps != null) apps.release();
        if (system != null) system.release();
        destroyWebView();
        super.onDestroy();
    }

    /* ---------------- Asset serving ---------------- */

    private final class HmiWebViewClient extends WebViewClient {

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if ("https".equals(uri.getScheme()) && HOST.equals(uri.getHost())) {
                // The Vite build references assets from the site root, so
                // the request path is mapped under the bundle's asset
                // prefix rather than rewriting the build output.
                WebResourceResponse response =
                    assets.shouldInterceptRequest(Uri.parse(ORIGIN + BUNDLE_PREFIX + uri.getPath()));
                if (response != null) {
                    Map<String, String> headers = new HashMap<>();
                    headers.put("Content-Security-Policy", CSP);
                    headers.put("X-Content-Type-Options", "nosniff");
                    response.setResponseHeaders(headers);
                    return response;
                }
            }
            // Everything else — every other origin, every scheme — is
            // refused. The privileged HMI WebView never loads a remote
            // page, which is also why INTERNET is not requested at all.
            return blocked();
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            // No navigation out of the bundle, ever. Links to real apps go
            // through the bridge's allowlisted launch path instead.
            return true;
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) recover();
        }

        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            // Returning true keeps the process alive; the WebView is dead
            // either way, so recovery rebuilds it rather than crashing.
            recover();
            return true;
        }
    }

    private static WebResourceResponse blocked() {
        return new WebResourceResponse(
            "text/plain", "UTF-8", 403, "Blocked",
            Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
    }
}
