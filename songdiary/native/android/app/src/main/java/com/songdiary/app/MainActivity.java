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

public class MainActivity extends BridgeActivity {
    private boolean recoveringRenderer;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SongDiaryPlugin.class);
        super.onCreate(savedInstanceState);
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
                getWindow().getDecorView().post(() -> { if (!isFinishing() && !isDestroyed()) recreate(); });
                return true;
            }
        });
    }
}
