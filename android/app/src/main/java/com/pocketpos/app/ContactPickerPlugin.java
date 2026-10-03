package com.pocketpos.app;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.ContactsContract;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Lets the user pick ONE contact (name + one phone number) with the phone's own contact picker.
 *
 * No READ_CONTACTS permission is declared or requested: when the user taps a contact in the system picker,
 * Android grants this app temporary read access to just that entry. The app never sees the rest of the
 * address book, which is all a point-of-sale needs.
 */
@CapacitorPlugin(name = "ContactPicker")
public class ContactPickerPlugin extends Plugin {

    @PluginMethod
    public void pick(PluginCall call) {
        // Picking from the Phone table lists each number, so the user chooses the exact number to use.
        Intent intent = new Intent(Intent.ACTION_PICK, ContactsContract.CommonDataKinds.Phone.CONTENT_URI);
        try {
            startActivityForResult(call, intent, "pickResult");
        } catch (Exception e) {
            call.reject("No contacts app is available on this device.");
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
        Uri uri = data.getData();
        String[] columns = {
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Phone.NUMBER
        };
        try (Cursor c = getContext().getContentResolver().query(uri, columns, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                out.put("name", c.getString(0));
                out.put("phone", c.getString(1));
            } else {
                out.put("cancelled", true);
            }
            call.resolve(out);
        } catch (SecurityException e) {
            call.reject("Could not read the selected contact.");
        }
    }
}
