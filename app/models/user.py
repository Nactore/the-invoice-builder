from sqlalchemy import Column, String, DateTime
from sqlalchemy.orm import relationship
from app.db.session import Base
import uuid
from datetime import datetime


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.now())
    invoices = relationship("Invoice", back_populates="user")
    usage = relationship("ParseUsage", back_populates="user", uselist=False)
