package com.motioncut.app;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.speech.tts.TextToSpeech;
import android.util.Base64;
import android.util.Log;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Ponte JavaScript -> Android exposta como window.MotionCutNative.
 * Os métodos rodam na thread da ponte do WebView; operações de UI usam runOnUiThread.
 */
public class NativeBridge implements TextToSpeech.OnInitListener {
    private final Activity activity;
    private final WebView webView;
    private TextToSpeech tts;
    private volatile boolean ttsReady = false;
    private final Map<String, Pending> files = new HashMap<String, Pending>();

    private static class Pending {
        File file;
        String name;
        String mime;
        FileOutputStream out;
    }

    NativeBridge(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
        try {
            tts = new TextToSpeech(activity.getApplicationContext(), this);
        } catch (Exception e) {
            Log.w(MainActivity.TAG, "TTS indisponível", e);
        }
    }

    @Override
    public void onInit(int status) {
        if (status != TextToSpeech.SUCCESS || tts == null) return;
        int r = tts.setLanguage(new Locale("pt", "BR"));
        if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) tts.setLanguage(Locale.getDefault());
        ttsReady = true;
    }

    @JavascriptInterface
    public String info() {
        JSONObject o = new JSONObject();
        try {
            o.put("platform", "android");
            o.put("sdk", Build.VERSION.SDK_INT);
            o.put("model", Build.MANUFACTURER + " " + Build.MODEL);
            o.put("tts", ttsReady);
        } catch (JSONException ignored) {
            // nunca acontece
        }
        return o.toString();
    }

    @JavascriptInterface
    public boolean ttsAvailable() {
        return ttsReady;
    }

    @JavascriptInterface
    public void speak(String text, float rate, float volume) {
        if (!ttsReady || text == null) return;
        tts.setSpeechRate(Math.max(0.3f, Math.min(3f, rate)));
        Bundle params = new Bundle();
        params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, Math.max(0f, Math.min(1f, volume)));
        tts.speak(text, TextToSpeech.QUEUE_ADD, params, "mc-" + System.nanoTime());
    }

    @JavascriptInterface
    public void stopSpeaking() {
        if (tts != null) tts.stop();
    }

    @JavascriptInterface
    public void toast(final String message) {
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                Toast.makeText(activity, message, Toast.LENGTH_LONG).show();
            }
        });
    }

    @JavascriptInterface
    public void keepScreenOn(final boolean on) {
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (on) activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            }
        });
    }

    /** Inicia a gravação de um arquivo enviado em pedaços base64 pelo JavaScript. */
    @JavascriptInterface
    public String beginFile(String name, String mime) {
        try {
            File dir = new File(activity.getCacheDir(), "exports");
            if (!dir.exists() && !dir.mkdirs()) return "";
            File[] old = dir.listFiles();
            if (old != null) for (File f : old) if (System.currentTimeMillis() - f.lastModified() > 3600_000L) f.delete();
            String safe = name.replaceAll("[^A-Za-z0-9._ -]", "_").trim();
            if (safe.isEmpty()) safe = "motioncut.mp4";
            Pending p = new Pending();
            p.file = new File(dir, safe);
            p.name = safe;
            p.mime = mime == null || mime.isEmpty() ? "application/octet-stream" : mime;
            p.out = new FileOutputStream(p.file);
            String id = UUID.randomUUID().toString();
            synchronized (files) {
                files.put(id, p);
            }
            return id;
        } catch (IOException e) {
            Log.e(MainActivity.TAG, "beginFile", e);
            return "";
        }
    }

    @JavascriptInterface
    public boolean appendChunk(String id, String base64) {
        Pending p;
        synchronized (files) {
            p = files.get(id);
        }
        if (p == null) return false;
        try {
            p.out.write(Base64.decode(base64, Base64.DEFAULT));
            return true;
        } catch (Exception e) {
            Log.e(MainActivity.TAG, "appendChunk", e);
            return false;
        }
    }

    /** Fecha o arquivo e opcionalmente salva na galeria (Filmes/MotionCut) e/ou abre o compartilhamento. */
    @JavascriptInterface
    public String finishFile(String id, boolean saveToGallery, boolean share) {
        Pending p;
        synchronized (files) {
            p = files.remove(id);
        }
        JSONObject res = new JSONObject();
        try {
            if (p == null) {
                res.put("ok", false);
                res.put("error", "arquivo desconhecido");
                return res.toString();
            }
            p.out.close();
            res.put("ok", true);
            res.put("size", p.file.length());
            if (saveToGallery) {
                String where = saveCopy(p);
                res.put("saved", where != null);
                if (where != null) res.put("location", where);
            }
            if (share) openShare(p);
        } catch (Exception e) {
            Log.e(MainActivity.TAG, "finishFile", e);
            try {
                res.put("ok", false);
                res.put("error", String.valueOf(e.getMessage()));
            } catch (JSONException ignored) {
                // nunca acontece
            }
        }
        return res.toString();
    }

    private String saveCopy(Pending p) throws IOException {
        boolean video = p.mime.startsWith("video/");
        if (Build.VERSION.SDK_INT >= 29) {
            ContentResolver resolver = activity.getContentResolver();
            ContentValues v = new ContentValues();
            v.put(MediaStore.MediaColumns.DISPLAY_NAME, p.name);
            v.put(MediaStore.MediaColumns.MIME_TYPE, p.mime);
            String folder = (video ? Environment.DIRECTORY_MOVIES : Environment.DIRECTORY_DOWNLOADS) + "/MotionCut";
            v.put(MediaStore.MediaColumns.RELATIVE_PATH, folder);
            v.put(MediaStore.MediaColumns.IS_PENDING, 1);
            Uri collection = video
                    ? MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
                    : MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
            Uri item = resolver.insert(collection, v);
            if (item == null) return null;
            OutputStream os = resolver.openOutputStream(item);
            if (os == null) return null;
            copy(new FileInputStream(p.file), os);
            ContentValues done = new ContentValues();
            done.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(item, done, null, null);
            return folder + "/" + p.name;
        }
        File dir = activity.getExternalFilesDir(video ? Environment.DIRECTORY_MOVIES : Environment.DIRECTORY_DOWNLOADS);
        if (dir == null) return null;
        File out = new File(dir, p.name);
        copy(new FileInputStream(p.file), new FileOutputStream(out));
        return out.getAbsolutePath();
    }

    private void openShare(final Pending p) {
        final Uri uri = ShareProvider.uriFor(p.file);
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType(p.mime);
                send.putExtra(Intent.EXTRA_STREAM, uri);
                send.putExtra(Intent.EXTRA_TITLE, p.name);
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                Intent chooser = Intent.createChooser(send, "Compartilhar vídeo");
                chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                activity.startActivity(chooser);
            }
        });
    }

    private static void copy(InputStream in, OutputStream out) throws IOException {
        try {
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        } finally {
            in.close();
            out.close();
        }
    }

    void shutdown() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
            tts = null;
        }
    }
}
