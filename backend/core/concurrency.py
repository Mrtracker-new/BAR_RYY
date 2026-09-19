"""Concurrency controls for BAR Web API.

Provides a semaphore that caps the number of concurrent file decrypt / encrypt
operations, preventing OOM kills under modest concurrency.
"""
import asyncio
import os
from typing import Iterator

# ---------------------------------------------------------------------------
# Decrypt / download / encrypt concurrency cap
# ---------------------------------------------------------------------------
# Each decrypt holds ~2× file_size in RAM (encrypted + decrypted buffers).
# Each encrypt holds ~2× file_size (plaintext + encrypted bar_data).
# With max_file_size = 50 MB, 10 concurrent operations ≈ 1 GB peak memory.
#
# Configurable via the MAX_CONCURRENT_DECRYPTS environment variable.
MAX_CONCURRENT_DECRYPTS: int = int(os.getenv("MAX_CONCURRENT_DECRYPTS", "10"))

decrypt_semaphore: asyncio.Semaphore = asyncio.Semaphore(MAX_CONCURRENT_DECRYPTS)


def iter_bytes(data: bytes, chunk_size: int = 256 * 1024) -> Iterator[bytes]:
    """Yield *data* in fixed-size chunks for ``StreamingResponse``.

    This enables backpressure: the ASGI server sends each chunk only when
    the client is ready, instead of buffering the entire response body.
    Combined with the concurrency semaphore, this bounds peak memory under
    load.
    """
    for offset in range(0, len(data), chunk_size):
        yield data[offset : offset + chunk_size]


# ---------------------------------------------------------------------------
# Background task tracking (Python asyncio GC protection)
# ---------------------------------------------------------------------------
_background_tasks: set[asyncio.Task] = set()


def track_background_task(task: asyncio.Task) -> asyncio.Task:
    """
    Retain a strong reference to a background task so it is not prematurely
    garbage collected by Python's event loop.

    Uses task.add_done_callback(_background_tasks.discard) to safely remove
    the reference upon task completion.
    """
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)
    return task

