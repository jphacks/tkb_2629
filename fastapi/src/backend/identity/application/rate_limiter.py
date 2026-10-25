from ..domain.policies import AttemptPolicy, AuthenticationAction
from .ports import Clock, UnitOfWorkFactory


class AuthenticationRateLimiter:
    def __init__(self, units: UnitOfWorkFactory, clock: Clock):
        self.units = units
        self.clock = clock

    def check(self, action: AuthenticationAction, client: str, email: str | None = None) -> None:
        now = self.clock.now()
        windows = AttemptPolicy.windows(action, client, email, now)
        with self.units() as unit:
            counts = [unit.attempts.increment(window.key, window.expires) for window in windows]
            unit.attempts.remove_expired(now)
            # Commit independently: unsuccessful authentication must still count.
            unit.commit()
        for window, count in zip(windows, counts, strict=True):
            window.require_admitted(count)
