from app.config.settings import Settings

_ENV_NAMES = (
    "API_HOST",
    "API_PORT",
    "UPLOAD_LIMIT_BYTES",
    "DATASET_TTL_MINUTES",
)


def test_defaults_when_env_vars_absent(monkeypatch, tmp_path) -> None:
    for name in _ENV_NAMES:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.chdir(tmp_path)

    settings = Settings()

    assert settings.api_host == "0.0.0.0"
    assert settings.api_port == 8000
    assert settings.upload_limit_bytes == 104857600
    assert settings.dataset_ttl_minutes == 60
