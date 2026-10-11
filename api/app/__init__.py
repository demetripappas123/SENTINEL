"""How the API process is laid out.

Orchestrators
    HTTP routes. Each one checks the caller and hands the request to a service.
    They do not score rules or write SQL.

Services
    The work: ingest, the queue rules, dataset reads, metrics, sign-in, and Orbit.
    services/rules decides the queue. auth and orbit are services that keep
    their own packages because each one has a store and a contract.

Mappers
    Turn kit CSVs and Orbit or Spot payloads into canonical records.
    A mapper does not open the database.

DTOs
    Pydantic shapes for requests, stored rows, and responses.
    Orbit's webhook models stay in orbit/models.py next to the webhook service.
"""
