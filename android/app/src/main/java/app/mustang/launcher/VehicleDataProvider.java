package app.mustang.launcher;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * The seam a real TQ919 integration plugs into.
 *
 * <p>Nothing in this launcher guesses at vehicle data. The head unit's
 * MCU/CAN path is undocumented to us, and probing unknown vendor services
 * or broadcasting speculative intents is how a head unit gets bricked, so
 * V1 ships exactly one implementation: {@link Unavailable}.
 *
 * <p>When discovery on the physical unit identifies a documented source —
 * a vendor service, a broadcast, an MCU socket, a CAN adapter, an SDK —
 * it becomes a second implementation of this interface and nothing above
 * it has to change. The web layer already renders an unavailable vehicle
 * correctly, so a later provider only has to start returning values.
 */
public interface VehicleDataProvider {

    /** Fields are null when this provider cannot source them. */
    JSONObject snapshot();

    /**
     * True only when the vehicle has positively reported that it is
     * parked. An unknown state must answer false: parked-only content
     * stays held rather than released on an assumption.
     */
    boolean isVerifiedParked();

    /** Every field null, status unavailable. Honest by construction. */
    final class Unavailable implements VehicleDataProvider {

        private static final String[] FIELDS = {
            "speedKph", "gear", "fuelPct", "rangeKm", "rpm",
            "voltage", "coolantC", "oilC", "tires",
        };

        @Override
        public boolean isVerifiedParked() {
            return false;
        }

        @Override
        public JSONObject snapshot() {
            JSONObject result = new JSONObject();
            try {
                result.put("status", "unavailable");
                result.put("parked", JSONObject.NULL);
                for (String field : FIELDS) {
                    result.put(field, JSONObject.NULL);
                }
            } catch (JSONException impossible) {
                throw new IllegalStateException(impossible);
            }
            return result;
        }
    }
}
