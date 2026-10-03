package com.pocketpos.app;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.content.UriPermission;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Lets the user choose ONE folder (with the system folder picker) and then writes backup files into it without
 * asking again — this is what makes automatic backups possible.
 *
 * It uses Android's Storage Access Framework, so no storage permission is declared or requested: choosing the folder
 * grants this app access to that folder only, and the grant is kept across restarts. Errors are rejected with short
 * codes ("folder-unavailable", "write-failed") that the web side translates.
 */
@CapacitorPlugin(name = "BackupFolder")
public class BackupFolderPlugin extends Plugin {

    @PluginMethod
    public void pick(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        );
        try {
            startActivityForResult(call, intent, "pickResult");
        } catch (Exception e) {
            call.reject("folder-unavailable");
        }
    }

    @ActivityCallback
    private void pickResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject out = new JSObject();
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            out.put("cancelled", true); // always settle the call, even if the user backs out
            call.resolve(out);
            return;
        }
        Uri tree = data.getData();
        try {
            getContext()
                .getContentResolver()
                .takePersistableUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            out.put("uri", tree.toString());
            out.put("name", folderName(tree));
            call.resolve(out);
        } catch (Exception e) {
            call.reject("folder-unavailable");
        }
    }

    @PluginMethod
    public void write(PluginCall call) {
        String uri = call.getString("uri");
        String name = call.getString("name");
        String data = call.getString("data");
        String mime = call.getString("mime", "application/json");
        if (uri == null || name == null || data == null) {
            call.reject("write-failed");
            return;
        }
        try {
            Uri tree = Uri.parse(uri);
            if (!hasWriteGrant(tree)) {
                call.reject("folder-unavailable");
                return;
            }
            ContentResolver cr = getContext().getContentResolver();
            Uri parent = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
            Uri file;
            try {
                file = DocumentsContract.createDocument(cr, parent, mime, name);
            } catch (Exception e) {
                file = null; // typically the folder was deleted or its storage removed
            }
            if (file == null) {
                call.reject("folder-unavailable");
                return;
            }
            byte[] bytes = data.getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = cr.openOutputStream(file, "w")) {
                if (os == null) {
                    call.reject("write-failed");
                    return;
                }
                os.write(bytes);
                os.flush();
            }
            JSObject out = new JSObject();
            out.put("uri", file.toString());
            out.put("bytes", bytes.length);
            call.resolve(out);
        } catch (SecurityException | IllegalArgumentException e) {
            call.reject("folder-unavailable");
        } catch (Exception e) {
            call.reject("write-failed");
        }
    }

    @PluginMethod
    public void list(PluginCall call) {
        String uri = call.getString("uri");
        if (uri == null) {
            call.reject("folder-unavailable");
            return;
        }
        try {
            Uri tree = Uri.parse(uri);
            if (!hasWriteGrant(tree)) {
                call.reject("folder-unavailable");
                return;
            }
            Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
            String[] columns = {
                DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                DocumentsContract.Document.COLUMN_SIZE,
                DocumentsContract.Document.COLUMN_LAST_MODIFIED
            };
            JSArray files = new JSArray();
            try (Cursor c = getContext().getContentResolver().query(children, columns, null, null, null)) {
                if (c == null) {
                    call.reject("folder-unavailable"); // the folder was deleted or its storage removed
                    return;
                }
                while (c.moveToNext()) {
                    JSObject f = new JSObject();
                    f.put("uri", DocumentsContract.buildDocumentUriUsingTree(tree, c.getString(0)).toString());
                    f.put("name", c.getString(1));
                    f.put("size", c.isNull(2) ? 0 : c.getLong(2));
                    f.put("modified", c.isNull(3) ? 0 : c.getLong(3));
                    files.put(f);
                }
            }
            JSObject out = new JSObject();
            out.put("files", files);
            call.resolve(out);
        } catch (Exception e) {
            call.reject("folder-unavailable");
        }
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String uri = call.getString("uri");
        if (uri == null) {
            call.reject("write-failed");
            return;
        }
        try {
            DocumentsContract.deleteDocument(getContext().getContentResolver(), Uri.parse(uri));
            call.resolve();
        } catch (Exception e) {
            call.reject("write-failed");
        }
    }

    /** True while the app still holds the persisted read+write grant the user gave for this folder. */
    private boolean hasWriteGrant(Uri tree) {
        for (UriPermission p : getContext().getContentResolver().getPersistedUriPermissions()) {
            if (p.getUri().equals(tree) && p.isWritePermission()) return true;
        }
        return false;
    }

    private String folderName(Uri tree) {
        Uri doc = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
        String[] columns = { DocumentsContract.Document.COLUMN_DISPLAY_NAME };
        try (Cursor c = getContext().getContentResolver().query(doc, columns, null, null, null)) {
            if (c != null && c.moveToFirst() && c.getString(0) != null) return c.getString(0);
        } catch (Exception ignored) {
            // the name is only a label
        }
        return "";
    }
}
