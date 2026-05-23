# Database Migration Notes

The second website used `data/users.json` as its user database. To prevent unnecessary bugs, the merged Node.js version keeps the same JSON database format.

No SQL migration is required for this release.

## Current JSON database file

```text
data/users.json
```

## User fields retained

```text
id
username
email
mobile
password_hash
email_verification_code
email_code_expires
email_verified_at
whatsapp_verification_code
whatsapp_code_expires
whatsapp_verified_at
role
created_at
updated_at
```

## Optional SQL table if you later migrate

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username VARCHAR(32) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  mobile VARCHAR(40),
  password_hash TEXT NOT NULL,
  email_verification_code VARCHAR(10),
  email_code_expires INTEGER,
  email_verified_at INTEGER,
  whatsapp_verification_code VARCHAR(10),
  whatsapp_code_expires INTEGER,
  whatsapp_verified_at INTEGER,
  role VARCHAR(20) DEFAULT 'user',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```
