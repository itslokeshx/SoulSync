"""
WATCH / RECOMMENDATION QUEUE TESTS
"""
import pytest
from ytmusicapi import YTMusic

class TestWatch:
    def test_WATCH_01_watch_playlist(self, yt: YTMusic, known_video_id: str):
        result = yt.get_watch_playlist(known_video_id)
        assert "tracks" in result
        assert len(result["tracks"]) >= 5

    def test_WATCH_02_radio_mode(self, yt: YTMusic, known_video_id: str):
        result = yt.get_watch_playlist(known_video_id, radio=True)
        assert "tracks" in result
        assert len(result["tracks"]) > 0

    def test_WATCH_03_shuffle_mode(self, yt: YTMusic):
        search = yt.search("lofi", filter="playlists")
        if not search:
            pytest.skip("No playlist found")
        pid = search[0].get("playlistId") or search[0].get("browseId", "").replace("VL", "")
        if not pid:
            pytest.skip("No playlistId")
        result = yt.get_watch_playlist(playlistId=pid, shuffle=True)
        assert "tracks" in result

    def test_WATCH_04_next_track(self, yt: YTMusic, known_video_id: str):
        result = yt.get_watch_playlist(known_video_id)
        tracks = result.get("tracks", [])
        assert len(tracks) >= 2
        assert "videoId" in tracks[1]

    def test_WATCH_05_autoplay_queue(self, yt: YTMusic, known_video_id: str):
        result = yt.get_watch_playlist(known_video_id)
        for t in result.get("tracks", []):
            assert "videoId" in t
            assert "title" in t
