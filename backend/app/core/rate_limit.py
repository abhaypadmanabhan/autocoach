import time
from collections import deque
from dataclasses import dataclass, field

from fastapi import HTTPException


@dataclass
class InMemoryRateLimiter:
    window_seconds: int
    requests_per_window: int
    buckets: dict[str, deque] = field(default_factory=dict)

    def check(
        self,
        key: str,
        requests_per_window: int | None = None,
        window_seconds: int | None = None,
    ) -> None:
        limit = (
            requests_per_window
            if requests_per_window is not None
            else self.requests_per_window
        )
        window = window_seconds if window_seconds is not None else self.window_seconds
        now = time.time()

        bucket = self.buckets.setdefault(key, deque())

        cutoff = now - window
        while bucket and bucket[0] < cutoff:
            bucket.popleft()

        if len(bucket) >= limit:
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded. Please slow down and try again.",
            )

        bucket.append(now)


rate_limiter = InMemoryRateLimiter(window_seconds=60, requests_per_window=60)
