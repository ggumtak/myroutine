package com.songdiary.app;

import android.os.Bundle;
import android.app.Activity;
import android.content.SharedPreferences;
import android.util.Log;
import android.view.ViewGroup;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import java.io.File;
import java.io.FileOutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;

public class MainActivity extends BridgeActivity {
    static final String CRASH_FILE = "last-crash.txt";
    private static boolean crashHook;
    private boolean recoveringRenderer;
    private boolean recreateOnStart;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        keepCrashReport();
        registerPlugin(SongDiaryPlugin.class);
        super.onCreate(savedInstanceState);
    }

    /* A crash while the app sits in Recents leaves only "앱을 열지 못했어요". Write what happened to a file the app shows
       on its next start (SongDiaryPlugin.lastCrash), then let Android handle the crash as before. */
    private void keepCrashReport() {
        if (crashHook) return;
        crashHook = true;
        final File out = new File(getFilesDir(), CRASH_FILE);
        final Thread.UncaughtExceptionHandler prev = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((t, e) -> {
            try (FileOutputStream os = new FileOutputStream(out)) {
                StringWriter sw = new StringWriter();
                e.printStackTrace(new PrintWriter(sw));
                String trace = sw.toString();
                if (trace.length() > 12000) trace = trace.substring(0, 12000);
                os.write((System.currentTimeMillis() + "\n" + t.getName() + "\n" + trace).getBytes(StandardCharsets.UTF_8));
            } catch (Throwable ignored) { /* the crash itself matters more */ }
            if (prev != null) prev.uncaughtException(t, e);
        });
    }

    @Override
    public void onStart() {
        super.onStart();
        if (recreateOnStart) {
            recreateOnStart = false;
            Log.w("SongDiary", "Recreating after the renderer was reclaimed in the background");
            recreate();
        }
    }

    @Override
    protected void load() {
        // Capacitor checks only whether the OTA directory exists. A missing entrypoint must fall back
        // to the APK, never to an empty page. IndexedDB and audio are untouched.
        SharedPreferences prefs = getSharedPreferences(com.getcapacitor.plugin.WebView.WEBVIEW_PREFS_NAME, Activity.MODE_PRIVATE);
        String path = prefs.getString(com.getcapacitor.plugin.WebView.CAP_SERVER_PATH, "");
        if (!path.isEmpty()) {
            File dir = new File(path);
            if (!new File(dir, "index.html").isFile() || !new File(dir, "app.js").isFile() || !new File(dir, "release.json").isFile()) {
                prefs.edit().remove(com.getcapacitor.plugin.WebView.CAP_SERVER_PATH).commit();
                Log.w("SongDiary", "Incomplete OTA path; using packaged screens");
            }
        }
        super.load();
        if (bridge == null) return;
        bridge.addWebViewListener(new WebViewListener() {
            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                // Android may reclaim the renderer while this task is in Recents or another window.
                // The default Capacitor handler returns false, which kills the host app as well.
                if (recoveringRenderer) return true;
                recoveringRenderer = true;
                Log.w("SongDiary", "WebView renderer gone; recreating the activity, crashed=" + detail.didCrash());
                if (view.getParent() instanceof ViewGroup) ((ViewGroup) view.getParent()).removeView(view);
                view.destroy();
                // In Recents/behind another app: rebuild only when the user comes back, so a new renderer isn't started
                // (and reclaimed again) while the memory is still needed elsewhere.
                if (getLifecycle().getCurrentState().isAtLeast(androidx.lifecycle.Lifecycle.State.STARTED)) {
                    getWindow().getDecorView().post(() -> { if (!isFinishing() && !isDestroyed()) recreate(); });
                } else {
                    recreateOnStart = true;
                }
                return true;
            }
        });
    }
}
