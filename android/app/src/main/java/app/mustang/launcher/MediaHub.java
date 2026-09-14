package app.mustang.launcher;

import android.content.ComponentName;
import android.content.Context;
import android.graphics.Bitmap;
import android.media.MediaMetadata;
import android.media.session.MediaController;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import android.os.Handler;
import android.os.HandlerThread;
import android.util.Base64;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.Objects;

/**
 * Reads the active Android {@code MediaSession} and pushes it to the HMI.
 *
 * <p>Event-driven, not polled: Android already tells us when the set of
 * active sessions changes and when the chosen session's metadata or
 * playback state changes, so the launcher never wakes the CPU to ask.
 *
 * <p>Everything here runs on one background thread. Session queries are
 * binder calls and artwork encoding is a JPEG compress — neither belongs
 * on the thread that is also compositing the HMI.
 *
 * <p>Artwork is the expensive part of a media push, so it is encoded only
 * when the track identity actually changes and is bounded to 256px. A
 * player that emits a position update every second must not cause a
 * 40 KB base64 string to cross the bridge every second.
 */
final class MediaHub {

    /** Long edge, in pixels, that cover art is reduced to before encoding. */
    private static final int ARTWORK_MAX_PX = 256;
    private static final int ARTWORK_QUALITY = 75;

    private final Context context;
    private final HostChannel channel;
    private final ComponentName listener;
    private final MediaSessionManager sessions;

    private final HandlerThread thread;
    private final Handler worker;

    /**
     * Session currently mirrored into the HMI. Written on the worker
     * thread, read from the UI thread by {@link #control}, so the
     * reference has to be published safely.
     */
    private volatile MediaController current;
    /** Track identity the cached artwork belongs to. Worker thread only. */
    private String artworkKey;
    private String artworkData;
    private boolean released;

    private final MediaSessionManager.OnActiveSessionsChangedListener sessionsChanged =
        controllers -> rebind();

    private final MediaController.Callback controllerCallback = new MediaController.Callback() {
        @Override public void onMetadataChanged(MediaMetadata metadata) { publish(); }
        @Override public void onPlaybackStateChanged(PlaybackState state) { publish(); }
        @Override public void onSessionDestroyed() { rebind(); }
    };

    MediaHub(Context context, HostChannel channel) {
        this.context = context.getApplicationContext();
        this.channel = channel;
        this.listener = new ComponentName(context, MediaAccessService.class);
        this.sessions = (MediaSessionManager)
            context.getSystemService(Context.MEDIA_SESSION_SERVICE);
        this.thread = new HandlerThread("mustang-media");
        this.thread.start();
        this.worker = new Handler(thread.getLooper());
    }

    /** Begins listening. Safe to call before notification access is granted. */
    void start() {
        worker.post(() -> {
            if (released || sessions == null) {
                publishUnavailable();
                return;
            }
            try {
                sessions.addOnActiveSessionsChangedListener(sessionsChanged, listener, worker);
            } catch (SecurityException denied) {
                // Notification access not granted yet. The HMI shows the
                // "enable media access" path; a later grant restarts us.
                publishUnavailable();
                return;
            } catch (RuntimeException unsupported) {
                publishUnavailable();
                return;
            }
            rebind();
        });
    }

    /** Re-attempts binding, e.g. after the user grants notification access. */
    void refresh() {
        worker.post(this::rebind);
    }

    /**
     * Sends the current state to the HMI without waiting for a change.
     * Used for the initial paint right after the web layer subscribes.
     */
    void push() {
        worker.post(this::publish);
    }

    /**
     * Issues a transport command to the owning session.
     *
     * <p>Returns whether the command was <em>delivered</em>. It never
     * claims the playback state changed: only the session's own callback
     * is allowed to move the HMI, so a player that ignores the command
     * leaves the UI showing what is actually true.
     */
    boolean control(String command) {
        MediaController controller = current;
        if (controller == null) return false;
        MediaController.TransportControls controls = controller.getTransportControls();
        switch (command) {
            case "play": controls.play(); return true;
            case "pause": controls.pause(); return true;
            case "next": controls.skipToNext(); return true;
            case "previous": controls.skipToPrevious(); return true;
            default: return false;
        }
    }

    void release() {
        worker.post(() -> {
            released = true;
            detach();
            if (sessions != null) {
                try {
                    sessions.removeOnActiveSessionsChangedListener(sessionsChanged);
                } catch (RuntimeException ignored) {
                    // Listener was never registered; nothing to unwind.
                }
            }
        });
        thread.quitSafely();
    }

    /* ---------------- worker thread only ---------------- */

    private void detach() {
        if (current != null) {
            current.unregisterCallback(controllerCallback);
            current = null;
        }
    }

