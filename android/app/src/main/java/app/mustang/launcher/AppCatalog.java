package app.mustang.launcher;

import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.os.Handler;
import android.os.HandlerThread;
import android.provider.Settings;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Resolves the HMI's curated tiles against packages that are really on
 * this unit, and launches them.
 *
 * <p>Two ways in, both narrow. A capability id ("maps", "settings") maps
 * through a fixed table. A package name is accepted only if Android itself
 * lists it as a launchable app — the same set any launcher shows — and it
 * is opened through its own launch intent. JavaScript never supplies a
 * component, an action, extras or data, so the web layer still cannot use
 * the launcher as a generic intent gun.
 */
final class AppCatalog {

    /** Capability id -> candidate packages, most preferred first. */
    private static final Map<String, String[]> PACKAGES = new LinkedHashMap<>();

    static {
        PACKAGES.put("maps", new String[]{"com.google.android.apps.maps"});
        PACKAGES.put("waze", new String[]{"com.waze"});
        PACKAGES.put("spotify", new String[]{"com.spotify.music"});
        PACKAGES.put("youtube", new String[]{
            "com.google.android.youtube", "com.google.android.apps.youtube.music"});
        // Left empty on purpose. Head-unit phone-projection receivers are
        // vendor-specific and this one has not been identified yet; a
        // guessed package name would resolve to nothing and look broken.
        PACKAGES.put("carplay", new String[]{});
    }

    /** Capability id -> system settings screen. */
    private static final Map<String, String> SYSTEM = new LinkedHashMap<>();

