package com.songdiary.app;

import android.content.ContentResolver;
import android.content.Intent;
import android.content.res.Configuration;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.provider.Settings;
import android.util.Log;
import android.view.WindowManager;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** What www/native.js asks of Android beyond the standard plugins: keep the screen on, open the app's settings,
 *  and recordings shared to the app (copied into cache/incoming, then picked up with takeSharedFiles; the page
 *  deletes each copy once it has read it). Not cache/share: the page empties that one for its own exports. */
@CapacitorPlugin(name = "SongDiary")
public class SongDiaryPlugin extends Plugin {
    private static final String TAG = "SongDiary";
    private final List<JSObject> pending = new ArrayList<>();

    private JSObject windowState() {
        Configuration c = getContext().getResources().getConfiguration();
        JSObject r = new JSObject();
        r.put("multiWindow", getActivity().isInMultiWindowMode());
        r.put("width", c.screenWidthDp);
        r.put("height", c.screenHeightDp);
        return r;
    }

    @PluginMethod
    public void getWindowState(PluginCall call) { call.resolve(windowState()); }

    @Override
    protected void handleOnConfigurationChanged(Configuration c) {
        super.handleOnConfigurationChanged(c);
        notifyListeners("windowChanged", windowState());
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        notifyListeners("windowChanged", windowState());
        if (SharedFiles.hasPending(getContext())) notifyListeners("sharedFiles", new JSObject(), true);
    }

    @Override
    public void load() {
        take(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        take(intent);
        if (intent != null && intent.getBooleanExtra(SharedFiles.EXTRA, false)) notifyListeners("sharedFiles", new JSObject(), true);
    }

    @PluginMethod
    public void keepAwake(PluginCall call) {
        final boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        getActivity().runOnUiThread(() -> {
            if (on) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        });
        call.resolve();
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", getContext().getPackageName(), null));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    /* the crash MainActivity wrote down last time (once), or nothing */
    @PluginMethod
    public void lastCrash(PluginCall call) {
        File f = new File(getContext().getFilesDir(), MainActivity.CRASH_FILE);
        JSObject r = new JSObject();
        if (f.isFile()) {
            try (InputStream in = new java.io.FileInputStream(f)) {
                byte[] b = new byte[(int) Math.min(f.length(), 16384)];
                int n = 0, k;
                while (n < b.length && (k = in.read(b, n, b.length - n)) > 0) n += k;
                r.put("text", new String(b, 0, n, java.nio.charset.StandardCharsets.UTF_8));
            } catch (Exception e) {
                Log.w(TAG, "crash report", e);
            }
            f.delete();
        }
        call.resolve(r);
    }

    @PluginMethod
    public void takeSharedFiles(PluginCall call) {
        JSArray files = new JSArray();
        synchronized (pending) {
            for (JSObject f : pending) files.put(f);
            pending.clear();
        }
        for (JSObject f : SharedFiles.takePending(getContext())) files.put(f); /* copied by ShareActivity */
        JSObject r = new JSObject();
        r.put("files", files);
        call.resolve(r);
    }

    /* a share delivered straight to this activity (older installs): copy the files off the main thread, then tell the page */
    private void take(Intent intent) {
        final List<Uri> uris = SharedFiles.urisOf(intent);
        if (uris.isEmpty()) return;
        intent.setAction(Intent.ACTION_MAIN); /* not taken twice when the activity is recreated */
        new Thread(() -> {
            List<JSObject> got = SharedFiles.copy(getContext(), uris);
            synchronized (pending) { pending.addAll(got); }
            notifyListeners("sharedFiles", new JSObject(), true);
        }).start();
    }
}
