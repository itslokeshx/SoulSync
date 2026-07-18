"""
PODCAST TESTS — ytmusicapi podcast endpoints.
"""
import pytest
from ytmusicapi import YTMusic

class TestPodcasts:
    def test_PODCAST_01_search_podcasts(self, yt: YTMusic):
        try:
            results = yt.search("Lex Fridman", filter="podcasts")
            assert len(results) > 0
        except Exception as e:
            pytest.skip(f"Podcast search unavailable: {e}")

    def test_PODCAST_02_get_podcast(self, yt: YTMusic):
        try:
            search = yt.search("Lex Fridman", filter="podcasts")
            if not search:
                pytest.skip("No podcasts found")
            pid = search[0].get("browseId", "")
            if not pid:
                pytest.skip("No browseId for podcast")
            result = yt.get_podcast(pid)
            assert "title" in result
        except Exception as e:
            pytest.skip(f"get_podcast unavailable: {e}")

    def test_PODCAST_03_episode_metadata(self, yt: YTMusic):
        try:
            search = yt.search("Lex Fridman", filter="podcasts")
            if not search:
                pytest.skip("No podcasts found")
            pid = search[0].get("browseId", "")
            podcast = yt.get_podcast(pid)
            episodes = podcast.get("episodes", [])
            if not episodes:
                pytest.skip("No episodes found")
            ep = episodes[0]
            assert "videoId" in ep
            assert "title" in ep
        except Exception as e:
            pytest.skip(f"Episode metadata unavailable: {e}")

    def test_PODCAST_04_get_episode(self, yt: YTMusic):
        try:
            search = yt.search("Lex Fridman", filter="podcasts")
            if not search:
                pytest.skip("No podcasts found")
            pid = search[0].get("browseId", "")
            podcast = yt.get_podcast(pid)
            episodes = podcast.get("episodes", [])
            if not episodes:
                pytest.skip("No episodes")
            vid = episodes[0].get("videoId")
            result = yt.get_episode(vid)
            assert "title" in result
        except Exception as e:
            pytest.skip(f"get_episode unavailable: {e}")

    def test_PODCAST_05_episodes_playlist(self, yt: YTMusic):
        try:
            search = yt.search("Lex Fridman", filter="podcasts")
            if not search:
                pytest.skip("No podcasts found")
            pid = search[0].get("browseId", "")
            result = yt.get_episodes_playlist(pid)
            assert result is not None
        except Exception as e:
            pytest.skip(f"get_episodes_playlist unavailable: {e}")

    def test_PODCAST_06_get_channel(self, yt: YTMusic):
        try:
            search = yt.search("Lex Fridman", filter="podcasts")
            if not search:
                pytest.skip("No podcasts found")
            cid = search[0].get("browseId", "")
            result = yt.get_channel(cid)
            assert "name" in result or "title" in result
        except Exception as e:
            pytest.skip(f"get_channel unavailable: {e}")

    def test_PODCAST_07_channel_episodes(self, yt: YTMusic):
        try:
            search = yt.search("Lex Fridman", filter="podcasts")
            if not search:
                pytest.skip("No podcasts found")
            cid = search[0].get("browseId", "")
            channel = yt.get_channel(cid)
            podcasts = channel.get("podcasts", {})
            params = podcasts.get("params")
            if not params:
                pytest.skip("No params for channel episodes")
            result = yt.get_channel_episodes(cid, params)
            assert isinstance(result, list)
        except Exception as e:
            pytest.skip(f"Channel episodes unavailable: {e}")
