package com.soulsync.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.IBinder;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MediaPlaybackService extends Service {
    private static final String TAG = "MediaPlayback";
    private static final String CHANNEL_ID = "soulsync_media_playback";
    private static final int NOTIFICATION_ID = 2001;

    public static final String ACTION_UPDATE = "com.soulsync.app.ACTION_UPDATE";
    public static final String ACTION_PLAY = "com.soulsync.app.ACTION_PLAY";
    public static final String ACTION_PAUSE = "com.soulsync.app.ACTION_PAUSE";
    public static final String ACTION_NEXT = "com.soulsync.app.ACTION_NEXT";
    public static final String ACTION_PREV = "com.soulsync.app.ACTION_PREV";
    public static final String ACTION_STOP = "com.soulsync.app.ACTION_STOP";

    private MediaSessionCompat mediaSession;
    private NotificationManager notificationManager;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    private String currentTitle = "";
    private String currentArtist = "";
    private String currentAlbumArt = "";
    private boolean isPlaying = false;
    private long duration = 0;
    private long position = 0;
    private Bitmap cachedArtwork = null;
    private String cachedArtworkUrl = "";

    // Static callback for sending events back to the Capacitor plugin
    public static MusicControlsCallback callback;

    public interface MusicControlsCallback {
        void onAction(String action);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        mediaSession = new MediaSessionCompat(this, "SoulSyncSession");
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                if (callback != null) callback.onAction("play");
            }

            @Override
            public void onPause() {
                if (callback != null) callback.onAction("pause");
            }

            @Override
            public void onSkipToNext() {
                if (callback != null) callback.onAction("next");
            }

            @Override
            public void onSkipToPrevious() {
                if (callback != null) callback.onAction("prev");
            }

            @Override
            public void onSeekTo(long pos) {
                if (callback != null) callback.onAction("seek:" + pos);
            }

            @Override
            public void onStop() {
                if (callback != null) callback.onAction("stop");
                stopSelf();
            }
        });

        mediaSession.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_STICKY;

        String action = intent.getAction();
        if (action == null) action = ACTION_UPDATE;

        switch (action) {
            case ACTION_PLAY:
                if (callback != null) callback.onAction("play");
                break;
            case ACTION_PAUSE:
                if (callback != null) callback.onAction("pause");
                break;
            case ACTION_NEXT:
                if (callback != null) callback.onAction("next");
                break;
            case ACTION_PREV:
                if (callback != null) callback.onAction("prev");
                break;
            case ACTION_STOP:
                if (callback != null) callback.onAction("stop");
                stopSelf();
                return START_NOT_STICKY;
            case ACTION_UPDATE:
                currentTitle = intent.getStringExtra("title") != null ? intent.getStringExtra("title") : currentTitle;
                currentArtist = intent.getStringExtra("artist") != null ? intent.getStringExtra("artist") : currentArtist;
                currentAlbumArt = intent.getStringExtra("albumArt") != null ? intent.getStringExtra("albumArt") : currentAlbumArt;
                isPlaying = intent.getBooleanExtra("isPlaying", isPlaying);
                duration = intent.getLongExtra("duration", duration);
                position = intent.getLongExtra("position", position);
                break;
        }

        updatePlaybackState();

        // Load artwork async, then update notification
        if (!currentAlbumArt.isEmpty() && !currentAlbumArt.equals(cachedArtworkUrl)) {
            cachedArtworkUrl = currentAlbumArt;
            final String artUrl = currentAlbumArt;
            executor.execute(() -> {
                Bitmap bmp = loadBitmap(artUrl);
                if (bmp != null) {
                    cachedArtwork = bmp;
                }
                updateNotification();
            });
        } else {
            updateNotification();
        }

        return START_STICKY;
    }

    private void updatePlaybackState() {
        long actions = PlaybackStateCompat.ACTION_PLAY
                | PlaybackStateCompat.ACTION_PAUSE
                | PlaybackStateCompat.ACTION_SKIP_TO_NEXT
                | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
                | PlaybackStateCompat.ACTION_SEEK_TO
                | PlaybackStateCompat.ACTION_STOP;

        int state = isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;

        PlaybackStateCompat.Builder builder = new PlaybackStateCompat.Builder()
                .setActions(actions)
                .setState(state, position, isPlaying ? 1.0f : 0.0f);

        mediaSession.setPlaybackState(builder.build());

        MediaMetadataCompat.Builder metaBuilder = new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, duration);

        if (cachedArtwork != null) {
            metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, cachedArtwork);
        }

        mediaSession.setMetadata(metaBuilder.build());
    }

    private void updateNotification() {
        // Open the app when tapping the notification
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
                this, 0, openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Action intents
        PendingIntent prevPI = createActionIntent(ACTION_PREV, 1);
        PendingIntent playPausePI = createActionIntent(isPlaying ? ACTION_PAUSE : ACTION_PLAY, 2);
        PendingIntent nextPI = createActionIntent(ACTION_NEXT, 3);
        PendingIntent stopPI = createActionIntent(ACTION_STOP, 4);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(currentTitle)
                .setContentText(currentArtist)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentIntent(contentIntent)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(isPlaying)
                .setShowWhen(false)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .addAction(R.drawable.ic_skip_previous, "Previous", prevPI)
                .addAction(isPlaying ? R.drawable.ic_pause : R.drawable.ic_play, isPlaying ? "Pause" : "Play", playPausePI)
                .addAction(R.drawable.ic_skip_next, "Next", nextPI)
                .addAction(R.drawable.ic_close, "Stop", stopPI)
                .setStyle(new MediaStyle()
                        .setMediaSession(mediaSession.getSessionToken())
                        .setShowActionsInCompactView(0, 1, 2)  // prev, play/pause, next in compact view
                        .setShowCancelButton(true)
                        .setCancelButtonIntent(stopPI)
                );

        if (cachedArtwork != null) {
            builder.setLargeIcon(cachedArtwork);
        }

        Notification notification = builder.build();

        try {
            startForeground(NOTIFICATION_ID, notification);
        } catch (Exception e) {
            Log.e(TAG, "Failed to start foreground: " + e.getMessage());
        }
    }

    private PendingIntent createActionIntent(String action, int requestCode) {
        Intent intent = new Intent(this, MediaPlaybackService.class);
        intent.setAction(action);
        return PendingIntent.getService(
                this, requestCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private void createNotificationChannel() {
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Music Playback",
                NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Shows the currently playing song with controls");
        channel.setShowBadge(false);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) nm.createNotificationChannel(channel);
    }

    private Bitmap loadBitmap(String urlStr) {
        try {
            URL url = new URL(urlStr);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setDoInput(true);
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);
            conn.connect();
            InputStream input = conn.getInputStream();
            Bitmap bmp = BitmapFactory.decodeStream(input);
            input.close();
            conn.disconnect();
            return bmp;
        } catch (Exception e) {
            Log.w(TAG, "Failed to load album art: " + e.getMessage());
            return null;
        }
    }

    @Override
    public void onDestroy() {
        mediaSession.setActive(false);
        mediaSession.release();
        executor.shutdown();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
