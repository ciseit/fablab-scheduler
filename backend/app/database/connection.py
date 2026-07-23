from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# We will replace this later with Supabase PostgreSQL
DATABASE_URL = "sqlite:///./fablab_scheduler.db"

# Create the database engine
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

# Create a session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Base class for all database models
Base = declarative_base()


# Dependency for getting a database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()