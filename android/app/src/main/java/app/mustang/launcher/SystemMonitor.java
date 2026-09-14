package app.mustang.launcher;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.location.LocationManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Build;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Connectivity for the HMI's status icons: data link, GPS provider and
 * Bluetooth adapter.
 *
 * <p>All three are push sources on Android, so this class registers
 * callbacks and receivers rather than sampling on a timer. The status bar
 * updates when something actually changes and costs nothing in between.
 *
 * <p>Each value is reported at exactly the confidence we have. "Network"
 * means a validated default network, not merely an interface being up.
 * "GPS enabled" means the provider is switched on — it is not a fix, and
 * the HMI does not claim it is one.
 */
final class SystemMonitor {

    private final Context context;
    private final HostChannel channel;
    private final ConnectivityManager connectivity;

    private ConnectivityManager.NetworkCallback networkCallback;
    private BroadcastReceiver stateChanges;

    SystemMonitor(Context context, HostChannel channel) {
        this.context = context.getApplicationContext();
        this.channel = channel;
        this.connectivity =
            (ConnectivityManager) this.context.getSystemService(Context.CONNECTIVITY_SERVICE);
    }

    void start() {
        if (connectivity != null) {
            networkCallback = new ConnectivityManager.NetworkCallback() {
                @Override public void onAvailable(Network network) { push(); }
                @Override public void onLost(Network network) { push(); }
                @Override public void onCapabilitiesChanged(Network n, NetworkCapabilities c) { push(); }
            };
            try {
                connectivity.registerDefaultNetworkCallback(networkCallback);
            } catch (RuntimeException unsupported) {
                networkCallback = null;
            }
        }

        stateChanges = new BroadcastReceiver() {
            @Override public void onReceive(Context c, Intent intent) { push(); }
        };
        IntentFilter filter = new IntentFilter();
        filter.addAction(BluetoothAdapter.ACTION_STATE_CHANGED);
        filter.addAction(LocationManager.PROVIDERS_CHANGED_ACTION);
        Receivers.register(context, stateChanges, filter);

        push();
    }

    void release() {
        if (networkCallback != null && connectivity != null) {
            try {
                connectivity.unregisterNetworkCallback(networkCallback);
            } catch (RuntimeException notRegistered) {
                // Already unwound.
            }
            networkCallback = null;
        }
        if (stateChanges != null) {
            Receivers.unregister(context, stateChanges);
            stateChanges = null;
        }
    }

    void push() {
        try {
            channel.event("system", snapshot().toString());
        } catch (JSONException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    JSONObject snapshot() throws JSONException {
        JSONObject result = new JSONObject();
        result.put("timeMs", System.currentTimeMillis());
        result.put("sdk", Build.VERSION.SDK_INT);
        result.put("network", validatedNetwork());
        result.put("gpsEnabled", gpsEnabled());
        result.put("bluetooth", bluetooth());
        return result;
    }

    private boolean validatedNetwork() {
        if (connectivity == null) return false;
        try {
            NetworkCapabilities caps =
                connectivity.getNetworkCapabilities(connectivity.getActiveNetwork());
            return caps != null
                && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
        } catch (RuntimeException unavailable) {
            return false;
        }
    }

    private boolean gpsEnabled() {
        LocationManager manager =
            (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
        if (manager == null) return false;
        try {
            return manager.isProviderEnabled(LocationManager.GPS_PROVIDER);
        } catch (RuntimeException unavailable) {
            return false;
        }
    }

    /**
     * Android 12+ gates adapter state behind BLUETOOTH_CONNECT, which V1
     * does not request — pairing happens in Android's own settings, which
     * the HMI links to. The icon then reports permission_required rather
     * than guessing "off".
     */
    private String bluetooth() {
        try {
            BluetoothManager manager =
                (BluetoothManager) context.getSystemService(Context.BLUETOOTH_SERVICE);
            if (manager == null) return "unavailable";
            BluetoothAdapter adapter = manager.getAdapter();
            if (adapter == null) return "unavailable";
            return adapter.isEnabled() ? "on" : "off";
        } catch (SecurityException denied) {
            return "permission_required";
        } catch (RuntimeException unavailable) {
            return "unavailable";
        }
    }
}
