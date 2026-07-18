"""
UPLOAD TESTS — destructive, skipped by default. Run manually.
"""
import pytest

@pytest.mark.skip(reason="destructive upload test — run manually")
class TestUploads:
    def test_upload_song(self):
        """yt.upload_song(filepath) — would use a 30s silent MP3."""
        pass

    def test_get_uploaded_songs(self):
        """yt.get_library_upload_songs() — verify uploaded song appears."""
        pass

    def test_delete_upload(self):
        """yt.delete_upload_entity(entityId) — cleanup."""
        pass
