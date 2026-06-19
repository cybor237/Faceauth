from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.engine import make_url
from pgvector.sqlalchemy import Vector  # noqa
from app.config import settings
import logging
import ssl

logger = logging.getLogger(__name__)


def _build_engine():
    """
    Parse proprement l'URL Neon avec SQLAlchemy, force le driver asyncpg,
    et retire les paramètres de query incompatibles (sslmode, channel_binding).
    """
    url = make_url(settings.DATABASE_URL)

    # Forcer le driver asyncpg
    url = url.set(drivername="postgresql+asyncpg")

    # Retirer tous les paramètres de query (sslmode, channel_binding, etc.)
    # — le SSL est géré séparément via connect_args
    url = url.set(query={})

    # Contexte SSL requis par Neon
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE

    return create_async_engine(
        url,
        echo=settings.ENVIRONMENT == "development",
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        connect_args={"ssl": ssl_context},
    )


engine = _build_engine()

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def init_db():
    from app.models import developer, api_key, embedding, audit_log, challenge_session  # noqa
    async with engine.begin() as conn:
        await conn.execute(
            __import__("sqlalchemy").text("CREATE EXTENSION IF NOT EXISTS vector")
        )
        await conn.run_sync(Base.metadata.create_all)
    logger.info("✅ Tables PostgreSQL vérifiées/créées")


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()