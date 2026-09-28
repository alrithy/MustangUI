package app.mustang.launcher;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * The whole native surface JavaScript can reach: a fixed set of named
 * methods, each with its own argument handling.
 *
 * <p>What is deliberately absent matters more than what is here. There is
 * no "run this intent", no "call this method", no reflection, no shell.
 * Every method below either takes no arguments or takes one value that is
 * validated against an allowlist or a pattern before it reaches an Android
 * API. Opening an app by package goes through that package's own launch
 * intent and only for apps Android lists as launchable.
 *
 * <p>Errors are returned as short, stable codes rather than exception
 * text, so the HMI can say something useful and nothing internal leaks
 * into the web layer.
 */
final class NativeBridge {

    /** Raised when a method exists but the unit cannot satisfy it. */
    private static final String UNAVAILABLE = "unavailable";

    interface Host {
        /** The web layer reported it is up; cancels the start watchdog. */
        void onUiReady();

        /** The web layer reported it failed; raises native recovery. */
        void onUiFailure(String message);

        /** Panel metrics for the debug overlay; null in a release build. */
        JSONObject panelDiagnostics();

        /** Whether the floating Home button may be drawn over other apps. */
        boolean homeButtonAllowed();

        /** Opens Android's own screen for granting that permission. */
        void requestHomeButton();

        /** Gathers the system report off the main thread and pushes it
         *  as a "systemReport" event. Driver-initiated only. */
        void collectReport();

        /** Saves the last collected report to Downloads; with share, also
         *  opens the share sheet. Returns where it was written. */
        String saveReport(boolean share) throws Exception;
    }

    private final Host host;
    private final MediaHub media;
    private final AppCatalog apps;
    private final SystemMonitor system;
    private final VehicleDataProvider vehicle = new VehicleDataProvider.Unavailable();

    NativeBridge(Host host, MediaHub media, AppCatalog apps, SystemMonitor system) {
        this.host = host;
        this.media = media;
        this.apps = apps;
        this.system = system;
    }

    /** Routes one request and always produces a reply for the same id. */
    JSONObject handle(JSONObject request) {
        String id = request.optString("id");
        JSONObject response = new JSONObject();
        try {
            response.put("id", id);
            response.put("ok", true);
            response.put("data", dispatch(request.optString("method"), request.optJSONObject("args")));
        } catch (SecurityException denied) {
            fail(response, id, denied.getMessage() == null ? "permission_required" : denied.getMessage());
        } catch (IllegalStateException state) {
            fail(response, id, state.getMessage() == null ? UNAVAILABLE : state.getMessage());
        } catch (IllegalArgumentException bad) {
            fail(response, id, "bad_request");
        } catch (JSONException | RuntimeException unexpected) {
            fail(response, id, UNAVAILABLE);
        }
        return response;
    }

    private static void fail(JSONObject response, String id, String error) {
        try {
            // Rebuilt rather than patched: a half-populated success must
            // never reach the web layer as a failure with stale data.
            response.remove("data");
            response.put("id", id);
            response.put("ok", false);
            response.put("error", error);
        } catch (JSONException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    private Object dispatch(String method, JSONObject args) throws JSONException {
        switch (method) {
            case "subscribe":
                // The handshake. Everything that can push does so now, so
                // the HMI paints real state instead of waiting for the
                // first change to happen.
                host.onUiReady();
                media.refresh();
                system.push();
                apps.push();
                return true;

            case "uiFailure":
                host.onUiFailure(args == null ? "" : args.optString("message"));
                return true;

            case "diagnostics": {
                // Debug builds only: a shipped launcher tells the page
                // nothing about the device it is running on.
                JSONObject panel = host.panelDiagnostics();
                if (panel == null) throw new IllegalStateException("release_build");
                return panel;
            }

            case "vehicle":
                return vehicle.snapshot();

            case "system":
                return system.snapshot();

            case "apps":
                return apps.availability();

            case "catalog":
                return apps.catalog();

            case "launchPackage":
                apps.launchPackage(require(args, "package"));
                return true;

            case "mediaResume":
                media.resume();
                return true;

            case "systemReport":
                host.collectReport();
                return true;

            case "saveReport":
                try {
                    return new JSONObject().put("path",
                        host.saveReport(args != null && args.optBoolean("share")));
                } catch (IllegalStateException | SecurityException known) {
                    throw known;
                } catch (Exception failed) {
                    throw new IllegalStateException("unavailable");
                }

            case "homeButton": {
                // Reports, or with {request:true} asks for, the overlay
                // permission the floating Home button needs.
                boolean granted = host.homeButtonAllowed();
                if (!granted && args != null && args.optBoolean("request")) host.requestHomeButton();
                return new JSONObject().put("granted", granted);
            }

            case "mediaControl": {
                String command = args == null ? "" : args.optString("command");
                if (!media.control(command)) throw new IllegalStateException("no_session");
                return true;
            }

            case "launch":
                apps.launch(require(args, "app"));
                return true;

            case "dial":
                apps.dial(require(args, "number"));
                return true;

            default:
                throw new IllegalArgumentException("unknown method");
        }
    }

    private static String require(JSONObject args, String key) {
        String value = args == null ? null : args.optString(key, null);
        if (value == null || value.isEmpty()) throw new IllegalArgumentException(key);
        return value;
    }
}
