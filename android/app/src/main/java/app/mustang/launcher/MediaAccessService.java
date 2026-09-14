package app.mustang.launcher;

import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

/**
 * Exists solely so the user can grant notification access, which is the
 * only supported way to read active {@code MediaSession}s on Android.
 *
 * <p>The callbacks are overridden to no-ops on purpose: this service
 * never reads, stores, or forwards notification content. Nothing from a
 * notification reaches the web layer — the HMI receives media metadata
 * from MediaSession, and nothing else.
 */
public final class MediaAccessService extends NotificationListenerService {

    @Override
    public void onNotificationPosted(StatusBarNotification notification) {
        // Intentionally empty. See the class comment.
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification notification) {
        // Intentionally empty. See the class comment.
    }
}
