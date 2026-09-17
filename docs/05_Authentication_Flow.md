# Authentication Flow

1. Validate identifier and password input.
2. Find the user without revealing whether an identifier exists.
3. Verify the scrypt password hash.
4. Record the login attempt and risk score.
5. If MFA is enabled or risk is high, create a short-lived hashed challenge.
6. On success, create an HTTP-only session cookie and database session.
7. Record login, MFA, logout, and denied events in the audit trail.
