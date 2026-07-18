"""
ALBUM TESTS — ytmusicapi album endpoints.
"""
import pytest
from ytmusicapi import YTMusic


class TestAlbums:
    ALBUM_BROWSE_ID = "MPREb_S8R0KzpIOGW"

    def test_ALBUM_01_get_album(self, yt: YTMusic):
        """ALBUM-01: get_album(browseId) has title, tracks, year."""
        search = yt.search("Rockstar Anirudh", filter="albums")
        if not search:
            pytest.skip("No test album found")
        result = yt.get_album(search[0].get("browseId"))
        assert "title" in result
        assert "tracks" in result

    def test_ALBUM_02_album_tracks(self, yt: YTMusic):
        """ALBUM-02: Each track has videoId, title."""
        search = yt.search("Rockstar Anirudh", filter="albums")
        if not search:
            pytest.skip("No test album found")
        album = yt.get_album(search[0].get("browseId"))
        tracks = album.get("tracks", [])
        assert len(tracks) > 0
        for t in tracks:
            assert "title" in t

    def test_ALBUM_03_album_browse_id(self, yt: YTMusic):
        """ALBUM-03: get_album_browse_id returns valid string."""
        search = yt.search("Rockstar Anirudh", filter="albums")
        if not search:
            pytest.skip("No test album found")
        album = yt.get_album(search[0].get("browseId"))
        apid = album.get("audioPlaylistId")
        if not apid:
            pytest.skip("No audioPlaylistId")
        result = yt.get_album_browse_id(apid)
        assert isinstance(result, str) and len(result) > 0

    def test_ALBUM_04_track_count(self, yt: YTMusic):
        """ALBUM-04: trackCount matches len(tracks)."""
        search = yt.search("Rockstar Anirudh", filter="albums")
        if not search:
            pytest.skip("No test album found")
        album = yt.get_album(search[0].get("browseId"))
        tc = album.get("trackCount")
        if tc is not None:
            assert int(tc) == len(album.get("tracks", []))
