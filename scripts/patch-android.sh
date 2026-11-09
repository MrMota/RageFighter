#!/usr/bin/env bash
# Customises the Capacitor-generated Android project: landscape, fullscreen, game icons.
set -euo pipefail
cd "$(dirname "$0")/.."
M=android/app/src/main
# Lock to landscape
grep -q 'screenOrientation' $M/AndroidManifest.xml || \
  sed -i 's/android:name=".MainActivity"/android:name=".MainActivity"\n            android:screenOrientation="sensorLandscape"/' $M/AndroidManifest.xml
# Immersive fullscreen
ACT=$(find $M/java -name MainActivity.java)
cat > "$ACT" <<'JAVA'
package com.mrmota.ragefighter;

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideSystemUi();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    private void hideSystemUi() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }
}
JAVA
# Launcher icons
rm -rf $M/res/mipmap-anydpi-v26
for d in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  cp android-res/ic_launcher-$d.png $M/res/mipmap-$d/ic_launcher.png
  cp android-res/ic_launcher_round-$d.png $M/res/mipmap-$d/ic_launcher_round.png
  rm -f $M/res/mipmap-$d/ic_launcher_foreground.png
done
# Gradle download: smaller "-bin" distribution and a 2-minute timeout (default 10s causes flaky CI)
W=android/gradle/wrapper/gradle-wrapper.properties
sed -i 's/-all\.zip/-bin.zip/; s/^networkTimeout=.*/networkTimeout=120000/' $W
echo "Android project patched."
