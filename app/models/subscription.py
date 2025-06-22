from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.session import Base
import uuid


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    stripe_subscription_id = Column(String, nullable=False)
    plan = Column(String, nullable=False)  # e.g., starter, pro, etc.
    status = Column(String, nullable=False)  # active, canceled, trialing
    current_period_start = Column(DateTime, nullable=False)
    current_period_end = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.now)

    user = relationship("User", back_populates="subscription")
