# Database Design

The IAM schema uses dedicated tables for users, roles, permissions, user-role links, role-permission links, sessions, login attempts, MFA challenges, security alerts, and audit logs. Security secrets are stored as hashes; the session token is hashed before persistence; timestamps use timezone-aware PostgreSQL timestamps.