    private void rebind() {
        if (released) return;
        MediaController chosen = null;
        try {
            List<MediaController> active = sessions.getActiveSessions(listener);
            for (MediaController candidate : active) {
                PlaybackState state = candidate.getPlaybackState();
                if (state != null && state.getState() == PlaybackState.STATE_PLAYING) {
                    chosen = candidate;
                    break;
                }
            }
            if (chosen == null && !active.isEmpty()) chosen = active.get(0);
        } catch (SecurityException denied) {
            detach();
            publishUnavailable();
            return;
        } catch (RuntimeException unavailable) {
            detach();
            publishUnavailable();
            return;
        }

        boolean same = current != null && chosen != null
            && Objects.equals(current.getSessionToken(), chosen.getSessionToken());
        if (!same) {
            detach();
            current = chosen;
            if (current != null) current.registerCallback(controllerCallback, worker);
        }
        publish();
    }

    private void publishUnavailable() {
        try {
            channel.event("media", new JSONObject().put("status", "unavailable"));
        } catch (JSONException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    private void publish() {
        if (released) return;
        MediaController controller = current;
        if (controller == null) {
            publishUnavailable();
            return;
        }
        try {
            channel.event("media", snapshot(controller));
        } catch (JSONException impossible) {
            throw new IllegalStateException(impossible);
        } catch (RuntimeException gone) {
            // The session died between the callback and the read.
            publishUnavailable();
        }
    }

    private JSONObject snapshot(MediaController controller) throws JSONException {
        MediaMetadata metadata = controller.getMetadata();
        PlaybackState state = controller.getPlaybackState();

        String title = string(metadata, MediaMetadata.METADATA_KEY_TITLE);
        String artist = string(metadata, MediaMetadata.METADATA_KEY_ARTIST);
        String album = string(metadata, MediaMetadata.METADATA_KEY_ALBUM);
        String pkg = controller.getPackageName();

        JSONObject data = new JSONObject();
        data.put("status", "live");
        data.put("app", pkg);
        data.put("appLabel", AppCatalog.labelOf(context, pkg));
        data.put("title", title);
        data.put("artist", artist);
        data.put("album", album);
        data.put("playing", state != null && state.getState() == PlaybackState.STATE_PLAYING);
        data.put("durationSec", metadata == null
            ? 0 : Math.max(0, metadata.getLong(MediaMetadata.METADATA_KEY_DURATION) / 1000));
        data.put("positionSec", state == null ? 0 : Math.max(0, state.getPosition() / 1000));

        long actions = state == null ? 0 : state.getActions();
        data.put("canPlay", has(actions, PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PLAY_PAUSE
            | PlaybackState.ACTION_PAUSE));
        data.put("canNext", has(actions, PlaybackState.ACTION_SKIP_TO_NEXT));
        data.put("canPrevious", has(actions, PlaybackState.ACTION_SKIP_TO_PREVIOUS));

        String artwork = artworkFor(pkg + '\0'
            + string(metadata, MediaMetadata.METADATA_KEY_MEDIA_ID)
            + '\0' + title + '\0' + album, metadata);
        if (artwork != null) data.put("artwork", artwork);
        return data;
    }

    private static boolean has(long actions, long wanted) {
        return (actions & wanted) != 0;
    }

    private static String string(MediaMetadata metadata, String key) {
        if (metadata == null) return "";
        String value = metadata.getString(key);
        return value == null ? "" : value;
    }

    /**
     * Encodes cover art, reusing the last result while the track has not
     * changed. A position tick therefore costs a small JSON object, not a
     * fresh bitmap compress and a base64 string.
     */
    private String artworkFor(String key, MediaMetadata metadata) {
        if (key.equals(artworkKey)) return artworkData;
        artworkKey = key;
        artworkData = null;
        if (metadata == null) return null;

        Bitmap source = metadata.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART);
        if (source == null) source = metadata.getBitmap(MediaMetadata.METADATA_KEY_ART);
        if (source == null || source.getWidth() <= 0 || source.getHeight() <= 0) return null;

        Bitmap scaled = null;
        try {
            int longEdge = Math.max(source.getWidth(), source.getHeight());
            float scale = Math.min(1f, (float) ARTWORK_MAX_PX / longEdge);
            int width = Math.max(1, Math.round(source.getWidth() * scale));
            int height = Math.max(1, Math.round(source.getHeight() * scale));
            scaled = Bitmap.createScaledBitmap(source, width, height, true);

            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            scaled.compress(Bitmap.CompressFormat.JPEG, ARTWORK_QUALITY, bytes);
            artworkData = "data:image/jpeg;base64,"
                + Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP);
        } catch (RuntimeException | OutOfMemoryError failed) {
            // A cover is never worth destabilising the launcher for.
            artworkData = null;
        } finally {
            if (scaled != null && scaled != source) scaled.recycle();
        }
        return artworkData;
    }
}
