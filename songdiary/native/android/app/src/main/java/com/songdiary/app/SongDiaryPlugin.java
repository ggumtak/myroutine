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
    private static final long MAX_SIZE = 300L * 1024 * 1024; /* the app refuses bigger files anyway (MAX_AUDIO) */
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
    }

    @Override
    public void load() {
        take(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        take(intent);
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
        JSObject r = new JSObject();
        r.put("files", files);
        call.resolve(r);
    }

    /* a share from another app: copy the files off the main thread, then tell the page */
    private void take(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        final List<Uri> uris = new ArrayList<>();
        if (Intent.ACTION_SEND.equals(action)) {
            Uri u = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (u != null) uris.add(u);
        } else if (Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            ArrayList<Uri> list = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (list != null) uris.addAll(list);
        } else {
            return;
        }
        intent.setAction(Intent.ACTION_MAIN); /* not taken twice when the activity is recreated */
        if (uris.isEmpty()) return;
        new Thread(() -> {
            File dir = new File(getContext().getCacheDir(), "incoming");
            dir.mkdirs();
            dropStale(dir);
            ContentResolver cr = getContext().getContentResolver();
            List<JSObject> got = new ArrayList<>();
            for (Uri u : uris) {
                try {
                    String name = "녹음";
                    long size = -1;
                    try (Cursor c = cr.query(u, null, null, null, null)) {
                        if (c != null && c.moveToFirst()) {
                            int ni = c.getColumnIndex(OpenableColumns.DISPLAY_NAME), si = c.getColumnIndex(OpenableColumns.SIZE);
                            if (ni >= 0 && c.getString(ni) != null) name = c.getString(ni);
                            if (si >= 0 && !c.isNull(si)) size = c.getLong(si);
                        }
                    } catch (Exception e) { /* no metadata */ }
                    String mime = cr.getType(u);
                    JSObject f = new JSObject();
                    f.put("name", name);
                    f.put("mime", mime == null ? "" : mime);
                    if (size > MAX_SIZE) {
                        f.put("size", size);
                        f.put("path", "");
                    } else {
                        File out = free(dir, name.replaceAll("[\\\\/:*?\"<>|]", "_"));
                        long n = 0;
                        try (InputStream in = cr.openInputStream(u); OutputStream os = new FileOutputStream(out)) {
                            byte[] buf = new byte[65536];
                            int r;
                            while ((r = in.read(buf)) > 0) { os.write(buf, 0, r); n += r; if (n > MAX_SIZE) break; }
                        } catch (Exception e) {
                            out.delete(); /* no half copy left behind */
                            throw e;
                        }
                        f.put("size", n);
                        if (n > MAX_SIZE) {
                            out.delete(); /* the page refuses it and never reads it */
                            f.put("path", "");
                        } else {
                            f.put("path", Uri.fromFile(out).toString());
                        }
                    }
                    got.add(f);
                } catch (Exception e) {
                    Log.w(TAG, "shared file", e);
                }
            }
            synchronized (pending) { pending.addAll(got); }
            notifyListeners("sharedFiles", new JSObject(), true);
        }).start();
    }

    /* copies older than a day that nobody picked up (the app was closed before the page read them) */
    private void dropStale(File dir) {
        File[] old = dir.listFiles();
        if (old == null) return;
        Set<String> keep = new HashSet<>();
        synchronized (pending) {
            for (JSObject f : pending) keep.add(f.getString("path", ""));
        }
        long cutoff = System.currentTimeMillis() - 24L * 60 * 60 * 1000;
        for (File f : old) {
            if (f.isFile() && f.lastModified() < cutoff && !keep.contains(Uri.fromFile(f).toString())) f.delete();
        }
    }

    private static File free(File dir, String name) {
        File f = new File(dir, name);
        int dot = name.lastIndexOf('.');
        String base = dot > 0 ? name.substring(0, dot) : name, ext = dot > 0 ? name.substring(dot) : "";
        for (int i = 2; f.exists(); i++) f = new File(dir, base + " (" + i + ")" + ext);
        return f;
    }
}
