from sqlalchemy import Column, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.session import Base
import uuid


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    filename = Column(String)
    parsed_data = Column(JSON, nullable=False)
    pdf_url = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.now())

    user = relationship("User", back_populates="invoices")
