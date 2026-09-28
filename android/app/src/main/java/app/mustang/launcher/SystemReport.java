package app.mustang.launcher;

import android.app.Activity;
import android.app.ActivityManager;
import android.content.ComponentName;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ApplicationInfo;
import android.content.pm.ComponentInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.hardware.Sensor;
import android.hardware.SensorManager;
import android.media.session.MediaController;
import android.media.session.MediaSessionManager;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.view.View;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

/**
 * Collects, on request from the driver, everything the next integration
 * steps need to know about this head unit: panel geometry, Android and
 * WebView versions, vendor packages and their services, system
 * properties, settings keys, sensors, and media sessions.
 *
 * <p>Read-only by construction. Nothing is written to the system, no
 * service is bound, no broadcast is sent. It stands in for the adb
 * commands in DEVICE-DISCOVERY.md for a driver who has no laptop in the
 * car. Identifiers that single out the device or the person (serials,
 * IMEI, MAC and Bluetooth addresses, account names) are left out.
 */
final class SystemReport {

    /** Package or component names worth expanding in full. */
    private static final Pattern VENDOR = Pattern.compile(
        "(?i)mcu|can(bus)?|car|vehicle|obd|temp|climate|hvac|ac\\b|air|radio|"
            + "fyt|syu|microntek|mtc|hct|ts10|ts18|tq|topway|autochips|zxw|"
            + "dsp|amp|sound|eq|bt|bluetooth|link|carplay|auto|launcher|settings");

    /** Keys and values that identify the unit or its owner. */
    private static final Pattern PRIVATE = Pattern.compile(
        "(?i)serial|imei|meid|iccid|mac|bt_addr|bluetooth_address|android_id|"
            + "account|email|phone_number|ssid|wifi_ap|password|token|gsf");

    /** Settings and properties that plausibly carry vehicle data. */
    private static final Pattern VEHICLE_HINT = Pattern.compile(
        "(?i)temp|outside|out_t|ambient|mcu|can|car|speed|gear|reverse|"
            + "brake|park|illum|light|fuel|climate|hvac");

    private static final int MAX_VALUE = 160;

    private SystemReport() {
    }

    static JSONObject collect(Activity activity, View web, JSONObject webGeometry)
            throws JSONException {
        Context context = activity.getApplicationContext();
        JSONObject report = new JSONObject();
        report.put("reportVersion", 2);
        report.put("generatedAt", new SimpleDateFormat(
            "yyyy-MM-dd HH:mm:ss", Locale.US).format(new Date()));
        // Ties every report to the exact APK that produced it.
        report.put("build", new JSONObject()
            .put("versionName", BuildConfig.VERSION_NAME)
            .put("versionCode", BuildConfig.VERSION_CODE)
            .put("buildCommit", BuildConfig.BUILD_COMMIT)
            .put("buildType", BuildConfig.BUILD_TYPE));

        report.put("device", device());
        report.put("display", display(activity, web));
        report.put("displayOverride", displayOverride(activity));
        report.put("webGeometry", webGeometry == null ? new JSONObject() : webGeometry);
        report.put("webview", webview(context));
        report.put("memory", memory(context));
        report.put("home", home(context));
        report.put("access", access(context));
        report.put("sensors", sensors(context));
        report.put("battery", battery(context));
        report.put("media", media(context));
        report.put("connectivity", connectivity(context));
        report.put("properties", properties());
        report.put("vendorInterfaces", VendorInterfaces.collect(context, report.getJSONObject("properties")));
        report.put("packages", packages(context));
        report.put("settings", settings(context));
        report.put("findings", findings(report));
        return report;
    }

    /* ---------------- Sections ---------------- */

    private static JSONObject device() throws JSONException {
        return new JSONObject()
            .put("manufacturer", Build.MANUFACTURER)
            .put("brand", Build.BRAND)
            .put("model", Build.MODEL)
            .put("device", Build.DEVICE)
            .put("product", Build.PRODUCT)
            .put("board", Build.BOARD)
            .put("hardware", Build.HARDWARE)
            .put("soc", Build.VERSION.SDK_INT >= 31 ? Build.SOC_MODEL : "")
            .put("abis", new JSONArray(Build.SUPPORTED_ABIS))
            .put("android", Build.VERSION.RELEASE)
            .put("sdk", Build.VERSION.SDK_INT)
            .put("securityPatch", Build.VERSION.SECURITY_PATCH)
            .put("display", Build.DISPLAY)
            .put("fingerprint", Build.FINGERPRINT)
            .put("buildType", Build.TYPE)
            .put("buildTags", Build.TAGS);
    }

