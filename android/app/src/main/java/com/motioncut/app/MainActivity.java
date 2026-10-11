package com.motioncut.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.ConsoleMessage;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Activity única do MotionCut: um WebView que carrega o editor (build web em assets/www)
 * por uma origem HTTPS virtual, com ponte nativa para TTS, salvar/compartilhar e seletor de arquivos.
 */
public class MainActivity extends Activity {
    static final String TAG = "MotionCut";
    static final String HOST = "appassets.androidplatform.net";
    static final String START_URL = "https://" + HOST + "/index.html";
    private static final int REQ_FILES = 4101;
    private static final int BG = Color.rgb(6, 7, 10);

    private FrameLayout root;
    private WebView webView;
    private NativeBridge bridge;
    private ValueCallback<Uri[]> pendingFiles;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        root = new FrameLayout(this);
        root.setBackgroundColor(BG);
        webView = new WebView(this);
        webView.setBackgroundColor(BG);
        root.addView(webView, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        setupInsets();

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setTextZoom(100);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        if (Build.VERSION.SDK_INT >= 26) s.setSafeBrowsingEnabled(false);
        WebView.setWebContentsDebuggingEnabled(true);

        bridge = new NativeBridge(this, webView);
        webView.addJavascriptInterface(bridge, "MotionCutNative");
        webView.setWebViewClient(new AssetClient());
        webView.setWebChromeClient(new ChromeClient());
        webView.loadUrl(START_URL);
    }

    /** Android 15+ força edge-to-edge: aplica as áreas das barras do sistema e do teclado como padding. */
    private void setupInsets() {
        if (Build.VERSION.SDK_INT < 35) return;
        root.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                Insets ime = insets.getInsets(WindowInsets.Type.ime());
                v.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
                return WindowInsets.CONSUMED;
            }
        });
    }

    private static String mimeFor(String path) {
        String p = path.toLowerCase();
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js") || p.endsWith(".mjs")) return "text/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".ico")) return "image/x-icon";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".woff")) return "font/woff";
        if (p.endsWith(".ttf")) return "font/ttf";
        if (p.endsWith(".wasm")) return "application/wasm";
        if (p.endsWith(".mp3")) return "audio/mpeg";
        if (p.endsWith(".wav")) return "audio/wav";
        if (p.endsWith(".mp4")) return "video/mp4";
        return "application/octet-stream";
    }

    private class AssetClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            if (!HOST.equals(url.getHost())) return null;
            String path = url.getPath();
            if (path == null || path.isEmpty() || "/".equals(path)) path = "/index.html";
            Map<String, String> headers = new HashMap<String, String>();
            headers.put("Cache-Control", "no-cache");
            headers.put("Access-Control-Allow-Origin", "*");
            String mime = mimeFor(path);
            String encoding = mime.startsWith("text/") || mime.contains("json") || mime.contains("svg") ? "UTF-8" : null;
            try {
                InputStream in = getAssets().open("www" + path);
                WebResourceResponse res = new WebResourceResponse(mime, encoding, in);
                res.setResponseHeaders(headers);
                return res;
            } catch (IOException e) {
                return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", headers, new ByteArrayInputStream(new byte[0]));
            }
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            if (HOST.equals(url.getHost())) return false;
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, url));
            } catch (ActivityNotFoundException ignored) {
                // sem app para abrir o link
            }
            return true;
        }
    }

    private class ChromeClient extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (pendingFiles != null) pendingFiles.onReceiveValue(null);
            pendingFiles = callback;
            List<String> types = new ArrayList<String>();
            String[] accept = params.getAcceptTypes();
            if (accept != null) {
                for (String a : accept) {
                    if (a == null) continue;
                    for (String t : a.split(",")) {
                        String tt = t.trim();
                        if (tt.contains("/")) types.add(tt);
                    }
                }
            }
            Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            if (types.size() == 1) intent.setType(types.get(0));
            else {
                intent.setType("*/*");
                if (!types.isEmpty()) intent.putExtra(Intent.EXTRA_MIME_TYPES, types.toArray(new String[0]));
            }
            if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            try {
                startActivityForResult(Intent.createChooser(intent, "Importar mídia"), REQ_FILES);
            } catch (ActivityNotFoundException e) {
                pendingFiles = null;
                return false;
            }
            return true;
        }

        @Override
        public boolean onConsoleMessage(ConsoleMessage m) {
            Log.d(TAG, m.message() + " (" + m.sourceId() + ":" + m.lineNumber() + ")");
            return true;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILES) {
            if (pendingFiles == null) return;
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null) {
                ClipData clip = data.getClipData();
                if (clip != null && clip.getItemCount() > 0) {
                    result = new Uri[clip.getItemCount()];
                    for (int i = 0; i < clip.getItemCount(); i++) result[i] = clip.getItemAt(i).getUri();
                } else if (data.getData() != null) {
                    result = new Uri[] { data.getData() };
                }
            }
            pendingFiles.onReceiveValue(result);
            pendingFiles = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    /** O botão voltar fecha painéis/modais do editor antes de sair do app. */
    @Override
    public void onBackPressed() {
        webView.evaluateJavascript("(window.MotionCutBack && window.MotionCutBack()) ? 'handled' : 'exit'", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String value) {
                if (value == null || !value.contains("handled")) finish();
            }
        });
    }

    @Override
    protected void onPause() {
        if (webView != null) {
            webView.evaluateJavascript("window.MotionCut && window.MotionCut.store.getState().pause()", null);
            webView.onPause();
        }
        if (bridge != null) bridge.stopSpeaking();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onDestroy() {
        if (bridge != null) bridge.shutdown();
        if (webView != null) {
            root.removeView(webView);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
