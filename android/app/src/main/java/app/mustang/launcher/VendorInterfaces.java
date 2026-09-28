package app.mustang.launcher;

import android.content.Context;
import android.content.pm.ActivityInfo;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.ProviderInfo;
import android.content.pm.ServiceInfo;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Read-only inventory of the vendor interfaces already in this ROM: the
 * com.tw.*, com.dofun.*, cn.cardoor.* and com.ms.* packages and the
 * init-level mcuserver daemon.
 *
 * <p>Package and component metadata come from PackageManager only.
 * Nothing here binds or starts a service, sends a broadcast, opens a
 * socket or device node, or writes a setting or property. Intent filters
 * of other apps are not exposed by PackageManager and are left to adb.
 * Component names that match the focus words are leads for later
 * investigation, not evidence of any MCU or CAN protocol.
 */
final class VendorInterfaces {

    private static final String[] PREFIXES = {"com.tw.", "com.dofun.", "cn.cardoor.", "com.ms."};

    private static final Pattern FOCUS = Pattern.compile(
        "(?i)mcu|carservice|\\bcan\\b|canbus|can[._]|speed|gear|reverse|backcar|"
            + "temp|climate|hvac|aircon|vehicle");

    private static final String[] INIT_DIRS = {
        "/system/etc/init", "/vendor/etc/init", "/odm/etc/init", "/product/etc/init",
        "/system_ext/etc/init",
    };

    private static final String[] BINARY_DIRS = {
        "/system/bin", "/vendor/bin", "/system/xbin", "/odm/bin", "/product/bin",
    };

    private VendorInterfaces() {
    }

    static JSONObject collect(Context context, JSONObject properties) throws JSONException {
        PackageManager pm = context.getPackageManager();
        JSONArray packages = new JSONArray();
        JSONArray focus = new JSONArray();

        for (PackageInfo base : pm.getInstalledPackages(0)) {
            if (inScope(base.packageName)) packages.put(describe(pm, base.packageName, focus));
        }

        return new JSONObject()
            .put("scope", new JSONArray(PREFIXES))
            .put("note", "focus entries are name matches: leads, not protocol evidence")
            .put("packages", packages)
            .put("focus", focus)
            .put("mcuserver", mcuserver(properties))
            .put("devSocket", listing("/dev/socket"))
            .put("adbRequired", new JSONArray()
                .put("intent filters of vendor components: ADB_REQUIRED (dumpsys package <pkg>)")
                .put("runtime receivers and actions: ADB_REQUIRED (dumpsys activity broadcasts)")
                .put("live services and bound clients: ADB_REQUIRED (dumpsys activity services)")
                .put("vendor binder interfaces: ADB_REQUIRED (service list)")
                .put("mcuserver process, fds and sockets: ADB_REQUIRED (ps -A, ls -l /proc/<pid>/fd)"));
    }

    private static boolean inScope(String pkg) {
        for (String prefix : PREFIXES) {
            if (pkg.startsWith(prefix)) return true;
        }
        return false;
    }

    /* ---------------- Packages ---------------- */

    private static JSONObject describe(PackageManager pm, String pkg, JSONArray focus)
            throws JSONException {
        JSONObject result = new JSONObject().put("package", pkg);
        PackageInfo info;
        try {
            info = pm.getPackageInfo(pkg,
                PackageManager.GET_SERVICES | PackageManager.GET_RECEIVERS
                    | PackageManager.GET_PROVIDERS | PackageManager.GET_PERMISSIONS
                    | PackageManager.GET_DISABLED_COMPONENTS);
        } catch (PackageManager.NameNotFoundException | RuntimeException refused) {
            return result.put("error", "unreadable");
        }

        ApplicationInfo app = info.applicationInfo;
        if (app != null) {
            result.put("system", (app.flags & ApplicationInfo.FLAG_SYSTEM) != 0);
            result.put("persistent", (app.flags & ApplicationInfo.FLAG_PERSISTENT) != 0);
            result.put("processName", orEmpty(app.processName));
        }
        result.put("sharedUserId", orEmpty(info.sharedUserId));
        result.put("permissionsRequested", requested(info));
        result.put("permissionsDeclared", declared(info));

        JSONArray components = new JSONArray();
        if (info.services != null) {
            for (ServiceInfo s : info.services) {
                add(components, focus, pkg, row("service", s.name, s.exported, s.enabled,
                    s.permission, s.processName));
            }
        }
        if (info.receivers != null) {
            for (ActivityInfo r : info.receivers) {
                add(components, focus, pkg, row("receiver", r.name, r.exported, r.enabled,
                    r.permission, r.processName));
            }
        }
        if (info.providers != null) {
            for (ProviderInfo p : info.providers) {
                add(components, focus, pkg, row("provider", p.name, p.exported, p.enabled,
                    null, p.processName)
                    .put("authority", orEmpty(p.authority))
                    .put("readPermission", orEmpty(p.readPermission))
                    .put("writePermission", orEmpty(p.writePermission)));
            }
        }
        return result.put("components", components);
    }

