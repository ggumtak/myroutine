package com.songdiary.app;

import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Log;
import com.getcapacitor.JSObject;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/** Recordings shared from other apps. ShareActivity copies them into cache/incoming while it still holds the
 *  read permission and lists them in incoming/pending.json; the page picks them up through SongDiaryPlugin.
 *  (A share must never become the start of the app's own task: Android replays a task's first intent when it
 *  reopens it from Recents, and by then the permission to read the shared file is gone — "앱을 열지 못했어요".) */
final class SharedFiles {
    static final String EXTRA = "com.songdiary.app.SHARED";
    static final long MAX_SIZE = 300L * 1024 * 1024; /* the app refuses bigger files anyway (MAX_AUDIO) */
    private static final String TAG = "SongDiary";
    private static final String LIST = "pending.json";
    private static final Object LOCK = new Object();

    private SharedFiles() {}

    static File dir(Context ctx) {
        File d = new File(ctx.getCacheDir(), "incoming");
        d.mkdirs();
        return d;
    }

    static List<Uri> urisOf(Intent intent) {
        List<Uri> uris = new ArrayList<>();
        if (intent == null) return uris;
        String action = intent.getAction();
        try {
            if (Intent.ACTION_SEND.equals(action)) {
                Uri u = intent.getParcelableExtra(Intent.EXTRA_STREAM);
                if (u != null) uris.add(u);
            } else if (Intent.ACTION_SEND_MULTIPLE.equals(action)) {
                ArrayList<Uri> list = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
                if (list != null) uris.addAll(list);
            }
        } catch (Exception e) {
            Log.w(TAG, "shared intent", e);
        }
        return uris;
    }

    /* copy each file (name, type, size, file:// path; path "" when it is too big to keep) */
    static List<JSObject> copy(Context ctx, List<Uri> uris) {
        File dir = dir(ctx);
        dropStale(dir);
        ContentResolver cr = ctx.getContentResolver();
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
                        if (in == null) throw new IllegalStateException("no stream");
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
        return got;
    }

    /* add copies to the list the page reads */
    static void savePending(Context ctx, List<JSObject> got) {
        if (got.isEmpty()) return;
        synchronized (LOCK) {
            JSONArray all = readList(ctx);
            for (JSObject f : got) all.put(f);
            File list = new File(dir(ctx), LIST);
            try (OutputStream os = new FileOutputStream(list)) {
                os.write(all.toString().getBytes(StandardCharsets.UTF_8));
            } catch (Exception e) {
                Log.w(TAG, "shared list", e);
            }
        }
    }

    static boolean hasPending(Context ctx) {
        return new File(new File(ctx.getCacheDir(), "incoming"), LIST).isFile();
    }

    /* the listed copies, once: the list is removed as it is read */
    static List<JSObject> takePending(Context ctx) {
        List<JSObject> out = new ArrayList<>();
        synchronized (LOCK) {
            JSONArray all = readList(ctx);
            new File(dir(ctx), LIST).delete();
            for (int i = 0; i < all.length(); i++) {
                JSONObject o = all.optJSONObject(i);
                if (o == null) continue;
                JSObject f = new JSObject();
                f.put("name", o.optString("name", "녹음"));
                f.put("mime", o.optString("mime", ""));
                f.put("size", o.optLong("size", 0));
                f.put("path", o.optString("path", ""));
                out.add(f);
            }
        }
        return out;
    }

    private static JSONArray readList(Context ctx) {
        File list = new File(dir(ctx), LIST);
        if (!list.isFile()) return new JSONArray();
        try (InputStream in = new FileInputStream(list)) {
            byte[] b = new byte[(int) Math.min(list.length(), 1024 * 1024)];
            int n = 0, k;
            while (n < b.length && (k = in.read(b, n, b.length - n)) > 0) n += k;
            return new JSONArray(new String(b, 0, n, StandardCharsets.UTF_8));
        } catch (Exception e) {
            Log.w(TAG, "shared list unreadable", e);
            return new JSONArray();
        }
    }

    /* copies older than a day that nobody picked up (the app was closed before the page read them) */
    private static void dropStale(File dir) {
        File[] old = dir.listFiles();
        if (old == null) return;
        Set<String> keep = new HashSet<>();
        synchronized (LOCK) {
            File list = new File(dir, LIST);
            if (list.isFile()) {
                try (InputStream in = new FileInputStream(list)) {
                    byte[] b = new byte[(int) Math.min(list.length(), 1024 * 1024)];
                    int n = 0, k;
                    while (n < b.length && (k = in.read(b, n, b.length - n)) > 0) n += k;
                    JSONArray all = new JSONArray(new String(b, 0, n, StandardCharsets.UTF_8));
                    for (int i = 0; i < all.length(); i++) {
                        JSONObject o = all.optJSONObject(i);
                        if (o != null) keep.add(o.optString("path", ""));
                    }
                } catch (Exception e) { /* nothing to keep */ }
            }
        }
        long cutoff = System.currentTimeMillis() - 24L * 60 * 60 * 1000;
        for (File f : old) {
            if (f.isFile() && !LIST.equals(f.getName()) && f.lastModified() < cutoff && !keep.contains(Uri.fromFile(f).toString())) f.delete();
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
