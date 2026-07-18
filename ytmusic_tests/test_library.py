"""
LIBRARY TESTS — auth-required library endpoints. All skip if oauth.json missing.
"""
import pytest
from ytmusicapi import YTMusic

class TestLibrary:
    def test_LIB_01_library_playlists(self, require_auth):
        result = require_auth.get_library_playlists()
        assert isinstance(result, list)

    def test_LIB_02_library_songs(self, require_auth):
        result = require_auth.get_library_songs()
        assert isinstance(result, list)

    def test_LIB_03_library_albums(self, require_auth):
        result = require_auth.get_library_albums()
        assert isinstance(result, list)

    def test_LIB_04_library_artists(self, require_auth):
        result = require_auth.get_library_artists()
        assert isinstance(result, list)

    def test_LIB_05_history(self, require_auth):
        result = require_auth.get_history()
        assert isinstance(result, list)

    def test_LIB_06_liked_songs(self, require_auth):
        result = require_auth.get_liked_songs()
        assert result is not None
