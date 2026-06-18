from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class ChallengeSession(Base):
    __tablename__ = "challenge_sessions"

    session_id       = Column(String(255), primary_key=True)
    api_key_id       = Column(UUID(as_uuid=True), ForeignKey("api_keys.id"), nullable=False)
    gesture_sequence = Column(String(100), nullable=False)  # "blink,mouth,left,right"
    expires_at       = Column(DateTime(timezone=True), nullable=False)
    used             = Column(Boolean, nullable=False, default=False)
    used_at          = Column(DateTime(timezone=True))
    created_at       = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    api_key = relationship("APIKey", back_populates="challenge_sessions")
