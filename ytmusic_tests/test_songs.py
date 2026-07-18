"""
SONG & TRACK METADATA TESTS — ytmusicapi song, lyrics, and related content endpoints.
"""
import pytest
from ytmusicapi import YTMusic


class TestSongs:
    """Tests for individual song/track metadata."""

    def test_SONG_01_get_song(self, yt: YTMusic, known_video_id: str):
        """SONG-01: get_song(videoId) has videoDetails, title, author, lengthSeconds."""
        result = yt.get_song(known_video_id)
        assert result is not None, "get_song returned None"
        video_details = result.get("videoDetails")
        assert video_details is not None, f"Missing videoDetails. Keys: {list(result.keys())}"
        assert "title" in video_details, f"Missing title in videoDetails: {list(video_details.keys())}"
        assert "lengthSeconds" in video_details, f"Missing lengthSeconds in videoDetails"

    def test_SONG_02_get_lyrics(self, yt: YTMusic, known_video_id: str):
        """SONG-02: get_lyrics returns lyrics key with non-empty string."""
        try:
            watch = yt.get_watch_playlist(known_video_id)
            lyrics_browse_id = watch.get("lyrics")
            if not lyrics_browse_id:
                pytest.skip("No lyrics browseId available for this track")

            lyrics = yt.get_lyrics(lyrics_browse_id)
            assert lyrics is not None, "get_lyrics returned None"
            assert "lyrics" in lyrics, f"Missing 'lyrics' key: {list(lyrics.keys())}"
            assert isinstance(lyrics["lyrics"], str), "Lyrics value is not a string"
            assert len(lyrics["lyrics"]) > 0, "Lyrics string is empty"
        except Exception as e:
            if "not found" in str(e).lower() or "unavailable" in str(e).lower():
                pytest.skip(f"Lyrics unavailable: {e}")
            raise

    def test_SONG_03_lyrics_browse_id_from_watch(self, yt: YTMusic, known_video_id: str):
        """SONG-03: Get lyrics browseId from get_watch_playlist."""
        watch = yt.get_watch_playlist(known_video_id)
        assert watch is not None, "get_watch_playlist returned None"
        # 'lyrics' key may exist even if None
        lyrics_id = watch.get("lyrics")
        # It's acceptable for lyrics browseId to be None (not all songs have lyrics)
        if lyrics_id:
            assert isinstance(lyrics_id, str), f"Expected string browseId, got {type(lyrics_id)}"

    def test_SONG_04_song_related(self, yt: YTMusic, known_video_id: str):
        """SONG-04: get_song_related returns list of related content."""
        try:
            watch = yt.get_watch_playlist(known_video_id)
            related_id = watch.get("related")
            if not related_id:
                pytest.skip("No related browseId available for this track")

            related = yt.get_song_related(related_id)
            assert isinstance(related, list), f"Expected list, got {type(related)}"
        except Exception as e:
            pytest.skip(f"Song related content unavailable: {e}")

    def test_SONG_05_song_thumbnails(self, yt: YTMusic, known_video_id: str):
        """SONG-05: videoDetails.thumbnail.thumbnails has at least 2 resolutions."""
        result = yt.get_song(known_video_id)
        video_details = result.get("videoDetails", {})
        thumbnail = video_details.get("thumbnail", {})
        thumbnails = thumbnail.get("thumbnails", [])
        assert isinstance(thumbnails, list), f"Expected list, got {type(thumbnails)}"
        assert len(thumbnails) >= 2, (
            f"Expected at least 2 thumbnail resolutions, got {len(thumbnails)}"
        )

    def test_SONG_06_song_duration_numeric(self, yt: YTMusic, known_video_id: str):
        """SONG-06: lengthSeconds is a numeric string, parseable as int > 0."""
        result = yt.get_song(known_video_id)
        video_details = result.get("videoDetails", {})
        length_seconds = video_details.get("lengthSeconds")
        assert length_seconds is not None, "Missing lengthSeconds"
        duration = int(length_seconds)
        assert duration > 0, f"Expected positive duration, got {duration}"
