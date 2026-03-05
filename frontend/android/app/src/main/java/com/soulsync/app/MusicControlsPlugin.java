package com.soulsync.app;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "MusicControls")
public class MusicControlsPlugin extends Plugin {
    private static final String TAG = "MusicControls";
    private boolean serviceRunning = false;

    @Override
    public void load() {
        // Register callback to receive media button events from the service
        MediaPlaybackService.callback = action -> {
            JSObject data = new JSObject();

            if (action.startsWith("seek:")) {
                data.put("action", "seek");
                try {
                    data.put("seekTime", Long.parseLong(action.substring(5)) / 1000.0);
                } catch (NumberFormatException e) {
                    data.put("seekTime", 0);
                }
            } else {
                data.put("action", action);
            }

            notifyListeners("controlsAction", data, true);
        };
    }

    @PluginMethod
    public void updateNotification(PluginCall call) {
        String title = call.getString("title", "");
        String artist = call.getString("artist", "");
        String albumArt = call.getString("albumArt", "");
        boolean isPlaying = call.getBoolean("isPlaying", false);
        long duration = (long) (call.getDouble("duration", 0.0) * 1000); // seconds → ms
        long position = (long) (call.getDouble("position", 0.0) * 1000); // seconds → ms

        Context context = getContext();
        Intent intent = new Intent(context, MediaPlaybackService.class);
        intent.setAction(MediaPlaybackService.ACTION_UPDATE);
        intent.putExtra("title", title);
        intent.putExtra("artist", artist);
        intent.putExtra("albumArt", albumArt);
        intent.putExtra("isPlaying", isPlaying);
        intent.putExtra("duration", duration);
        intent.putExtra("position", position);

        try {
            if (!serviceRunning) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent);
                } else {
                    context.startService(intent);
                }
                serviceRunning = true;
            } else {
                context.startService(intent);
            }
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "Failed to start service: " + e.getMessage());
            call.reject("Failed to update notification: " + e.getMessage());
        }
    }

    @PluginMethod
    public void dismissNotification(PluginCall call) {
        Context context = getContext();
        Intent intent = new Intent(context, MediaPlaybackService.class);
        intent.setAction(MediaPlaybackService.ACTION_STOP);
        try {
            context.startService(intent);
        } catch (Exception e) {
            // Service may not be running
        }
        serviceRunning = false;
        call.resolve();
    }
}
