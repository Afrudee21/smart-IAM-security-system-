# RBAC Design

Authorization is not based only on role-name conditionals. A user is connected to one or more roles through `iam_user_roles`, and each role is connected to granular permissions through `iam_role_permissions`. Protected routes check permission names on the backend. The UI uses the same session role information to hide actions, but hiding is never treated as security.

Default roles are `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `EMPLOYEE`, and `GUEST`. Manager and employee permissions demonstrate least privilege and separation of duties.
