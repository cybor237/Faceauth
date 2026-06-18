from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from pgvector.sqlalchemy import Vector  # noqa: F401 — enregistre le type
from app.config import settings
import logging

logger = logging.getLogger(__name__)

# Moteur async
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.ENVIRONMENT == "development",
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,  # Vérifie la connexion avant chaque requête
)

# Factory de sessions async
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def init_db():
    """Crée les tables si elles n'existent pas (dev uniquement).
    En production, utiliser des migrations Alembic."""
    from app.models import api_key, embedding, audit_log, challenge_session  # noqa

    async with engine.begin() as conn:
        # Active l'extension pgvector si elle n'est pas encore active
        await conn.execute(
            __import__("sqlalchemy").text("CREATE EXTENSION IF NOT EXISTS vector")
        )
        await conn.run_sync(Base.metadata.create_all)
    logger.info("✅ Tables PostgreSQL vérifiées/créées")


async def get_db():
    """Dépendance FastAPI — injecte une session DB dans les routes."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
