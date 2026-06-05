"""
Database initialization and seeding script.
Runs on container startup: creates tables, seeds synthetic data, then starts the API.
"""

import time
import logging
import sys
import os

# Allow running as: python init_db.py
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


def wait_for_db(engine, retries: int = 15, delay: int = 3):
    from sqlalchemy import text
    for attempt in range(1, retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            logger.info("Database is ready.")
            return True
        except Exception as e:
            logger.warning("DB not ready (attempt %d/%d): %s", attempt, retries, e)
            time.sleep(delay)
    return False


def check_seeded(engine) -> bool:
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT COUNT(*) FROM sales_data")).fetchone()
            return result[0] > 0
    except Exception:
        return False


def main():
    from backend.core.database import engine, Base, SessionLocal
    from backend.services.data_generator import run_all_seeds

    logger.info("=" * 60)
    logger.info("Retail & CPG Decision Intelligence Platform")
    logger.info("Initializing database...")
    logger.info("=" * 60)

    if not wait_for_db(engine):
        logger.error("Could not connect to database. Exiting.")
        sys.exit(1)

    logger.info("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("Tables created.")

    if check_seeded(engine):
        logger.info("Database already seeded. Skipping data generation.")
    else:
        logger.info("Seeding database with synthetic data...")
        db = SessionLocal()
        try:
            run_all_seeds(db)
        finally:
            db.close()
        logger.info("Database seeding complete.")

    logger.info("Starting FastAPI server on port 8000...")
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        workers=2,
        log_level="info",
    )


if __name__ == "__main__":
    main()
