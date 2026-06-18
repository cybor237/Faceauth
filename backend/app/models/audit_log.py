from sqlalchemy import Column, String, Boolean, Float, Integer, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
import uuid


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id                 = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    api_key_id         = Column(UUID(as_uuid=True), ForeignKey("api_keys.id"))
    end_user_id        = Column(String(255))
    action             = Column(String(50), nullable=False)  # enroll | verify_success | verify_failed | error
    success            = Column(Boolean, nullable=False)
    similarity_score   = Column(Float)
    session_id         = Column(String(255))
    image_received_at  = Column(DateTime(timezone=True))
    image_destroyed_at = Column(DateTime(timezone=True))   # Preuve conformité KYC
    ip_address         = Column(String(45))
    error_code         = Column(String(50))
    credits_before     = Column(Integer)
    credits_after      = Column(Integer)
    created_at         = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    api_key = relationship("APIKey", back_populates="audit_logs")
