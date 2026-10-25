from datetime import UTC, datetime


class UtcClock:
    def now(self) -> datetime:
        return datetime.now(UTC)
