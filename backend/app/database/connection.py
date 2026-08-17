from sqlalchemy import create_engine, inspect, text
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


# There is no migration framework (e.g. Alembic) in this project yet.
# Base.metadata.create_all only creates missing tables, so columns added to
# a model after a table already exists on disk need to be added here to
# keep existing SQLite databases (like local/demo data) in sync.
def run_startup_migrations() -> None:
    inspector = inspect(engine)

    if not inspector.has_table("technicians"):
        return

    existing_columns = {
        column["name"] for column in inspector.get_columns("technicians")
    }

    if "assignment_type" not in existing_columns:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE technicians ADD COLUMN assignment_type VARCHAR(100)"
                )
            )

    if "assignment_name" not in existing_columns:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE technicians ADD COLUMN assignment_name VARCHAR(150)"
                )
            )

        # The frontend previously had no real "assignment name" column and
        # stored that value in `notes` instead. Backfill it here so existing
        # demo/production data is not lost, without touching genuine notes
        # for technicians that never had this workaround applied.
        with engine.begin() as connection:
            connection.execute(
                text(
                    "UPDATE technicians SET assignment_name = notes, notes = NULL "
                    "WHERE assignment_name IS NULL AND notes IS NOT NULL"
                )
            )