from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.session import Base
import uuid


class Usage(Base):
    __tablename__ = "usage"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    parse_count = Column(Integer, default=0)
    period_start = Column(DateTime, nullable=False, default=datetime.now())
    period_end = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.now())

    user = relationship("User", back_populates="usage")
