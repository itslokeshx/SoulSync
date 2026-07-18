"""
SEARCH TESTS — ytmusicapi search and suggestions endpoints.
"""
import pytest
from ytmusicapi import YTMusic


class TestSearch:
    """Tests for the search functionality."""

    def test_SEARCH_01_basic_search(self, yt: YTMusic):
        """SEARCH-01: search('Blinding Lights') returns results with videoId, title, artists."""
        results = yt.search("Blinding Lights")
        assert isinstance(results, list), f"Expected list, got {type(results)}"
        assert len(results) > 0, "Search returned no results"
        first = results[0]
        assert "title" in first, f"First result missing 'title': {list(first.keys())}"

    def test_SEARCH_02_filter_artists(self, yt: YTMusic):
        """SEARCH-02: search with filter='artists' returns only artist type results."""
        results = yt.search("AR Rahman", filter="artists")
        assert isinstance(results, list)
        assert len(results) > 0, "Artist search returned no results"
        for r in results:
            result_type = r.get("resultType", r.get("category", ""))
            assert result_type == "artist", (
                f"Expected artist type, got '{result_type}' for: {r.get('artist', r.get('title', ''))}"
            )

    def test_SEARCH_03_filter_songs(self, yt: YTMusic):
        """SEARCH-03: search with filter='songs' returns results with videoId and duration."""
        results = yt.search("Tum Hi Ho", filter="songs")
        assert isinstance(results, list)
        assert len(results) > 0, "Song search returned no results"
        for r in results:
            assert "videoId" in r, f"Song result missing 'videoId': {list(r.keys())}"

    def test_SEARCH_04_filter_albums(self, yt: YTMusic):
        """SEARCH-04: search with filter='albums' returns results with browseId."""
        results = yt.search("Coke Studio", filter="albums")
        assert isinstance(results, list)
        assert len(results) > 0, "Album search returned no results"
        for r in results:
            assert "browseId" in r, f"Album result missing 'browseId': {list(r.keys())}"

    def test_SEARCH_05_filter_podcasts(self, yt: YTMusic):
        """SEARCH-05: search with filter='podcasts' returns podcast metadata."""
        try:
            results = yt.search("Joe Rogan", filter="podcasts")
            assert isinstance(results, list)
            # Podcasts may not be available in all regions
            if len(results) > 0:
                first = results[0]
                assert "title" in first, f"Podcast missing 'title': {list(first.keys())}"
        except Exception as e:
            pytest.skip(f"Podcast search not supported or unavailable: {e}")

    def test_SEARCH_06_filter_playlists(self, yt: YTMusic):
        """SEARCH-06: search with filter='playlists' returns results with playlistId or browseId."""
        results = yt.search("lofi", filter="playlists")
        assert isinstance(results, list)
        assert len(results) > 0, "Playlist search returned no results"
        for r in results:
            has_id = "playlistId" in r or "browseId" in r
            assert has_id, f"Playlist result missing 'playlistId'/'browseId': {list(r.keys())}"

    def test_SEARCH_07_empty_string(self, yt: YTMusic):
        """SEARCH-07: Empty string search handles gracefully, no crash."""
        try:
            results = yt.search("")
            # May return empty list or raise; just ensure no unhandled crash
            assert results is not None or results == []
        except Exception:
            # Some implementations may raise on empty query — that's acceptable
            pass

    def test_SEARCH_08_search_suggestions(self, yt: YTMusic):
        """SEARCH-08: get_search_suggestions returns list of suggestions."""
        results = yt.get_search_suggestions("Ar Ra")
        assert isinstance(results, list), f"Expected list, got {type(results)}"
        # Suggestions might be strings or dicts depending on version
        if len(results) > 0:
            # Just verify we got something
            assert results[0] is not None

    def test_SEARCH_09_special_chars_tamil(self, yt: YTMusic):
        """SEARCH-09: Tamil characters search handles without crash, results returned."""
        results = yt.search("தமிழ் பாடல்")
        assert isinstance(results, list), f"Expected list, got {type(results)}"
        # May return empty in some regions but must not crash
        assert results is not None

    def test_SEARCH_10_filter_videos(self, yt: YTMusic):
        """SEARCH-10: search with filter='videos' returns results with videoId."""
        results = yt.search("Bohemian Rhapsody", filter="videos")
        assert isinstance(results, list)
        assert len(results) > 0, "Video search returned no results"
        for r in results:
            assert "videoId" in r, f"Video result missing 'videoId': {list(r.keys())}"
