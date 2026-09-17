# Smart IAM API

All routes are prefixed with `/api`. JSON errors use `{ "error": "message" }`. Protected routes require the `iam_session` HTTP-only cookie created during login or MFA verification.

## Authentication

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/auth/session` | Public | Read current session state |
| POST | `/auth/register` | Public | Register an employee identity |
| POST | `/auth/login` | Public | Verify credentials and start or challenge a session |
| POST | `/auth/verify-mfa` | Public | Consume a six-digit MFA challenge |
| POST | `/auth/logout` | Authenticated | Revoke current session |

## Dashboard

| Method | Endpoint | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/dashboard/stats` | Authenticated | System totals and average risk |
| GET | `/dashboard/charts` | Authenticated | Login, risk, and alert aggregates |

## Identity administration

| Method | Endpoint | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/users` | `user.view` | Search and paginate users |
| POST | `/users` | `user.create` | Create a user and optionally assign roles |
| GET | `/users/:id` | Authenticated | Read user details |
| PATCH | `/users/:id` | `user.update` | Update state, profile, MFA, and roles |
| DELETE | `/users/:id` | `user.delete` | Delete a user |
| GET | `/roles` | `role.view` | List roles and permission IDs |
| POST | `/roles` | `role.create` | Create a role |
| PATCH | `/roles/:id` | `role.update` | Edit a role |
| DELETE | `/roles/:id` | `role.delete` | Delete a role |
| PUT | `/roles/:id/permissions` | `permission.assign` | Replace role permissions |
| GET | `/permissions` | `permission.view` | List the permission catalog |

## Security operations

| Method | Endpoint | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/security/events` | `security.view` | Search and paginate login risk events |
| GET | `/security/alerts` | `security.view` | Filter alert queue |
| POST | `/security/alerts/:id/resolve` | `security.alerts` | Resolve an alert |
| POST | `/security/simulator` | `security.alerts` | Create a safe synthetic event |
| GET | `/audit-logs` | `audit.view` | Search and paginate audit logs |
| GET | `/audit-logs/export` | `audit.export` | Download CSV audit export |

## Profile and sessions

| Method | Endpoint | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/profile` | Authenticated | Read current identity |
| PATCH | `/profile` | `profile.update` | Edit profile and MFA setting |
| GET | `/sessions` | Authenticated | List current user's sessions |
| POST | `/sessions/:id/revoke` | Authenticated | Revoke a session |

## Example request

```bash
curl -c cookies.txt \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"admin@example.test","password":"DemoPass123!"}' \
  http://localhost:80/api/auth/login
curl -b cookies.txt http://localhost:80/api/dashboard/stats
```