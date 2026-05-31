from psycopg_pool import ConnectionPool
from src.config import DATABASE_URL

_pool: ConnectionPool | None = None


def _get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool(DATABASE_URL, min_size=2, max_size=10)
    return _pool


def get_connection():
    """Return a context-managed connection from the pool.

    Usage:
        with get_connection() as conn:
            ...
    """
    return _get_pool().connection()
