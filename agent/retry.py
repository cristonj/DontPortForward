"""
Retry utilities with exponential backoff for network operations.
"""
import time
from functools import wraps
from typing import Callable, TypeVar, Tuple, Type, Optional
from google.api_core import exceptions as google_exceptions
from requests.exceptions import ConnectionError, Timeout

# Default retry configuration
DEFAULT_MAX_RETRIES = 3
DEFAULT_RETRY_DELAY = 1.0  # seconds

# Default network exceptions to retry on
NETWORK_EXCEPTIONS: Tuple[Type[Exception], ...] = (
    google_exceptions.ServiceUnavailable,
    google_exceptions.DeadlineExceeded,
    ConnectionError,
    Timeout,
)

T = TypeVar('T')


def retry_on_network_error(
    max_retries: int = DEFAULT_MAX_RETRIES,
    retry_delay: float = DEFAULT_RETRY_DELAY,
    exceptions: Tuple[Type[Exception], ...] = NETWORK_EXCEPTIONS,
    operation_name: Optional[str] = None,
    log_prefix: Optional[str] = None,
) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """
    Decorator that retries a function on network errors with exponential backoff.
    
    Args:
        max_retries: Maximum number of retry attempts
        retry_delay: Base delay between retries (multiplied by 2^attempt)
        exceptions: Tuple of exception types to catch and retry
        operation_name: Name of operation for logging (optional)
        log_prefix: Prefix for log messages like "[cmd_id]" (optional)
    """
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
                        wait_time = retry_delay * (2 ** attempt)
                        print(f"{prefix}Network error in {op_name} (attempt {attempt + 1}/{max_retries}), retrying in {wait_time}s...")
                        time.sleep(wait_time)
                    else:
                        print(f"{prefix}Failed {op_name} after {max_retries} attempts: {e}")
                        raise
                except Exception as e:
                    print(f"{prefix}Error in {op_name}: {e}")
                    raise
            
            # Should not reach here, but just in case
            raise RuntimeError(f"Retry loop exited unexpectedly for {op_name}")
        return wrapper
    return decorator


def with_retry(
    func: Callable[..., T],
    max_retries: int = DEFAULT_MAX_RETRIES,
    retry_delay: float = DEFAULT_RETRY_DELAY,
    exceptions: Tuple[Type[Exception], ...] = NETWORK_EXCEPTIONS,
    operation_name: Optional[str] = None,
    log_prefix: Optional[str] = None,
    suppress_final_error: bool = False,
) -> Optional[T]:
    """
    Execute a function with retry logic. Returns None if all retries fail and
    suppress_final_error is True.
    
    Args:
        func: The function to execute
        max_retries: Maximum number of retry attempts
        retry_delay: Base delay between retries (multiplied by 2^attempt)
        exceptions: Tuple of exception types to catch and retry
        operation_name: Name of operation for logging
        log_prefix: Prefix for log messages like "[cmd_id]"
        suppress_final_error: If True, return None instead of raising on final failure
    
    Returns:
        The function result, or None if all retries fail and suppress_final_error is True
    """
    prefix = f"{log_prefix} " if log_prefix else ""
    op_name = operation_name or "operation"
    
    for attempt in range(max_retries):
        try:
            return func()
        except exceptions as e:
            if attempt < max_retries - 1:
                wait_time = retry_delay * (2 ** attempt)
                print(f"{prefix}Network error in {op_name} (attempt {attempt + 1}/{max_retries}), retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                print(f"{prefix}Failed {op_name} after {max_retries} attempts: {e}")
                if suppress_final_error:
                    return None
                raise
        except Exception as e:
            print(f"{prefix}Error in {op_name}: {e}")
            if suppress_final_error:
                return None
            raise
    
    return None
