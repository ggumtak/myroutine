package com.songdiary.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SongDiaryPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