    static {
        SYSTEM.put("settings", Settings.ACTION_SETTINGS);
        SYSTEM.put("bluetooth", Settings.ACTION_BLUETOOTH_SETTINGS);
        SYSTEM.put("mediaAccess", Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        SYSTEM.put("homeSettings", Settings.ACTION_HOME_SETTINGS);
    }

    /**
     * Capabilities that stay reachable regardless of motion, because they
     * are how the unit gets set up and how the user gets back out to the
     * stock launcher. Holding these back would be a trap, not a safeguard.
     */
    private static final List<String> ALWAYS_REACHABLE =
        Arrays.asList("settings", "bluetooth", "mediaAccess", "homeSettings", "phone");

    /** Shape of a package name; anything else is refused before lookup. */
    private static final Pattern PACKAGE = Pattern.compile("[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z0-9_]+)+");

    /** Icon edge in physical px: large enough for the Home tiles. */
    private static final int ICON_PX = 160;

    private final Context context;
    private final HostChannel channel;
    private BroadcastReceiver packages;

    /* Icons are rendered off the main thread and cached per package and
       update time, so a package event re-encodes only what changed. */
    private final HandlerThread thread = new HandlerThread("mustang-apps");
    private final Handler worker;
    private final Map<String, String> iconCache = new HashMap<>();

    AppCatalog(Context context, HostChannel channel) {
        this.context = context.getApplicationContext();
        this.channel = channel;
        thread.start();
        worker = new Handler(thread.getLooper());
    }

    /** Watches for installs and removals so the grid stays truthful. */
    void start() {
        packages = new BroadcastReceiver() {
            @Override public void onReceive(Context c, Intent intent) { push(); }
        };
        IntentFilter filter = new IntentFilter();
        filter.addAction(Intent.ACTION_PACKAGE_ADDED);
        filter.addAction(Intent.ACTION_PACKAGE_REMOVED);
        filter.addAction(Intent.ACTION_PACKAGE_CHANGED);
        filter.addDataScheme("package");
        Receivers.register(context, packages, filter);
        push();
    }

    void release() {
        thread.quitSafely();
        if (packages == null) return;
        Receivers.unregister(context, packages);
        packages = null;
    }

    void push() {
        try {
            channel.event("apps", availability());
        } catch (JSONException impossible) {
            throw new IllegalStateException(impossible);
        }
        worker.post(() -> {
            try {
                channel.event("catalog", new JSONObject().put("apps", catalog()));
            } catch (JSONException | RuntimeException failed) {
                // The grid keeps its last catalog; nothing invented.
            }
        });
    }

    /** One entry per curated capability, with whether it can be opened. */
    JSONArray availability() throws JSONException {
        JSONArray result = new JSONArray();
        for (String id : PACKAGES.keySet()) {
            Intent intent = packageIntent(id);
            result.put(new JSONObject()
                .put("id", id)
                .put("available", intent != null)
                .put("label", intent == null ? "" : labelOf(context, intent.getPackage())));
        }
        for (String id : SYSTEM.keySet()) {
            result.put(new JSONObject()
                .put("id", id)
                .put("available", resolves(new Intent(SYSTEM.get(id)))));
        }
        result.put(new JSONObject()
            .put("id", "phone")
            .put("available", resolves(new Intent(Intent.ACTION_DIAL))));
        return result;
    }

    /**
     * Every launchable app on the unit, with its label and icon, so the
     * HMI can offer the same set any launcher would. Icons travel as PNG
     * data URIs; they are cached, so this is cheap after the first pass.
     */
    JSONArray catalog() throws JSONException {
        JSONArray result = new JSONArray();
        Intent query = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        PackageManager pm = context.getPackageManager();
        Map<String, Boolean> seen = new HashMap<>();
        for (ResolveInfo entry : pm.queryIntentActivities(query, 0)) {
            String pkg = entry.activityInfo.packageName;
            if (pkg.equals(context.getPackageName()) || seen.containsKey(pkg)) continue;
            seen.put(pkg, true);
            result.put(new JSONObject()
                .put("packageName", pkg)
                .put("label", String.valueOf(entry.loadLabel(pm)))
                .put("icon", iconOf(pm, entry, pkg)));
        }
        return result;
    }

    private String iconOf(PackageManager pm, ResolveInfo entry, String pkg) {
        long stamp = 0;
        try {
            stamp = pm.getPackageInfo(pkg, 0).lastUpdateTime;
        } catch (PackageManager.NameNotFoundException gone) {
            return "";
        }
        String key = pkg + '\0' + stamp;
        String cached = iconCache.get(key);
        if (cached != null) return cached;
        String encoded = "";
        try {
            Drawable drawable = entry.loadIcon(pm);
            Bitmap bitmap = Bitmap.createBitmap(ICON_PX, ICON_PX, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            drawable.setBounds(0, 0, ICON_PX, ICON_PX);
            drawable.draw(canvas);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, out);
            bitmap.recycle();
            encoded = "data:image/png;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
        } catch (RuntimeException | OutOfMemoryError unreadable) {
            // A broken icon falls back to the HMI's monogram tile.
        }
        iconCache.put(key, encoded);
        return encoded;
    }

    /**
     * Opens an app the unit lists as launchable. The name is checked for
     * shape, then Android is asked for that package's own launch intent;
     * a package that is not a launchable app has none and is refused.
     *
     * <p>No motion check here. Which apps to open while driving is the
     * driver's decision on this unit, not the launcher's.
     */
    void launchPackage(String pkg) {
        if (pkg == null || pkg.length() > 200 || !PACKAGE.matcher(pkg).matches()) {
            throw new IllegalArgumentException("bad package");
        }
        if (pkg.equals(context.getPackageName())) throw new IllegalArgumentException("self");
        Intent intent = context.getPackageManager().getLaunchIntentForPackage(pkg);
        if (intent == null) throw new IllegalStateException("not_installed");
        intent.setPackage(pkg);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
        context.startActivity(intent);
    }

    /**
     * Opens a curated capability.
     *
     * @throws IllegalStateException nothing on this unit can open it
     * @throws IllegalArgumentException the id is not in the allowlist
     */
    void launch(String id) {
        if (!ALWAYS_REACHABLE.contains(id)
            && !PACKAGES.containsKey(id) && !SYSTEM.containsKey(id)) {
            throw new IllegalArgumentException("unknown capability");
        }

        Intent intent;
        if (SYSTEM.containsKey(id)) {
            intent = new Intent(SYSTEM.get(id));
        } else if ("phone".equals(id)) {
            intent = new Intent(Intent.ACTION_DIAL);
        } else {
            intent = packageIntent(id);
        }
        if (intent == null || !resolves(intent)) throw new IllegalStateException("not_installed");

        // A launcher starts other apps from outside any task of its own.
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
    }

    /** Hands a number to the system dialer. Never places the call itself. */
    void dial(String number) {
        // Digits and the three dialable symbols only: this string becomes
        // a tel: URI, so nothing else is allowed anywhere near it.
        if (!number.matches("[+0-9*#]{1,20}")) throw new IllegalArgumentException("bad number");
        Intent intent = new Intent(Intent.ACTION_DIAL,
            android.net.Uri.fromParts("tel", number, null));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (!resolves(intent)) throw new IllegalStateException("not_installed");
        context.startActivity(intent);
    }

    /** The stock launcher, so the user is never trapped in ours. */
    static ComponentName defaultHome(Context context) {
        Intent home = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME);
        ResolveInfo info = context.getPackageManager()
            .resolveActivity(home, PackageManager.MATCH_DEFAULT_ONLY);
        if (info == null || info.activityInfo == null) return null;
        return new ComponentName(info.activityInfo.packageName, info.activityInfo.name);
    }

    static String labelOf(Context context, String packageName) {
        if (packageName == null) return "";
        PackageManager pm = context.getPackageManager();
        try {
            return String.valueOf(pm.getApplicationLabel(
                pm.getApplicationInfo(packageName, 0)));
        } catch (PackageManager.NameNotFoundException unknown) {
            return packageName;
        }
    }

    private Intent packageIntent(String id) {
        String[] candidates = PACKAGES.get(id);
        if (candidates == null) return null;
        for (String pkg : candidates) {
            Intent intent = context.getPackageManager().getLaunchIntentForPackage(pkg);
            if (intent != null) {
                intent.setPackage(pkg);
                return intent;
            }
        }
        return null;
    }

    private boolean resolves(Intent intent) {
        return intent.resolveActivity(context.getPackageManager()) != null;
    }
}
