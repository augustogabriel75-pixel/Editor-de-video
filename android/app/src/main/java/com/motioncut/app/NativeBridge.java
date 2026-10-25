package com.motioncut.app;

import android.app.Activity;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
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
    /** Arquivos já gravados no cache (por nome) e onde cada um foi salvo na galeria. */
    private final Map<String, String> stagedMime = new HashMap<String, String>();
    private final Map<String, Uri> savedUris = new HashMap<String, Uri>();

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
            String safe = safeName(name, "motioncut.mp4");
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

    private File exportsDir() {
        return new File(activity.getCacheDir(), "exports");
    }

    private File stagedFile(String name) throws IOException {
        File dir = exportsDir();
        File f = new File(dir, name);
        if (!f.getCanonicalPath().startsWith(dir.getCanonicalPath() + File.separator)) throw new IOException("caminho inválido");
        if (!f.exists()) throw new IOException("arquivo não encontrado: " + name);
        return f;
    }

    private static String safeName(String name, String fallback) {
        String safe = name == null ? "" : name.replaceAll("[^A-Za-z0-9._ -]", "_").trim();
        return safe.isEmpty() ? fallback : safe;
    }

    /** Fecha o arquivo e opcionalmente salva na galeria (Filmes/MotionCut) e/ou abre o compartilhamento. */
    @JavascriptInterface
    public String finishFile(String id, boolean saveToGallery, boolean share) {
        String name = closeFile(id);
        if (name.isEmpty()) return error("arquivo desconhecido");
        return publish(name, saveToGallery, share, "");
    }

    /** Fecha o arquivo enviado em pedaços e o mantém no cache. Devolve o nome (ou "" em caso de erro). */
    @JavascriptInterface
    public String closeFile(String id) {
        Pending p;
        synchronized (files) {
            p = files.remove(id);
        }
        if (p == null) return "";
        try {
            p.out.close();
            synchronized (stagedMime) {
                stagedMime.put(p.name, p.mime);
                savedUris.remove(p.name);
            }
            return p.name;
        } catch (IOException e) {
            Log.e(MainActivity.TAG, "closeFile", e);
            return "";
        }
    }

    /**
     * Junta a trilha de vídeo de `videoName` com o áudio WAV `wavName` (codificado em AAC pelo
     * aparelho) num MP4 padrão. Roda em segundo plano e responde em window.__motioncutNativeCb(cb, json).
     */
    @JavascriptInterface
    public void muxAacAsync(final String videoName, final String wavName, final String outName, final String cb) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                String result;
                try {
                    File video = stagedFile(videoName);
                    File wav = wavName == null || wavName.isEmpty() ? null : stagedFile(wavName);
                    String name = safeName(outName, "motioncut.mp4");
                    File out = new File(exportsDir(), name);
                    if (out.getCanonicalPath().equals(video.getCanonicalPath())) {
                        name = "final-" + name;
                        out = new File(exportsDir(), name);
                    }
                    ExportMuxer.mux(video, wav, out);
                    synchronized (stagedMime) {
                        stagedMime.put(name, "video/mp4");
                        savedUris.remove(name);
                    }
                    video.delete();
                    if (wav != null) wav.delete();
                    JSONObject o = new JSONObject();
                    o.put("ok", true);
                    o.put("name", name);
                    o.put("size", out.length());
                    result = o.toString();
                } catch (Throwable e) {
                    Log.e(MainActivity.TAG, "muxAac", e);
                    result = error(e.getClass().getSimpleName() + ": " + e.getMessage());
                }
                final String js = "window.__motioncutNativeCb&&window.__motioncutNativeCb(" + JSONObject.quote(cb) + "," + JSONObject.quote(result) + ")";
                activity.runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        webView.evaluateJavascript(js, null);
                    }
                });
            }
        }).start();
    }

    /**
     * Salva na galeria e/ou compartilha um arquivo do cache.
     * target: "" (escolher app) ou "whatsapp" (abre direto no WhatsApp, se instalado).
     */
    @JavascriptInterface
    public String publish(String name, boolean saveToGallery, boolean share, String target) {
        JSONObject res = new JSONObject();
        try {
            File f = stagedFile(name);
            String mime;
            synchronized (stagedMime) {
                mime = stagedMime.get(name);
            }
            if (mime == null) mime = name.toLowerCase(Locale.ROOT).endsWith(".mp4") ? "video/mp4" : "application/octet-stream";
            res.put("ok", true);
            res.put("size", f.length());
            Uri saved = null;
            // Compartilhar pela galeria (MediaStore) é o caminho mais compatível com WhatsApp e afins.
            if (saveToGallery || (share && mime.startsWith("video/"))) {
                try {
                    saved = saveCopy(f, name, mime);
                    if (saveToGallery) {
                        res.put("saved", saved != null);
                        String where = lastSavedLocation;
                        if (where != null) res.put("location", where);
                    }
                } catch (Exception e) {
                    Log.w(MainActivity.TAG, "saveCopy", e);
                    if (saveToGallery) throw e;
                }
            }
            if (share) {
                Uri uri = saved != null && Build.VERSION.SDK_INT >= 29 ? saved : ShareProvider.uriFor(f);
                String r = openShare(uri, mime, name, target);
                res.put("shared", r);
            }
        } catch (Exception e) {
            Log.e(MainActivity.TAG, "publish", e);
            return error(String.valueOf(e.getMessage()));
        }
        return res.toString();
    }

    private static String error(String msg) {
        JSONObject o = new JSONObject();
        try {
            o.put("ok", false);
            o.put("error", msg);
        } catch (JSONException ignored) {
            // nunca acontece
        }
        return o.toString();
    }

    private String lastSavedLocation;

    private Uri saveCopy(File file, String name, String mime) throws IOException {
        synchronized (stagedMime) {
            Uri prev = savedUris.get(name);
            if (prev != null) return prev;
        }
        boolean video = mime.startsWith("video/");
        String folder = (video ? Environment.DIRECTORY_MOVIES : Environment.DIRECTORY_DOWNLOADS) + "/MotionCut";
        Uri result;
        if (Build.VERSION.SDK_INT >= 29) {
            ContentResolver resolver = activity.getContentResolver();
            ContentValues v = new ContentValues();
            v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
            v.put(MediaStore.MediaColumns.RELATIVE_PATH, folder);
            v.put(MediaStore.MediaColumns.IS_PENDING, 1);
            Uri collection = video
                    ? MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
                    : MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
            Uri item = resolver.insert(collection, v);
            if (item == null) return null;
            OutputStream os = resolver.openOutputStream(item);
            if (os == null) return null;
            copy(new FileInputStream(file), os);
            ContentValues done = new ContentValues();
            done.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(item, done, null, null);
            lastSavedLocation = folder + "/" + name;
            result = item;
        } else {
            File dir = activity.getExternalFilesDir(video ? Environment.DIRECTORY_MOVIES : Environment.DIRECTORY_DOWNLOADS);
            if (dir == null) return null;
            File out = new File(dir, name);
            copy(new FileInputStream(file), new FileOutputStream(out));
            lastSavedLocation = out.getAbsolutePath();
            result = Uri.fromFile(out);
        }
        synchronized (stagedMime) {
            savedUris.put(name, result);
        }
        return result;
    }

    private String openShare(final Uri uri, final String mime, final String name, final String target) {
        final Intent send = new Intent(Intent.ACTION_SEND);
        send.setType(mime);
        send.putExtra(Intent.EXTRA_STREAM, uri);
        send.setClipData(ClipData.newRawUri(name, uri));
        send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        String pkg = null;
        if ("whatsapp".equals(target)) {
            PackageManager pm = activity.getPackageManager();
            for (String cand : new String[] { "com.whatsapp", "com.whatsapp.w4b" }) {
                try {
                    pm.getPackageInfo(cand, 0);
                    pkg = cand;
                    break;
                } catch (PackageManager.NameNotFoundException ignored) {
                    // não instalado
                }
            }
        }
        final String chosen = pkg;
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    if (chosen != null) {
                        send.setPackage(chosen);
                        activity.startActivity(send);
                        return;
                    }
                } catch (Exception e) {
                    Log.w(MainActivity.TAG, "whatsapp", e);
                    send.setPackage(null);
                }
                Intent chooser = Intent.createChooser(send, "Compartilhar vídeo");
                chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                activity.startActivity(chooser);
            }
        });
        return chosen != null ? chosen : "chooser";
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