    private static JSONObject display(Activity activity, View web) throws JSONException {
        JSONObject result = Diagnostics.snapshot(activity, web);
        DisplayMetrics metrics = activity.getResources().getDisplayMetrics();
        int w = result.optInt("displayWidthPx");
        int h = result.optInt("displayHeightPx");
        // Physical size from the panel's own reported dpi. Vendors often
        // leave xdpi/ydpi at a default, so this is a hint, not a fact.
        if (metrics.xdpi > 0 && metrics.ydpi > 0) {
            double wIn = w / metrics.xdpi;
            double hIn = h / metrics.ydpi;
            result.put("reportedWidthMm", Math.round(wIn * 25.4));
            result.put("reportedHeightMm", Math.round(hIn * 25.4));
            result.put("reportedDiagonalIn", Math.round(Math.hypot(wIn, hIn) * 10) / 10.0);
        }
        result.put("dpWidth", Math.round(w / metrics.density));
        result.put("dpHeight", Math.round(h / metrics.density));
        result.put("refreshHz", activity.getWindowManager().getDefaultDisplay().getRefreshRate());
        return result;
    }

    /**
     * Physical panel versus what Android is currently configured to use.
     * Display.Mode carries the panel's native resolution and
     * DENSITY_DEVICE_STABLE the factory density; a difference from the
     * live metrics means an override is in effect. This is an inference
     * from public APIs, not the output of `wm size` / `wm density`, which
     * needs adb to read directly.
     */
    private static JSONObject displayOverride(Activity activity) throws JSONException {
        JSONObject result = new JSONObject();
        android.view.Display display = activity.getWindowManager().getDefaultDisplay();
        DisplayMetrics real = new DisplayMetrics();
        display.getRealMetrics(real);
        result.put("currentWidthPx", real.widthPixels);
        result.put("currentHeightPx", real.heightPixels);
        result.put("currentDensityDpi", real.densityDpi);

        android.view.Display.Mode mode = display.getMode();
        int modeW = Math.max(mode.getPhysicalWidth(), mode.getPhysicalHeight());
        int modeH = Math.min(mode.getPhysicalWidth(), mode.getPhysicalHeight());
        int curW = Math.max(real.widthPixels, real.heightPixels);
        int curH = Math.min(real.widthPixels, real.heightPixels);
        result.put("modeWidthPx", modeW);
        result.put("modeHeightPx", modeH);
        result.put("sizeOverrideInferred", modeW != curW || modeH != curH);

        int stable = DisplayMetrics.DENSITY_DEVICE_STABLE;
        result.put("stableDensityDpi", stable);
        result.put("densityOverrideInferred", stable > 0 && stable != real.densityDpi);

        result.put("method", "Display.Mode and DENSITY_DEVICE_STABLE vs live metrics");
        result.put("wmOverride", "ADB_REQUIRED");
        return result;
    }

    private static JSONObject webview(Context context) throws JSONException {
        JSONObject result = new JSONObject();
        if (Build.VERSION.SDK_INT >= 26) {
            PackageInfo info = WebView.getCurrentWebViewPackage();
            if (info != null) {
                result.put("package", info.packageName);
                result.put("version", info.versionName);
            }
        }
        return result;
    }

    private static JSONObject memory(Context context) throws JSONException {
        ActivityManager am = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
        JSONObject result = new JSONObject();
        if (am == null) return result;
        ActivityManager.MemoryInfo info = new ActivityManager.MemoryInfo();
        am.getMemoryInfo(info);
        result.put("totalMb", info.totalMem / (1024 * 1024));
        result.put("availableMb", info.availMem / (1024 * 1024));
        result.put("lowMemory", info.lowMemory);
        result.put("memoryClassMb", am.getMemoryClass());
        result.put("cpuCores", Runtime.getRuntime().availableProcessors());
        return result;
    }

