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
    client = WorkspaceClient()
    instance_name = os.environ.get("LAKEBASE_INSTANCE") or os.environ.get("ENDPOINT_NAME")
    if instance_name:
        instance = client.database.get_database_instance(name=instance_name)
    else:
        instances = [item for item in client.database.list_database_instances() if item.read_write_dns]
        if len(instances) != 1:
            raise RuntimeError("Set ENDPOINT_NAME to the Lakebase instance name")
        instance = instances[0]
    host = os.environ.get("LAKEBASE_HOST") or os.environ.get("PGHOST") or instance.read_write_dns
    user = os.environ.get("LAKEBASE_USER") or os.environ.get("PGUSER") or os.environ.get("DATABRICKS_CLIENT_ID")
    database = os.environ.get("LAKEBASE_DATABASE") or os.environ.get("PGDATABASE") or "databricks_postgres"
    port = int(os.environ.get("LAKEBASE_PORT") or os.environ.get("PGPORT") or "5432")
    if not host or not user:
        raise RuntimeError("Set PGHOST and PGUSER for the Lakebase connection")
    credential = client.database.generate_database_credential(instance_names=[instance.name])
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
