import uvicorn

from app.config.settings import Settings


def main() -> None:
    settings = Settings()
    uvicorn.run("app.main:app", host=settings.api_host, port=settings.api_port)


if __name__ == "__main__":
    main()
