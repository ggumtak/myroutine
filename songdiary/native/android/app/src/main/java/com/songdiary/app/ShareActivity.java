package com.songdiary.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.widget.Toast;
import java.util.List;

/** Receives recordings shared from other apps (voice recorder, KakaoTalk …): copies them while it may still read
 *  them, then opens the app with a plain intent. The share itself never starts the app's task, so reopening the
 *  app from Recents later works (see SharedFiles). */
public class ShareActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (savedInstanceState != null) { finish(); return; } /* recreated: the copy already ran */
        final List<Uri> uris = SharedFiles.urisOf(getIntent());
        if (uris.isEmpty()) { open(); return; }
        Toast.makeText(this, "소리일기로 가져오는 중…", Toast.LENGTH_SHORT).show();
        final Context app = getApplicationContext();
        new Thread(() -> {
            SharedFiles.savePending(app, SharedFiles.copy(app, uris));
            runOnUiThread(this::open);
        }).start();
    }

    private void open() {
        Intent i = new Intent(getApplicationContext(), MainActivity.class);
        i.setAction(Intent.ACTION_MAIN);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        i.putExtra(SharedFiles.EXTRA, true);
        try {
            getApplicationContext().startActivity(i);
        } catch (Exception e) { /* the copies wait for the next start */ }
        finish();
    }
}
