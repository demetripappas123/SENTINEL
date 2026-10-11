"""Sign-in for a person. The organization on that user has one Orbit connection.

This package is a service: passwords, the user store, and the session rules.
orchestrators/auth.py is the HTTP surface. deps.py is the dependency the
other orchestrators use to require a signed-in user.
"""
