"""
PLAYLIST TESTS
"""
import pytest
from ytmusicapi import YTMusic

class TestPlaylists:
    def test_PLAYLIST_01_get_playlist(self, yt: YTMusic):
        search = yt.search("bollywood hits 2024", filter="playlists")
        if not search:
            pytest.skip("No playlists found via search")
        # Find a playlist with a VL-prefixed browseId (standard format)
        pid = None
        for item in search:
            bid = item.get("browseId", "")
            if bid.startswith("VL"):
                pid = bid
                break
        if not pid:
            # Fall back to first result's browseId
            pid = search[0].get("browseId", "")
        if not pid:
            pytest.skip("No valid playlistId found")
        result = yt.get_playlist(pid)
        assert "title" in result

    def test_PLAYLIST_02_public_playlist_tracks(self, yt: YTMusic):
        search = yt.search("bollywood hits", filter="playlists")
        if not search:
            pytest.skip("No playlists found")
        pid = search[0].get("browseId", "")
        result = yt.get_playlist(pid)
        tracks = result.get("tracks", [])
        assert len(tracks) > 0
        assert "videoId" in tracks[0]

    def test_PLAYLIST_03_suggestions(self, require_auth):
        pytest.skip("Requires valid user library playlistId")

    def test_PLAYLIST_04_05_06_create_add_delete(self, require_auth):
        yt_auth = require_auth
        pid = yt_auth.create_playlist("SoulSync Test", "Test playlist")
        assert isinstance(pid, str)
        try:
            yt_auth.add_playlist_items(pid, ["ZbZSe6N_BXs"])
        finally:
            yt_auth.delete_playlist(pid)
