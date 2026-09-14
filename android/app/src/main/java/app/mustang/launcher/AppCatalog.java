package app.mustang.launcher;

import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.provider.Settings;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Resolves the HMI's curated tiles against packages that are really on
 * this unit, and launches them.
 *
 * <p>The allowlist is the point. JavaScript names a capability — "maps",
 * "settings" — and never a package, a component, or an intent. There is
 * no method here that will launch an arbitrary package or fire an
 * arbitrary intent on request, so a compromised web layer cannot use the
 * launcher as a generic intent gun.
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

    /** Capabilities held while the vehicle is not verified parked. */
    private static final List<String> PARKED_ONLY = Arrays.asList("youtube", "carplay");

    private final Context context;
    private final HostChannel channel;
    private BroadcastReceiver packages;

    AppCatalog(Context context, HostChannel channel) {
        this.context = context.getApplicationContext();
        this.channel = channel;
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
        if (packages == null) return;
        Receivers.unregister(context, packages);
        packages = null;
    }

    void push() {
        try {
            channel.event("apps", availability().toString());
        } catch (JSONException impossible) {
            throw new IllegalStateException(impossible);
        }
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
     * Every launchable activity on the unit. Inventory only — used for
     * discovery and diagnostics. Note that no method accepts a package
     * name from this list and launches it: the grid stays curated.
     */
    JSONArray installed() throws JSONException {
        JSONArray result = new JSONArray();
        Intent query = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        PackageManager pm = context.getPackageManager();
        for (ResolveInfo entry : pm.queryIntentActivities(query, 0)) {
            String pkg = entry.activityInfo.packageName;
            if (pkg.equals(context.getPackageName())) continue;
            result.put(new JSONObject()
                .put("packageName", pkg)
                .put("label", String.valueOf(entry.loadLabel(pm))));
        }
        return result;
    }

    /**
     * Opens a curated capability.
     *
     * @throws SecurityException     the capability is held while moving
     * @throws IllegalStateException nothing on this unit can open it
     * @throws IllegalArgumentException the id is not in the allowlist
     */
    void launch(String id, VehicleDataProvider vehicle) {
        if (PARKED_ONLY.contains(id) && !vehicle.isVerifiedParked()) {
            throw new SecurityException("restricted");
        }
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
