# TQ919 / QCM6125 discovery — parked bench only

No device has been connected. Everything below is a **command to run**,
not a result that was collected. Nothing here has been verified.

Read-only throughout. Do not flash the MCU, modify the ROM, alter
SystemUI, disable packages, apply `wm` overrides, or root the unit.

Package and activity dumps can contain personal information. Save output
locally; do not paste raw dumps into the repository or an issue.

---

## 1. Identity and screen

The two that matter most are `wm size` and `wm density`: together they
say whether the panel's 2400 physical pixels are 2400 Android dp, which
is what the HMI's composition assumes.

```sh
adb devices -l
adb shell wm size
adb shell wm density
adb shell getprop ro.build.version.release
adb shell getprop ro.build.version.sdk
adb shell getprop ro.product.manufacturer
adb shell getprop ro.product.model
adb shell getprop ro.product.device
adb shell getprop ro.product.board
adb shell getprop ro.hardware
adb shell getprop ro.build.characteristics
```

The head unit's advertised Android version is not trusted until
`ro.build.version.sdk` confirms it.

## 2. WebView

The HMI is a WebView app, so the WebView implementation *is* the runtime.

```sh
adb shell dumpsys webviewupdate
adb shell pm list packages | grep -Ei 'webview|chrome'
adb shell dumpsys package com.google.android.webview | grep -i version
```

Check: is there a WebView provider at all, what version, and does it
support `WEB_MESSAGE_LISTENER`? The Vite build targets Chrome 87. A
WebView older than that, or one without the message-listener feature,
lands on the native recovery panel by design — confirm which.

## 3. Home and the recovery path

**Record this before installing anything.** It is how you get back.

```sh
adb shell cmd package resolve-activity --brief \
  -a android.intent.action.MAIN -c android.intent.category.HOME
adb shell cmd package query-activities --brief \
  -a android.intent.action.MAIN -c android.intent.category.HOME
```

Write down the original Home package/activity. If Home settings turn out
to be unavailable on this unit, that recorded component is the way back:

```sh
adb shell am start -n ORIGINAL_PACKAGE/ORIGINAL_ACTIVITY
```

Do not guess it.

## 4. Media, vendor services, MCU

```sh
adb shell pm list packages -f
adb shell dumpsys media_session
adb shell dumpsys activity services
adb shell dumpsys activity broadcasts | head -200
adb shell service list
```

Look for vendor / MCU / CAN / phone-projection packages and services.
For anything that looks relevant:

```sh
adb shell dumpsys package THE_PACKAGE
```

Inspect its **documented, exported** services, intents and permissions.
Do not bind unknown services and do not send guessed broadcasts. Obtain a
vendor SDK or a documented protocol before writing a second
`VehicleDataProvider`. "CAN unknown" is not evidence that CAN is
accessible.

Also worth checking: does any Bluetooth media player on this unit publish
a MediaSession at all? Some vendor players do not, in which case the HMI
correctly shows no media source.

## 5. Install and measure

Only after building the APK and recording the original Home component.

```sh
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -W -n app.mustang.launcher/.MainActivity
adb shell dumpsys meminfo app.mustang.launcher
adb shell dumpsys gfxinfo app.mustang.launcher
adb shell input keyevent KEYCODE_HOME
adb shell am start -a android.settings.HOME_SETTINGS
adb shell dumpsys package app.mustang.launcher
```

Record cold and warm `TotalTime` / `WaitTime` from `am start -W`.

## 6. What still has to be checked by hand

Open it as an ordinary app first. Do not select it as default Home until
every one of these passes.

**Startup.** Screen-record a cold start from *before* launch. There must
be no white, no grey, no default Android splash and no icon flash before
the pony. Repeat in Day and Night mode. A source review cannot establish
this on vendor firmware.

**Geometry.** Does the HMI fill 2400×900 exactly, with no letterbox and
no crop? Are touch targets physically ~76 dp at the vendor's density? Do
immersive insets actually hide the system bars?

**Lifecycle.** Ignition sleep/wake. App switching and return. Pressing
Home while already in the HMI. Does it survive a WebView update?

**Function.** Offline launch with the network disconnected. Media with
access granted and revoked. Maps/Spotify present and absent. The dialer
hand-off. The recovery panel — force it by clearing app data mid-load.

**Recovery.** Can you get back to the original launcher, every time?

**Resources.** `meminfo` and `gfxinfo` after an hour of use: any leak,
any jank.

None of the above has been performed. Until it has, this is a buildable
project, not a validated launcher.
