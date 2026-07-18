"""
ARTIST TESTS — ytmusicapi artist endpoints.
"""
import pytest
from ytmusicapi import YTMusic

# AR Rahman's browseId (found via search)
AR_RAHMAN_BROWSE_ID = "UCtJe0RYzgPddQXKtWduxz_w"

class TestArtists:
    def test_ARTIST_01_get_artist(self, yt: YTMusic):
        result = yt.get_artist(AR_RAHMAN_BROWSE_ID)
        assert result is not None
        assert "name" in result
        has_content = any(k in result for k in ("albums", "singles", "songs", "description"))
        assert has_content

    def test_ARTIST_02_artist_albums(self, yt: YTMusic):
        artist = yt.get_artist(AR_RAHMAN_BROWSE_ID)
        albums_data = artist.get("albums")
        if not albums_data:
            pytest.skip("No albums section")
        params = albums_data.get("params")
        browse_id = albums_data.get("browseId")
        if params and browse_id:
            result = yt.get_artist_albums(browse_id, params)
            assert isinstance(result, list) and len(result) > 0
        else:
            results = albums_data.get("results", [])
            assert isinstance(results, list)

    def test_ARTIST_03_related_artists(self, yt: YTMusic):
        artist = yt.get_artist(AR_RAHMAN_BROWSE_ID)
        related = artist.get("related")
        if not related:
            pytest.skip("No related section")
        results = related.get("results", [])
        assert isinstance(results, list) and len(results) > 0

    def test_ARTIST_04_subscriber_count(self, yt: YTMusic):
        artist = yt.get_artist(AR_RAHMAN_BROWSE_ID)
        _ = artist.get("subscribers")  # May be None, just must not crash
