package com.harnagea.smartpostacademy;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.window.OnBackInvokedDispatcher;

/** Shows the bundled course (assets/index.html) full-screen. Progress lives in the WebView's local storage. */
public class MainActivity extends Activity {
    private static final int BG = 0xFF0F1512;
    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(BG);
        web = new WebView(this);
        web.setBackgroundColor(BG);
        root.addView(web, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // localStorage keeps your progress
        s.setTextZoom(100);

        // Progress is saved in the app's own storage (SharedPreferences) through this bridge,
        // so it survives restarts and updates. Only the bundled course page can call it:
        // every web link opens in your browser instead.
        web.addJavascriptInterface(new ProgressStore(getSharedPreferences("course", MODE_PRIVATE)), "AndroidStore");
        // Needed for confirm() and prompt() dialogs (Reference, Reset, Restore buttons).
        web.setWebChromeClient(new WebChromeClient());

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("file".equals(uri.getScheme())) return false;   // stay inside the course
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));   // sources open in the browser
                } catch (Exception ignored) { }
                return true;
            }
        });

        // Android 15+ draws apps edge to edge: pad for the status bar, navigation bar and keyboard.
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((v, insets) -> {
                Insets i = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime());
                v.setPadding(i.left, i.top, i.right, i.bottom);
                return WindowInsets.CONSUMED;
            });
        } else {
            root.setFitsSystemWindows(true);
        }

        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::goBackOrFinish);
        }

        if (state != null) web.restoreState(state);
        else web.loadUrl("file:///android_asset/index.html");
    }

    /** Called from JavaScript as window.AndroidStore.load() / save(json). */
    static final class ProgressStore {
        private final SharedPreferences prefs;
        ProgressStore(SharedPreferences prefs) { this.prefs = prefs; }

        @JavascriptInterface
        public String load() { return prefs.getString("progress", ""); }

        @JavascriptInterface
        public void save(String json) { prefs.edit().putString("progress", json).commit(); }
    }

    private void goBackOrFinish() {
        if (web.canGoBack()) web.goBack(); else finish();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        goBackOrFinish();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }
}
