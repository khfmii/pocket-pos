package com.pocketpos.app;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothClass;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.IOException;
import java.io.OutputStream;
import java.util.Set;
import java.util.UUID;

/**
 * Prints raw ESC/POS bytes on a paired Bluetooth (classic SPP) thermal printer.
 *
 * The printer is paired in Android's own Bluetooth settings; this plugin only lists already-paired devices (no
 * scanning, so no location or BLUETOOTH_SCAN permission) and, on Android 12+, asks for the BLUETOOTH_CONNECT
 * permission the first time. Errors are rejected with short codes the web side translates:
 * "permission-denied", "bluetooth-unavailable", "bluetooth-off", "device-not-found", "connect-failed", "write-failed".
 */
@CapacitorPlugin(
    name = "BluetoothPrinter",
    permissions = { @Permission(strings = { Manifest.permission.BLUETOOTH_CONNECT }, alias = "bluetooth") }
)
public class BluetoothPrinterPlugin extends Plugin {

    private static final UUID SPP = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private boolean needsPermission() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && getPermissionState("bluetooth") != PermissionState.GRANTED;
    }

    @PluginMethod
    public void listPaired(PluginCall call) {
        if (needsPermission()) {
            requestPermissionForAlias("bluetooth", call, "permissionResult");
            return;
        }
        doList(call);
    }

    @PluginMethod
    public void print(PluginCall call) {
        if (needsPermission()) {
            requestPermissionForAlias("bluetooth", call, "permissionResult");
            return;
        }
        doPrint(call);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    @PermissionCallback
    private void permissionResult(PluginCall call) {
        if (call == null) return;
        if (getPermissionState("bluetooth") != PermissionState.GRANTED) {
            call.reject("permission-denied");
            return;
        }
        if ("print".equals(call.getMethodName())) doPrint(call);
        else doList(call);
    }

    /** Null (with the call rejected) when Bluetooth can't be used right now. */
    private BluetoothAdapter adapterOrReject(PluginCall call) {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) {
            call.reject("bluetooth-unavailable");
            return null;
        }
        if (!adapter.isEnabled()) {
            call.reject("bluetooth-off");
            return null;
        }
        return adapter;
    }

    private void doList(PluginCall call) {
        BluetoothAdapter adapter = adapterOrReject(call);
        if (adapter == null) return;
        try {
            JSArray devices = new JSArray();
            Set<BluetoothDevice> bonded = adapter.getBondedDevices();
            for (BluetoothDevice d : bonded) {
                JSObject o = new JSObject();
                String name = d.getName();
                BluetoothClass cls = d.getBluetoothClass();
                o.put("name", name == null ? d.getAddress() : name);
                o.put("address", d.getAddress());
                o.put("isPrinter", cls != null && cls.getMajorDeviceClass() == BluetoothClass.Device.Major.IMAGING);
                devices.put(o);
            }
            JSObject out = new JSObject();
            out.put("devices", devices);
            call.resolve(out);
        } catch (SecurityException e) {
            call.reject("permission-denied");
        }
    }

    private void doPrint(PluginCall call) {
        String address = call.getString("address");
        String data = call.getString("data");
        if (address == null || data == null) {
            call.reject("write-failed");
            return;
        }
        BluetoothAdapter adapter = adapterOrReject(call);
        if (adapter == null) return;
        BluetoothSocket socket = null;
        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            BluetoothDevice device;
            try {
                device = adapter.getRemoteDevice(address);
            } catch (IllegalArgumentException e) {
                call.reject("device-not-found");
                return;
            }
            socket = connect(device);
            if (socket == null) {
                call.reject("connect-failed");
                return;
            }
            OutputStream os = socket.getOutputStream();
            // Small chunks: a printer's receive buffer is tiny and the link applies back-pressure through write().
            for (int off = 0; off < bytes.length; off += 512) {
                os.write(bytes, off, Math.min(512, bytes.length - off));
            }
            os.flush();
            // Closing too early can cut off what the printer has not drawn yet.
            Thread.sleep(Math.min(4000, 800 + bytes.length / 40));
            JSObject out = new JSObject();
            out.put("bytes", bytes.length);
            call.resolve(out);
        } catch (SecurityException e) {
            call.reject("permission-denied");
        } catch (IOException e) {
            call.reject("write-failed");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            call.reject("write-failed");
        } finally {
            if (socket != null) {
                try {
                    socket.close();
                } catch (IOException ignored) {
                    // already closed
                }
            }
        }
    }

    /** Printers are fussy: try the normal secure socket, then an insecure one, then the old port-1 workaround. */
    private BluetoothSocket connect(BluetoothDevice device) throws SecurityException {
        for (int strategy = 0; strategy < 3; strategy++) {
            BluetoothSocket s = null;
            try {
                if (strategy == 0) s = device.createRfcommSocketToServiceRecord(SPP);
                else if (strategy == 1) s = device.createInsecureRfcommSocketToServiceRecord(SPP);
                else s = (BluetoothSocket) device.getClass().getMethod("createRfcommSocket", int.class).invoke(device, 1);
                s.connect();
                return s;
            } catch (SecurityException e) {
                throw e;
            } catch (Exception e) {
                if (s != null) {
                    try {
                        s.close();
                    } catch (IOException ignored) {
                        // try the next way
                    }
                }
            }
        }
        return null;
    }
}
