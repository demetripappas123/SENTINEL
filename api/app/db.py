"""Lakebase connection.

Opens one Postgres session with the Databricks workspace credential and sets
the session time zone to UTC. Callers pass the organization into each query.
Row security is not turned on here.
"""
import os
from pathlib import Path

import psycopg
from databricks.sdk import WorkspaceClient
from dotenv import load_dotenv
from psycopg.rows import dict_row

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env.local")
load_dotenv(ROOT / ".env")


def connect() -> psycopg.Connection:
    """Open a Lakebase connection using a short-lived Databricks credential."""
    client = WorkspaceClient(scopes=["postgres"])
    endpoint = os.environ.get("ENDPOINT_NAME")
    host = os.environ.get("PGHOST") or os.environ.get("LAKEBASE_HOST")
    user = os.environ.get("PGUSER") or os.environ.get("LAKEBASE_USER") or os.environ.get("DATABRICKS_CLIENT_ID")
    database = os.environ.get("PGDATABASE") or os.environ.get("LAKEBASE_DATABASE") or "databricks_postgres"
    port = int(os.environ.get("PGPORT") or os.environ.get("LAKEBASE_PORT") or "5432")
    if not endpoint or not host or not user:
        raise RuntimeError("Set ENDPOINT_NAME, PGHOST, and PGUSER from the Lakebase Connect dialog")
    credential = client.postgres.generate_database_credential(endpoint=endpoint)
    if not credential.token:
        raise RuntimeError("Lakebase did not return a database credential")
    conn = psycopg.connect(
        host=host,
        dbname=database,
        user=user,
        password=credential.token,
        sslmode=os.environ.get("PGSSLMODE", "require"),
        port=port,
        connect_timeout=30,
        row_factory=dict_row,
    )
    # Kit timestamps carry no offset; store and read them as UTC.
    conn.execute("SET TIME ZONE 'UTC'")
    return conn
