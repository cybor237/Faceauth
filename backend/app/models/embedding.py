from sqlalchemy import Column, String, DateTime, ForeignKey, func, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from app.database import Base
import uuid


class BiometricEmbedding(Base):
    __tablename__ = "biometric_embeddings"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    api_key_id  = Column(UUID(as_uuid=True), ForeignKey("api_keys.id", ondelete="CASCADE"), nullable=False)
    end_user_id = Column(String(255), nullable=False)
    embedding   = Column(Vector(512), nullable=False)  # FaceNet512 = 512 dimensions
    model_used  = Column(String(50), nullable=False, default="Facenet512")
    created_at  = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at  = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("api_key_id", "end_user_id", name="uq_api_key_user"),
    )

    # Relations
    api_key = relationship("APIKey", back_populates="embeddings")
