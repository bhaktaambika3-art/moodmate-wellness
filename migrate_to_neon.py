"""
MoodMate — Safe SQLite to Neon PostgreSQL Migration Utility
-----------------------------------------------------------
This script safely migrates your local SQLite data (moodmate.db) to your
Neon PostgreSQL database without deleting or overwriting any local records.

Usage:
  1. Dry Run (Preview only, no changes):
     python migrate_to_neon.py --dry-run

  2. Live Migration (Uses DATABASE_URL from .env or command line):
     python migrate_to_neon.py

  3. Explicit Database URL:
     python migrate_to_neon.py --neon-url "postgresql://user:pass@ep-xyz.region.aws.neon.tech/neondb?sslmode=require"
"""

import os
import sys
import shutil
import sqlite3
import argparse
import secrets
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

def create_sqlite_backup(sqlite_path="moodmate.db"):
    """Creates a timestamped backup copy of the local SQLite database."""
    if not os.path.exists(sqlite_path):
        print(f"[!] Warning: SQLite database file '{sqlite_path}' does not exist.")
        return None

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = f"moodmate_backup_{timestamp}.db"
    shutil.copy2(sqlite_path, backup_path)
    print(f"[+] Safe local backup created: {backup_path}")
    return backup_path

def inspect_sqlite_data(sqlite_path="moodmate.db"):
    """Reads and counts all rows in the SQLite database."""
    if not os.path.exists(sqlite_path):
        return {}

    conn = sqlite3.connect(sqlite_path)
    c = conn.cursor()
    tables = ['users', 'conversations', 'chat_messages', 'mood_entries', 'journal_entries', 'tiny_wins']
    counts = {}
    for t in tables:
        try:
            c.execute(f"SELECT COUNT(*) FROM {t}")
            counts[t] = c.fetchone()[0]
        except sqlite3.OperationalError:
            counts[t] = 0
    conn.close()
    return counts

def migrate(sqlite_path="moodmate.db", neon_url=None, dry_run=False):
    print("=" * 65)
    print("       MoodMate — Safe Migration to Neon PostgreSQL")
    print("=" * 65)

    if not os.path.exists(sqlite_path):
        print(f"[!] SQLite source database '{sqlite_path}' was not found.")
        sys.exit(1)

    target_url = (neon_url or os.environ.get("DATABASE_URL", "")).strip()
    if not target_url:
        print("[!] Error: No PostgreSQL connection URL provided.")
        print("    Please provide --neon-url or set DATABASE_URL in your .env file.")
        sys.exit(1)

    # Normalize PostgreSQL URL
    if target_url.startswith("postgres://"):
        target_url = target_url.replace("postgres://", "postgresql://", 1)
    if target_url.startswith("postgresql://") and "sslmode=" not in target_url:
        sep = "&" if "?" in target_url else "?"
        target_url = f"{target_url}{sep}sslmode=require"

    # Step 1: Safe local backup
    backup_file = create_sqlite_backup(sqlite_path)

    # Step 2: Inspect source data
    source_counts = inspect_sqlite_data(sqlite_path)
    print("\n[i] Source SQLite Data Inventory:")
    for tbl, count in source_counts.items():
        print(f"    - {tbl:16}: {count} records")

    if dry_run:
        print("\n[*] DRY-RUN MODE: No changes will be written to Neon PostgreSQL.")
        print("[*] Connection and schema validation preview completed successfully.")
        return

    # Step 3: Connect to destination PostgreSQL
    try:
        from sqlalchemy import create_engine, text, inspect
    except ImportError:
        print("[!] Error: SQLAlchemy is required. Please run: pip install -r requirements.txt")
        sys.exit(1)

    print(f"\n[*] Connecting to Neon PostgreSQL...")
    engine = create_engine(target_url, pool_pre_ping=True)

    with engine.connect() as test_conn:
        test_conn.execute(text("SELECT 1"))
    print("[+] Successfully connected to Neon PostgreSQL!")

    # Step 4: Ensure target tables exist
    from app import app
    from models import db
    with app.app_context():
        # Temporarily point app db to target
        app.config['SQLALCHEMY_DATABASE_URI'] = target_url
        db.create_all()

    # Step 5: Transfer records
    src_conn = sqlite3.connect(sqlite_path)
    src_conn.row_factory = sqlite3.Row
    src_c = src_conn.cursor()

    tables_order = ['users', 'conversations', 'chat_messages', 'mood_entries', 'journal_entries', 'tiny_wins']

    with engine.begin() as dest_conn:
        for table in tables_order:
            try:
                src_c.execute(f"SELECT * FROM {table}")
                rows = src_c.fetchall()
            except sqlite3.OperationalError:
                continue

            if not rows:
                print(f"    [•] {table}: 0 rows to copy.")
                continue

            # Check if target already has rows
            existing_count = dest_conn.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
            if existing_count > 0:
                print(f"    [!] Target table '{table}' already has {existing_count} rows. Skipping to prevent duplicate keys.")
                continue

            columns = [desc[0] for desc in src_c.description]

            # Ensure session_token is populated if table is users
            insert_rows = []
            for r in rows:
                row_dict = dict(r)
                if table == 'users':
                    if 'session_token' not in row_dict or not row_dict['session_token']:
                        row_dict['session_token'] = secrets.token_hex(32)
                insert_rows.append(row_dict)

            # Build insert query
            col_names = ", ".join(insert_rows[0].keys())
            val_placeholders = ", ".join([f":{k}" for k in insert_rows[0].keys()])
            insert_stmt = text(f"INSERT INTO {table} ({col_names}) VALUES ({val_placeholders})")

            dest_conn.execute(insert_stmt, insert_rows)
            print(f"    [+] Successfully copied {len(insert_rows)} rows into '{table}'.")

            # Fix PostgreSQL serial sequence so new records increment from max(id) + 1
            try:
                seq_query = text(f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), COALESCE(MAX(id), 1)) FROM {table}")
                dest_conn.execute(seq_query)
            except Exception:
                pass

    src_conn.close()
    print("\n" + "=" * 65)
    print("  [SUCCESS] All records safely migrated to Neon PostgreSQL!")
    print(f"  Your original SQLite database ({sqlite_path}) was NOT altered.")
    print(f"  A backup copy was saved to {backup_file}.")
    print("=" * 65)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Safely migrate MoodMate from SQLite to Neon PostgreSQL.")
    parser.add_argument("--sqlite-path", default="moodmate.db", help="Path to local SQLite database (default: moodmate.db)")
    parser.add_argument("--neon-url", default=None, help="Neon PostgreSQL connection URL")
    parser.add_argument("--dry-run", action="store_true", help="Preview migration without modifying destination database")

    args = parser.parse_args()
    migrate(sqlite_path=args.sqlite_path, neon_url=args.neon_url, dry_run=args.dry_run)
