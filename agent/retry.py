"""
Retry utilities with exponential backoff for network operations.

Tuned for slow / intermittent networks (e.g. T-Mobile hotspot):
 - Broad coverage of transient Google/HTTP/socket errors (504s, 502s, 500s, etc.)
 - Exponential backoff capped at ``max_delay`` so retries don't grow unbounded
 - Retries are *interruptible* via an optional ``should_stop`` callable
"""
import time
import random
import socket
from functools import wraps
from typing import Callable, TypeVar, Tuple, Type, Optional
from google.api_core import exceptions as google_exceptions
from requests.exceptions import (
    ConnectionError as RequestsConnectionError,
    Timeout,
    ChunkedEncodingError,
    ReadTimeout,
)

try:
    from google.auth.exceptions import TransportError as GoogleAuthTransportError
except Exception:  # pragma: no cover - older google-auth
    class GoogleAuthTransportError(Exception):
        pass

# Default retry configuration — tuned for slow / intermittent networks.
# Total budget at defaults: ~30-60s for the full sequence, capped per attempt.
DEFAULT_MAX_RETRIES = 6
DEFAULT_RETRY_DELAY = 1.0   # seconds (base, subject to exponential backoff + jitter)
DEFAULT_MAX_DELAY = 30.0    # cap exponential backoff at 30s per attempt

# "Long" profile for critical writes we really don't want to drop (registration,
# final command status). Total budget ~3-5 min.
LONG_MAX_RETRIES = 10
LONG_MAX_DELAY = 60.0

# Transient errors worth retrying. Anything not in this list is treated as a
# genuine application error and propagated immediately.
NETWORK_EXCEPTIONS: Tuple[Type[Exception], ...] = (
    # Google API errors (HTTP 5xx-equivalents and transient gRPC failures)
    google_exceptions.ServiceUnavailable,     # 503
    google_exceptions.DeadlineExceeded,       # gRPC deadline
    google_exceptions.GatewayTimeout,         # 504  <-- key for slow hotspots
    google_exceptions.InternalServerError,    # 500
    google_exceptions.BadGateway,             # 502
    google_exceptions.TooManyRequests,        # 429
    google_exceptions.ResourceExhausted,      # quota / rate limit
    google_exceptions.Aborted,                # transient gRPC abort
    google_exceptions.Cancelled,              # gRPC cancellation (often a dropped connection)
    google_exceptions.Unknown,                # gRPC UNKNOWN, frequently transient
    # google-auth transport-level failures
    GoogleAuthTransportError,
    # requests/urllib3 transport-level failures
    RequestsConnectionError,
    Timeout,
    ReadTimeout,
    ChunkedEncodingError,
    # Raw socket-level failures (ECONNRESET, ETIMEDOUT, EHOSTUNREACH, ...)
    socket.timeout,
    OSError,
)

T = TypeVar('T')


def _compute_backoff(attempt: int, base_delay: float, max_delay: float) -> float:
    """Exponential backoff with jitter, capped at ``max_delay``."""
    delay = min(base_delay * (2 ** attempt), max_delay)
    # "Full jitter" style: randomize between 50%-100% of the computed delay.
    return delay * (0.5 + random.random() * 0.5)


def _interruptible_sleep(duration: float, should_stop: Optional[Callable[[], bool]]) -> bool:
    """Sleep for ``duration`` seconds, returning early if ``should_stop()`` becomes True.

    Returns True if it slept the full duration, False if interrupted.
    """
    if duration <= 0:
        return True
    if not should_stop:
        time.sleep(duration)
        return True
    elapsed = 0.0
    step = 0.5
    while elapsed < duration:
        if should_stop():
            return False
        chunk = min(step, duration - elapsed)
        time.sleep(chunk)
        elapsed += chunk
    return True


def retry_on_network_error(
    max_retries: int = DEFAULT_MAX_RETRIES,
    retry_delay: float = DEFAULT_RETRY_DELAY,
    max_delay: float = DEFAULT_MAX_DELAY,
    exceptions: Tuple[Type[Exception], ...] = NETWORK_EXCEPTIONS,
    operation_name: Optional[str] = None,
    log_prefix: Optional[str] = None,
) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """Decorator that retries a function on network errors with exponential backoff."""
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args, **kwargs) -> T:
            prefix = f"{log_prefix} " if log_prefix else ""
            op_name = operation_name or func.__name__

            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    if attempt < max_retries - 1:
                        wait_time = _compute_backoff(attempt, retry_delay, max_delay)
                        print(
                            f"{prefix}Network error in {op_name} "
                            f"({type(e).__name__}, attempt {attempt + 1}/{max_retries}); "
                            f"retrying in {wait_time:.1f}s..."
                        )
                        time.sleep(wait_time)
                    else:
                        print(f"{prefix}Failed {op_name} after {max_retries} attempts: {type(e).__name__}: {e}")
                        raise
                except Exception as e:
                    print(f"{prefix}Error in {op_name}: {type(e).__name__}: {e}")
                    raise

            raise RuntimeError(f"Retry loop exited unexpectedly for {op_name}")
        return wrapper
    return decorator


def with_retry(
    func: Callable[..., T],
    max_retries: int = DEFAULT_MAX_RETRIES,
    retry_delay: float = DEFAULT_RETRY_DELAY,
    max_delay: float = DEFAULT_MAX_DELAY,
    exceptions: Tuple[Type[Exception], ...] = NETWORK_EXCEPTIONS,
    operation_name: Optional[str] = None,
    log_prefix: Optional[str] = None,
    suppress_final_error: bool = False,
    should_stop: Optional[Callable[[], bool]] = None,
) -> Optional[T]:
    """Execute ``func`` with retry logic.

    Args:
        max_retries: total attempts (including the first one).
        retry_delay: base delay for exponential backoff.
        max_delay: cap on the per-attempt sleep.
        exceptions: which exceptions trigger a retry. Anything else propagates.
        operation_name / log_prefix: cosmetic, used in log lines.
        suppress_final_error: if True, swallow the final exception and return None.
        should_stop: callable returning True to abort retries early (e.g. shutdown).

    Returns:
        The function's result, or None if all retries failed and ``suppress_final_error``
        is True, or None if ``should_stop`` aborted before completion.
    """
    prefix = f"{log_prefix} " if log_prefix else ""
    op_name = operation_name or "operation"

    for attempt in range(max_retries):
        if should_stop and should_stop():
            return None
        try:
            return func()
        except exceptions as e:
            if attempt < max_retries - 1:
                wait_time = _compute_backoff(attempt, retry_delay, max_delay)
                print(
                    f"{prefix}Network error in {op_name} "
                    f"({type(e).__name__}, attempt {attempt + 1}/{max_retries}); "
                    f"retrying in {wait_time:.1f}s..."
                )
                if not _interruptible_sleep(wait_time, should_stop):
                    return None
            else:
                print(f"{prefix}Failed {op_name} after {max_retries} attempts: {type(e).__name__}: {e}")
                if suppress_final_error:
                    return None
                raise
        except Exception as e:
            print(f"{prefix}Error in {op_name}: {type(e).__name__}: {e}")
            if suppress_final_error:
                return None
            raise

    return None