    private static JSONObject home(Context context) throws JSONException {
        ComponentName home = AppCatalog.defaultHome(context);
        return new JSONObject()
            .put("defaultHome", home == null ? "" : home.flattenToShortString())
            .put("thisLauncherIsHome", home != null
                && home.getPackageName().equals(context.getPackageName()));
    }

    private static JSONObject access(Context context) throws JSONException {
        String listeners = Settings.Secure.getString(
            context.getContentResolver(), "enabled_notification_listeners");
        return new JSONObject()
            .put("mediaAccess", listeners != null && listeners.contains(context.getPackageName()))
            .put("overlay", HomeButton.allowed(context));
    }

    private static JSONArray sensors(Context context) throws JSONException {
        JSONArray result = new JSONArray();
        SensorManager sm = (SensorManager) context.getSystemService(Context.SENSOR_SERVICE);
        if (sm == null) return result;
        for (Sensor s : sm.getSensorList(Sensor.TYPE_ALL)) {
            result.put(new JSONObject()
                .put("name", s.getName())
                .put("vendor", s.getVendor())
                .put("type", s.getType())
                .put("typeName", s.getStringType()));
        }
        return result;
    }

    private static JSONObject battery(Context context) throws JSONException {
        // Sticky: reading it registers nothing.
        Intent sticky = context.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        JSONObject result = new JSONObject();
        if (sticky == null) return result;
        result.put("present", sticky.getBooleanExtra(BatteryManager.EXTRA_PRESENT, false));
        result.put("temperatureC", sticky.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0) / 10.0);
        result.put("voltageMv", sticky.getIntExtra(BatteryManager.EXTRA_VOLTAGE, 0));
        result.put("plugged", sticky.getIntExtra(BatteryManager.EXTRA_PLUGGED, -1));
        return result;
    }

    private static JSONArray media(Context context) throws JSONException {
        JSONArray result = new JSONArray();
        MediaSessionManager sessions =
            (MediaSessionManager) context.getSystemService(Context.MEDIA_SESSION_SERVICE);
        if (sessions == null) return result;
        try {
            List<MediaController> active = sessions.getActiveSessions(
                new ComponentName(context, MediaAccessService.class));
            for (MediaController c : active) {
                result.put(new JSONObject()
                    .put("package", c.getPackageName())
                    .put("state", c.getPlaybackState() == null ? -1 : c.getPlaybackState().getState()));
            }
        } catch (SecurityException noAccess) {
            result.put(new JSONObject().put("error", "media access not granted"));
        }
        return result;
    }

    /**
     * What the unit offers for talking to external hardware, from public
     * APIs only and with no new permissions. Nothing is scanned, paired,
     * connected or opened, and no device address or personal device name
     * is read. Anything that would need a permission this app does not
     * hold, or a real peripheral, says so instead of guessing.
     */
    private static JSONObject connectivity(Context context) throws JSONException {
        return new JSONObject()
            .put("bluetooth", bluetooth(context))
            .put("usb", usb(context))
            .put("adbRequired", new JSONArray()
                .put("wm size / wm density: ADB_REQUIRED")
                .put("paired devices and their profiles: ADB_REQUIRED (dumpsys bluetooth_manager)")
                .put("SPP to a specific device: REQUIRES_REAL_DEVICE_TEST")
                .put("kernel USB log (dmesg): ADB_REQUIRED")
                .put("USB serial numbers: not collected by design"));
    }

    private static JSONObject bluetooth(Context context) throws JSONException {
        PackageManager pm = context.getPackageManager();
        JSONObject result = new JSONObject();
        boolean classic = pm.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH);
        boolean le = pm.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE);
        result.put("featureBluetooth", classic);
        result.put("featureBluetoothLe", le);
        // FEATURE_BLUETOOTH is the Classic (BR/EDR) radio; LE is separate.
        result.put("classicSupported", classic);
        result.put("leOnly", le && !classic);

        android.bluetooth.BluetoothManager manager =
            (android.bluetooth.BluetoothManager) context.getSystemService(Context.BLUETOOTH_SERVICE);
        android.bluetooth.BluetoothAdapter adapter = manager == null ? null : manager.getAdapter();
        result.put("bluetoothManagerAvailable", manager != null);
        result.put("adapterAvailable", adapter != null);
        // The platform stack is reachable by apps exactly when the service
        // hands out an adapter.
        result.put("stackAvailableToApps", adapter != null);

        if (adapter == null) {
            result.put("enabled", false);
        } else {
            try {
                result.put("enabled", adapter.isEnabled());
            } catch (SecurityException denied) {
                // Needs BLUETOOTH (<= API 30) or BLUETOOTH_CONNECT (31+),
                // which this build does not request for the report.
                result.put("enabled", "PERMISSION_REQUIRED");
            }
        }

        // API presence only: no socket is created and no device is touched.
        boolean rfcommApi;
        try {
            android.bluetooth.BluetoothDevice.class.getMethod(
                "createRfcommSocketToServiceRecord", java.util.UUID.class);
            android.bluetooth.BluetoothAdapter.class.getMethod(
                "listenUsingRfcommWithServiceRecord", String.class, java.util.UUID.class);
            rfcommApi = true;
        } catch (NoSuchMethodException | RuntimeException absent) {
            rfcommApi = false;
        }
        result.put("rfcommApisPresent", rfcommApi);
        result.put("sppVerdict", "REQUIRES_REAL_DEVICE_TEST");
        return result;
    }

    private static JSONObject usb(Context context) throws JSONException {
        PackageManager pm = context.getPackageManager();
        JSONObject result = new JSONObject();
        boolean host = pm.hasSystemFeature(PackageManager.FEATURE_USB_HOST);
        result.put("featureUsbHost", host);
        result.put("featureUsbAccessory", pm.hasSystemFeature(PackageManager.FEATURE_USB_ACCESSORY));

        android.hardware.usb.UsbManager manager =
            (android.hardware.usb.UsbManager) context.getSystemService(Context.USB_SERVICE);
        result.put("usbManagerAvailable", manager != null);

        JSONArray devices = new JSONArray();
        if (manager != null) {
            try {
                // Listing needs no permission; serials would, and are not read.
                for (android.hardware.usb.UsbDevice d : manager.getDeviceList().values()) {
                    JSONArray interfaces = new JSONArray();
                    for (int i = 0; i < d.getInterfaceCount(); i++) {
                        android.hardware.usb.UsbInterface f = d.getInterface(i);
                        interfaces.put(new JSONObject()
                            .put("class", f.getInterfaceClass())
                            .put("subclass", f.getInterfaceSubclass())
                            .put("protocol", f.getInterfaceProtocol()));
                    }
                    devices.put(new JSONObject()
                        .put("vid", String.format(Locale.US, "0x%04x", d.getVendorId()))
                        .put("pid", String.format(Locale.US, "0x%04x", d.getProductId()))
                        .put("class", d.getDeviceClass())
                        .put("subclass", d.getDeviceSubclass())
                        .put("protocol", d.getDeviceProtocol())
                        .put("interfaces", interfaces));
                }
            } catch (RuntimeException unavailable) {
                result.put("deviceListError", "unavailable");
            }
        }
        result.put("devices", devices);
        // A normal app may ask through UsbManager.requestPermission, which
        // shows the user a system dialog per device. Not called here.
        result.put("permissionRequestableByApp", manager != null && host
            ? "YES_VIA_USER_DIALOG" : "NO");
        result.put("verdict", host && manager != null ? "USB_HOST_AVAILABLE" : "USB_HOST_NOT_AVAILABLE");
        return result;
    }

    private static JSONObject packages(Context context) throws JSONException {
        PackageManager pm = context.getPackageManager();
        JSONArray all = new JSONArray();
        JSONArray vendor = new JSONArray();
        List<PackageInfo> installed = pm.getInstalledPackages(0);
        for (PackageInfo info : installed) {
            ApplicationInfo app = info.applicationInfo;
            boolean system = app != null && (app.flags & ApplicationInfo.FLAG_SYSTEM) != 0;
            JSONObject row = new JSONObject()
                .put("package", info.packageName)
                .put("version", info.versionName == null ? "" : info.versionName)
                .put("system", system)
                .put("launchable", pm.getLaunchIntentForPackage(info.packageName) != null);
            all.put(row);

            // Components only where they could matter: vendor-looking
            // packages that are not the usual Google and AOSP set.
            String pkg = info.packageName;
            if (VENDOR.matcher(pkg).find()
                && !pkg.startsWith("com.google.") && !pkg.startsWith("com.android.")) {
                vendor.put(components(pm, pkg));
            }
        }
        return new JSONObject()
            .put("count", installed.size())
            .put("all", all)
            .put("vendor", vendor);
    }

    private static JSONObject components(PackageManager pm, String pkg) throws JSONException {
        JSONObject result = new JSONObject().put("package", pkg);
        try {
            PackageInfo info = pm.getPackageInfo(pkg,
                PackageManager.GET_SERVICES | PackageManager.GET_RECEIVERS
                    | PackageManager.GET_PROVIDERS | PackageManager.GET_PERMISSIONS);
            result.put("services", names(info.services));
            result.put("receivers", names(info.receivers));
            result.put("providers", names(info.providers));
            JSONArray perms = new JSONArray();
            if (info.permissions != null) {
                for (android.content.pm.PermissionInfo p : info.permissions) perms.put(p.name);
            }
            result.put("declaredPermissions", perms);
        } catch (PackageManager.NameNotFoundException | RuntimeException failed) {
            result.put("error", "unreadable");
        }
        return result;
    }

    private static JSONArray names(ComponentInfo[] components) throws JSONException {
        JSONArray result = new JSONArray();
        if (components == null) return result;
        for (ComponentInfo c : components) {
            result.put(new JSONObject().put("name", c.name).put("exported", c.exported));
        }
        return result;
    }

    /** `getprop`, minus anything that identifies the unit. */
    private static JSONObject properties() throws JSONException {
        JSONObject result = new JSONObject();
        Process process = null;
        try {
            process = new ProcessBuilder("getprop").redirectErrorStream(true).start();
            BufferedReader reader = new BufferedReader(
                new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8));
            String line;
            int count = 0;
            while ((line = reader.readLine()) != null && count < 4000) {
                // [key]: [value]
                int split = line.indexOf("]: [");
                if (!line.startsWith("[") || split < 0 || !line.endsWith("]")) continue;
                String key = line.substring(1, split);
                String value = line.substring(split + 4, line.length() - 1);
                if (PRIVATE.matcher(key).find()) continue;
                result.put(key, clip(value));
                count++;
            }
            process.waitFor(3, TimeUnit.SECONDS);
        } catch (Exception unavailable) {
            result.put("_error", "getprop unavailable");
        } finally {
            if (process != null) process.destroy();
        }
        return result;
    }

    private static JSONObject settings(Context context) throws JSONException {
        ContentResolver resolver = context.getContentResolver();
        return new JSONObject()
            .put("system", table(resolver, Settings.System.CONTENT_URI))
            .put("global", table(resolver, Settings.Global.CONTENT_URI))
            .put("secure", table(resolver, Settings.Secure.CONTENT_URI));
    }

    private static JSONObject table(ContentResolver resolver, Uri uri) throws JSONException {
        JSONObject result = new JSONObject();
        try (Cursor cursor = resolver.query(uri, new String[]{"name", "value"}, null, null, null)) {
            if (cursor == null) return result.put("_error", "not readable");
            while (cursor.moveToNext()) {
                String name = cursor.getString(0);
                if (name == null || PRIVATE.matcher(name).find()) continue;
                String value = cursor.getString(1);
                result.put(name, value == null ? JSONObject.NULL : clip(value));
            }
        } catch (RuntimeException refused) {
            result.put("_error", "not readable");
        }
        return result;
    }

    /** The short list a person reads first. */
    private static JSONObject findings(JSONObject report) throws JSONException {
        JSONObject display = report.getJSONObject("display");
        JSONArray hints = new JSONArray();
        collectHints(hints, "setting.system", report.getJSONObject("settings").getJSONObject("system"));
        collectHints(hints, "setting.global", report.getJSONObject("settings").getJSONObject("global"));
        collectHints(hints, "property", report.getJSONObject("properties"));

        JSONArray temperatureSensors = new JSONArray();
        JSONArray sensors = report.getJSONArray("sensors");
        for (int i = 0; i < sensors.length(); i++) {
            JSONObject s = sensors.getJSONObject(i);
            if (s.optInt("type") == Sensor.TYPE_AMBIENT_TEMPERATURE
                || s.optString("name").toLowerCase(Locale.US).contains("temp")) {
                temperatureSensors.put(s.optString("name"));
            }
        }

        JSONArray vendorPackages = new JSONArray();
        JSONArray vendor = report.getJSONObject("packages").getJSONArray("vendor");
        for (int i = 0; i < vendor.length(); i++) vendorPackages.put(vendor.getJSONObject(i).optString("package"));

        JSONObject web = report.optJSONObject("webGeometry");
        JSONObject build = report.getJSONObject("build");
        return new JSONObject()
            .put("build", build.optString("versionName") + " (" + build.optInt("versionCode")
                + ", " + build.optString("buildType") + ", " + build.optString("buildCommit") + ")")
            .put("page", web == null || web.length() == 0 ? "not reported"
                : "css " + web.optInt("clientWidth") + "x" + web.optInt("clientHeight")
                    + ", dpr " + web.optDouble("devicePixelRatio")
                    + ", scale " + web.optDouble("visualViewportScale")
                    + ", adapter " + (web.optBoolean("adapterApplied") ? "applied" : "NOT applied")
                    + ", physical " + web.optInt("effectivePhysicalWidth") + "x"
                    + web.optInt("effectivePhysicalHeight")
                    + (web.optBoolean("fullyVisible") ? ", fully visible" : ", CROPPED"))
            .put("panel", display.optInt("displayWidthPx") + "x" + display.optInt("displayHeightPx")
                + " px, densityDpi " + display.optInt("densityDpi")
                + ", " + display.optInt("dpWidth") + "x" + display.optInt("dpHeight") + " dp")
            .put("android", report.getJSONObject("device").optString("android")
                + " (SDK " + report.getJSONObject("device").optInt("sdk") + ")")
            .put("webview", report.getJSONObject("webview").optString("version", "unknown"))
            .put("temperatureSensors", temperatureSensors)
            .put("vendorPackages", vendorPackages)
            .put("vehicleHints", hints);
    }

    private static void collectHints(JSONArray out, String source, JSONObject table) throws JSONException {
        JSONArray keys = table.names();
        if (keys == null) return;
        for (int i = 0; i < keys.length() && out.length() < 200; i++) {
            String key = keys.getString(i);
            if (VEHICLE_HINT.matcher(key).find()) {
                out.put(source + " " + key + " = " + table.opt(key));
            }
        }
    }

    private static String clip(String value) {
        return value.length() <= MAX_VALUE ? value : value.substring(0, MAX_VALUE) + "…";
    }

    /* ---------------- Saving ---------------- */

    /**
     * Writes the report where the driver can reach it without a laptop:
     * Downloads on Android 10+, the app's own external folder before that.
     *
     * @return a content or file URI for sharing, and a human-readable path
     */
    static String[] save(Context context, String text) throws Exception {
        String name = "mustang-report-" + new SimpleDateFormat(
            "yyyyMMdd-HHmmss", Locale.US).format(new Date()) + ".json";
        byte[] bytes = text.getBytes(StandardCharsets.UTF_8);

        if (Build.VERSION.SDK_INT >= 29) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            values.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
            Uri uri = context.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IllegalStateException("unavailable");
            try (OutputStream out = context.getContentResolver().openOutputStream(uri)) {
                if (out == null) throw new IllegalStateException("unavailable");
                out.write(bytes);
            }
            return new String[]{uri.toString(), "Download/" + name};
        }

        File dir = context.getExternalFilesDir(null);
        if (dir == null) throw new IllegalStateException("unavailable");
        File file = new File(dir, name);
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(bytes);
        }
        return new String[]{"", file.getAbsolutePath()};
    }

    /**
     * Opens Android's share sheet, so the report can go to WhatsApp,
     * email or anywhere else the driver can read it from. The file is
     * attached when it lives in Downloads; the summary always travels as
     * text, which is enough for most questions on its own.
     */
    static void share(Activity activity, String uri, String summary) {
        Intent send = new Intent(Intent.ACTION_SEND)
            .putExtra(Intent.EXTRA_SUBJECT, "Mustang launcher system report")
            .putExtra(Intent.EXTRA_TEXT, summary);
        if (uri != null && !uri.isEmpty()) {
            send.setType("application/json")
                .putExtra(Intent.EXTRA_STREAM, Uri.parse(uri))
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } else {
            send.setType("text/plain");
        }
        activity.startActivity(Intent.createChooser(send, "مشاركة تقرير النظام")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
    }
}
