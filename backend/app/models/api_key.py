from sqlalchemy import Column, String, Boolean, Integer, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
import uuid


class APIKey(Base):
    __tablename__ = "api_keys"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    developer_id = Column(UUID(as_uuid=True), ForeignKey("developers.id", ondelete="CASCADE"), nullable=False)
    key_hash     = Column(String(255), unique=True, nullable=False)
    key_prefix   = Column(String(20), nullable=False)
    name         = Column(String(100))
    is_active    = Column(Boolean, nullable=False, default=True)
    credits      = Column(Integer, nullable=False, default=500)
    created_at   = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_used_at = Column(DateTime(timezone=True))

    # Relations
    embeddings        = relationship("BiometricEmbedding", back_populates="api_key", cascade="all, delete")
    challenge_sessions = relationship("ChallengeSession", back_populates="api_key")
    audit_logs        = relationship("AuditLog", back_populates="api_key")
