package app.mustang.launcher;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.IntentFilter;
import android.os.Build;

/**
 * Registers receivers with the export flag that API 33+ requires.
 *
 * <p>Everything this launcher listens for — package changes, Bluetooth
 * adapter state, location provider state — is a protected system
 * broadcast. NOT_EXPORTED is therefore both correct and the tighter of
 * the two options: no other app needs to reach these receivers, and
 * declaring it keeps a targetSdk 35 build off the exported-by-default
 * path.
 */
final class Receivers {

    private Receivers() {
    }

    static void register(Context context, BroadcastReceiver receiver, IntentFilter filter) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            context.registerReceiver(receiver, filter);
        }
    }

    static void unregister(Context context, BroadcastReceiver receiver) {
        try {
            context.unregisterReceiver(receiver);
        } catch (IllegalArgumentException notRegistered) {
            // Registration failed earlier or this ran twice. Either way
            // there is nothing left to unwind.
        }
    }
}
