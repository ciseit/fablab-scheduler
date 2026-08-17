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
def run_startup_migrations(db_engine=None) -> None:
    db_engine = db_engine or engine
    inspector = inspect(db_engine)

    if not inspector.has_table("technicians"):
        return

    existing_columns = {
        column["name"] for column in inspector.get_columns("technicians")
    }

    if "assignment_type" not in existing_columns:
        with db_engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE technicians ADD COLUMN assignment_type VARCHAR(100)"
                )
            )

    if "assignment_name" not in existing_columns:
        with db_engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE technicians ADD COLUMN assignment_name VARCHAR(150)"
                )
            )

        # The frontend previously had no real "assignment name" column and
        # stored that value in `notes` instead. Backfill it here so existing
        # demo/production data is not lost, without touching genuine notes
        # for technicians that never had this workaround applied.
        with db_engine.begin() as connection:
            connection.execute(
                text(
                    "UPDATE technicians SET assignment_name = notes, notes = NULL "
                    "WHERE assignment_name IS NULL AND notes IS NOT NULL"
                )
            )

    _migrate_shifts_and_assignments_to_schedules(inspector, db_engine)
    _seed_default_schedule_categories(db_engine)


def _migrate_shifts_and_assignments_to_schedules(inspector, db_engine) -> None:
    """
    Historically, shifts/assignments hung directly off a
    CollectionCampaign (Availability Request) via a required campaign_id
    column, and a schedule's publish state lived on the campaign itself.
    Schedule is now its own entity so a schedule can exist without any
    Availability Request behind it.

    This is a one-time, idempotent migration: it only runs while
    `shifts.campaign_id` still exists (i.e. on a database created before
    this change). It creates one Schedule per existing campaign
    (preserving name/semester/minimum hours/publish state), repoints
    every shift and assignment at that schedule, then drops the old
    campaign_id columns. Nothing is deleted: every existing shift,
    assignment, and published schedule link keeps working.
    """

    if not inspector.has_table("shifts"):
        return

    shift_columns = {
        column["name"] for column in inspector.get_columns("shifts")
    }

    if "campaign_id" not in shift_columns:
        # Already migrated (or a fresh database that never had the old
        # column in the first place).
        return

    with db_engine.begin() as connection:
        campaigns = connection.execute(
            text(
                "SELECT id, name, semester, opens_at, closes_at, "
                "minimum_weekly_hours, schedule_published_at, "
                "schedule_public_token FROM collection_campaigns"
            )
        ).mappings().all()

        for campaign in campaigns:
            status = (
                "published"
                if campaign["schedule_published_at"]
                else "draft"
            )

            connection.execute(
                text(
                    "INSERT INTO schedules "
                    "(name, start_date, end_date, semester, notes, "
                    "minimum_weekly_hours, campaign_id, status, "
                    "published_at, public_token, created_at) "
                    "VALUES (:name, :start_date, :end_date, :semester, "
                    "NULL, :minimum_weekly_hours, :campaign_id, :status, "
                    ":published_at, :public_token, CURRENT_TIMESTAMP)"
                ),
                {
                    "name": campaign["name"],
                    "start_date": (
                        campaign["opens_at"][:10]
                        if campaign["opens_at"]
                        else None
                    ),
                    "end_date": (
                        campaign["closes_at"][:10]
                        if campaign["closes_at"]
                        else None
                    ),
                    "semester": campaign["semester"],
                    "minimum_weekly_hours": campaign[
                        "minimum_weekly_hours"
                    ],
                    "campaign_id": campaign["id"],
                    "status": status,
                    "published_at": campaign["schedule_published_at"],
                    "public_token": campaign["schedule_public_token"],
                },
            )

        schedule_id_by_campaign_id = dict(
            connection.execute(
                text(
                    "SELECT campaign_id, id FROM schedules "
                    "WHERE campaign_id IS NOT NULL"
                )
            ).all()
        )

        connection.execute(
            text("ALTER TABLE shifts ADD COLUMN schedule_id INTEGER")
        )
        connection.execute(
            text("ALTER TABLE shifts ADD COLUMN location_id INTEGER")
        )
        connection.execute(
            text(
                "ALTER TABLE assignments ADD COLUMN schedule_id INTEGER"
            )
        )
        connection.execute(
            text(
                "ALTER TABLE assignments ADD COLUMN category_id INTEGER"
            )
        )

        for campaign_id, schedule_id in schedule_id_by_campaign_id.items():
            connection.execute(
                text(
                    "UPDATE shifts SET schedule_id = :schedule_id "
                    "WHERE campaign_id = :campaign_id"
                ),
                {"schedule_id": schedule_id, "campaign_id": campaign_id},
            )
            connection.execute(
                text(
                    "UPDATE assignments SET schedule_id = :schedule_id "
                    "WHERE campaign_id = :campaign_id"
                ),
                {"schedule_id": schedule_id, "campaign_id": campaign_id},
            )

        # SQLite refuses to DROP COLUMN when that column is named in an
        # explicit table-level FOREIGN KEY constraint (which is how
        # SQLAlchemy emits it here), so campaign_id can't simply be
        # dropped in place. Rebuild both tables instead: create a table
        # with the new shape, copy every row across (schedule_id/
        # location_id/category_id were already backfilled above), then
        # swap it in for the old one. No rows are dropped in the process.
        connection.execute(
            text(
                "CREATE TABLE shifts_new ("
                "id INTEGER NOT NULL PRIMARY KEY, "
                "schedule_id INTEGER NOT NULL, "
                "location_id INTEGER, "
                "day_of_week VARCHAR(10) NOT NULL, "
                "start_time TIME NOT NULL, "
                "end_time TIME NOT NULL, "
                "required_technicians INTEGER NOT NULL, "
                "FOREIGN KEY(schedule_id) REFERENCES schedules (id), "
                "FOREIGN KEY(location_id) REFERENCES locations (id)"
                ")"
            )
        )
        connection.execute(
            text(
                "INSERT INTO shifts_new (id, schedule_id, location_id, "
                "day_of_week, start_time, end_time, required_technicians) "
                "SELECT id, schedule_id, location_id, day_of_week, "
                "start_time, end_time, required_technicians FROM shifts"
            )
        )
        connection.execute(text("DROP TABLE shifts"))
        connection.execute(text("ALTER TABLE shifts_new RENAME TO shifts"))
        connection.execute(
            text(
                "CREATE INDEX ix_shifts_schedule_id ON shifts (schedule_id)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX ix_shifts_location_id ON shifts (location_id)"
            )
        )
        connection.execute(
            text("CREATE INDEX ix_shifts_id ON shifts (id)")
        )

        connection.execute(
            text(
                "CREATE TABLE assignments_new ("
                "id INTEGER NOT NULL PRIMARY KEY, "
                "schedule_id INTEGER NOT NULL, "
                "shift_id INTEGER NOT NULL, "
                "technician_id INTEGER NOT NULL, "
                "status VARCHAR(20) NOT NULL, "
                "category_id INTEGER, "
                "created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, "
                "updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, "
                "FOREIGN KEY(schedule_id) REFERENCES schedules (id), "
                "FOREIGN KEY(shift_id) REFERENCES shifts (id), "
                "FOREIGN KEY(technician_id) REFERENCES technicians (id), "
                "FOREIGN KEY(category_id) REFERENCES schedule_categories (id)"
                ")"
            )
        )
        connection.execute(
            text(
                "INSERT INTO assignments_new (id, schedule_id, shift_id, "
                "technician_id, status, category_id, created_at, "
                "updated_at) "
                "SELECT id, schedule_id, shift_id, technician_id, status, "
                "category_id, created_at, updated_at FROM assignments"
            )
        )
        connection.execute(text("DROP TABLE assignments"))
        connection.execute(
            text("ALTER TABLE assignments_new RENAME TO assignments")
        )
        connection.execute(
            text(
                "CREATE INDEX ix_assignments_schedule_id "
                "ON assignments (schedule_id)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX ix_assignments_shift_id "
                "ON assignments (shift_id)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX ix_assignments_technician_id "
                "ON assignments (technician_id)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX ix_assignments_category_id "
                "ON assignments (category_id)"
            )
        )
        connection.execute(
            text("CREATE INDEX ix_assignments_id ON assignments (id)")
        )


def _seed_default_schedule_categories(db_engine=None) -> None:
    db_engine = db_engine or engine
    inspector = inspect(db_engine)

    if not inspector.has_table("schedule_categories"):
        return

    assignments_table_exists = inspector.has_table("assignments")

    with db_engine.begin() as connection:
        existing_count = connection.execute(
            text("SELECT COUNT(*) FROM schedule_categories")
        ).scalar()

        if existing_count:
            return

        default_categories = [
            ("Working", "#16a34a"),
            ("On Leave", "#f97316"),
            ("Called Off", "#dc2626"),
            ("Training", "#2563eb"),
            ("Event", "#7c3aed"),
        ]

        for name, color in default_categories:
            connection.execute(
                text(
                    "INSERT INTO schedule_categories (name, color, "
                    "is_active) VALUES (:name, :color, 1)"
                ),
                {"name": name, "color": color},
            )

        working_category_id = connection.execute(
            text(
                "SELECT id FROM schedule_categories WHERE name = 'Working'"
            )
        ).scalar()

        if assignments_table_exists:
            connection.execute(
                text(
                    "UPDATE assignments SET category_id = :category_id "
                    "WHERE category_id IS NULL"
                ),
                {"category_id": working_category_id},
            )