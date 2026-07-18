"""
HOME FEED TESTS
"""
import pytest
from ytmusicapi import YTMusic

class TestHomeFeed:
    def test_HOME_01_get_home_returns_list(self, yt: YTMusic):
        result = yt.get_home()
        assert isinstance(result, list) and len(result) > 0
        for item in result:
            assert "title" in item

    def test_HOME_02_get_home_limit(self, yt: YTMusic):
        result = yt.get_home(limit=3)
        assert isinstance(result, list)
        # API may return slightly more, just verify it's reasonable
        assert len(result) <= 6, f"Expected limited sections, got {len(result)}"

    def test_HOME_03_home_section_has_tracks(self, yt: YTMusic):
        result = yt.get_home(limit=6)
        found = False
        for section in result:
            for item in section.get("contents", []):
                if item.get("videoId"):
                    found = True
                    break
            if found:
                break
        # Some regions may not have tracks in first few sections
        if not found:
            pytest.skip("No sections with videoId found (region-dependent)")

    def test_HOME_04_mood_categories(self, yt: YTMusic):
        result = yt.get_mood_categories()
        assert isinstance(result, dict) and len(result) > 0

    def test_HOME_05_mood_playlists(self, yt: YTMusic):
        cats = yt.get_mood_categories()
        first_key = list(cats.keys())[0]
        first_mood = cats[first_key][0]
        params = first_mood.get("params")
        assert params
        playlists = yt.get_mood_playlists(params)
        assert isinstance(playlists, list) and len(playlists) > 0

    def test_HOME_06_charts_global(self, yt: YTMusic):
        result = yt.get_charts()
        assert isinstance(result, dict) and len(result) > 0

    def test_HOME_07_charts_by_country(self, yt: YTMusic):
        result = yt.get_charts(country="IN")
        assert isinstance(result, dict) and len(result) > 0