    private static JSONObject row(String type, String name, boolean exported, boolean enabled,
                                  String permission, String process) throws JSONException {
        return new JSONObject()
            .put("name", name)
            .put("type", type)
            .put("exported", exported)
            .put("enabled", enabled)
            .put("permission", orEmpty(permission))
            .put("processName", orEmpty(process));
    }

    private static void add(JSONArray components, JSONArray focus, String pkg, JSONObject row)
            throws JSONException {
        components.put(row);
        String haystack = row.optString("name") + ' ' + row.optString("authority");
        if (FOCUS.matcher(haystack).find()) {
            focus.put(new JSONObject(row.toString()).put("package", pkg));
        }
    }

    private static JSONArray requested(PackageInfo info) throws JSONException {
        JSONArray result = new JSONArray();
        if (info.requestedPermissions == null) return result;
        for (int i = 0; i < info.requestedPermissions.length; i++) {
            boolean granted = info.requestedPermissionsFlags != null
                && i < info.requestedPermissionsFlags.length
                && (info.requestedPermissionsFlags[i] & PackageInfo.REQUESTED_PERMISSION_GRANTED) != 0;
            result.put(new JSONObject()
                .put("name", info.requestedPermissions[i])
                .put("granted", granted));
        }
        return result;
    }

    private static JSONArray declared(PackageInfo info) throws JSONException {
        JSONArray result = new JSONArray();
        if (info.permissions == null) return result;
        for (android.content.pm.PermissionInfo p : info.permissions) {
            result.put(new JSONObject()
                .put("name", p.name)
                .put("protectionLevel", p.protectionLevel));
        }
        return result;
    }

    /* ---------------- mcuserver ---------------- */

    private static JSONObject mcuserver(JSONObject properties) throws JSONException {
        JSONObject props = new JSONObject();
        JSONArray keys = properties == null ? null : properties.names();
        if (keys != null) {
            for (int i = 0; i < keys.length(); i++) {
                String key = keys.getString(i);
                if (key.toLowerCase(Locale.US).contains("mcu")) props.put(key, properties.opt(key));
            }
        }

        JSONArray executables = new JSONArray();
        for (String dir : BINARY_DIRS) {
            File candidate = new File(dir, "mcuserver");
            if (candidate.exists()) executables.put(candidate.getPath());
        }

        JSONArray initEntries = new JSONArray();
        boolean anyReadable = false;
        for (String dir : INIT_DIRS) {
            String[] names = new File(dir).list();
            if (names == null) continue;
            anyReadable = true;
            for (String name : names) {
                if (name.endsWith(".rc")) serviceBlock(new File(dir, name), initEntries);
            }
        }

        return new JSONObject()
            .put("properties", props)
            .put("executables", executables.length() == 0 ? "not visible" : executables)
            .put("initEntries", anyReadable ? initEntries : "ADB_REQUIRED");
    }

    /** The `service mcuserver ...` block of an init script, as text. */
    private static void serviceBlock(File rc, JSONArray out) {
        List<String> block = null;
        try (BufferedReader reader = new BufferedReader(new FileReader(rc))) {
            String line;
            int count = 0;
            while ((line = reader.readLine()) != null && count++ < 5000) {
                String trimmed = line.trim();
                if (trimmed.startsWith("service ") || trimmed.startsWith("on ")) {
                    flush(rc, block, out);
                    block = trimmed.startsWith("service ") && trimmed.contains("mcuserver")
                        ? new ArrayList<>() : null;
                }
                if (block != null && block.size() < 30) block.add(trimmed);
            }
            flush(rc, block, out);
        } catch (Exception unreadable) {
            // Not readable to apps; reported as absent rather than guessed.
        }
    }

    private static void flush(File rc, List<String> block, JSONArray out) {
        if (block == null || block.isEmpty()) return;
        try {
            out.put(new JSONObject().put("file", rc.getPath()).put("lines", new JSONArray(block)));
        } catch (JSONException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    /* ---------------- Listings ---------------- */

    private static Object listing(String path) throws JSONException {
        String[] names = new File(path).list();
        if (names == null) return "ADB_REQUIRED";
        Arrays.sort(names);
        return new JSONArray(names);
    }

    private static String orEmpty(String value) {
        return value == null ? "" : value;
    }
}
