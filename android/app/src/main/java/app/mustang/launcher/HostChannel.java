package app.mustang.launcher;

/**
 * How native code pushes an unsolicited event to the HMI.
 *
 * <p>The bridge is request/reply, but media and connectivity both have
 * real Android callbacks, so making the web layer poll for them would
 * only burn wakes on a QCM6125. Native pushes instead; the web layer
 * subscribes once.
 *
 * <p>Implementations must be safe to call from any thread.
 */
interface HostChannel {

    /**
     * @param event channel name the web layer subscribed to
     * @param data  a JSONObject or JSONArray — never a pre-serialised
     *              string. The envelope is built with the JSON library so
     *              a payload cannot break out of it, which matters
     *              because media metadata and app labels on this channel
     *              come from third-party apps.
     */
    void event(String event, Object data);
}
