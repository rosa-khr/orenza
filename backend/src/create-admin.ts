import { pool, query } from "./db.js";
import { hashPassword } from "./security.js";

const username = (process.env.ADMIN_USERNAME || "").trim();
const password = process.env.ADMIN_PASSWORD || "";
const displayName = process.env.ADMIN_NAME || "مدیر اورنزا";

if (!/^[a-zA-Z0-9._-]{3,80}$/.test(username) || password.length < 10) {
  console.error("ADMIN_USERNAME باید معتبر و ADMIN_PASSWORD حداقل ۱۰ کاراکتر باشد.");
  process.exitCode = 1;
} else {
  const passwordHash = await hashPassword(password);
  await query(
    `INSERT INTO users (username,email,password_hash,display_name,role)
     VALUES ($1,$2,$3,$4,'admin')
     ON CONFLICT (lower(username)) WHERE username IS NOT NULL
     DO UPDATE SET password_hash=EXCLUDED.password_hash, display_name=EXCLUDED.display_name, role='admin', updated_at=now()`,
    [username, `${username}@admin.orenza.local`, passwordHash, displayName]
  );
  console.log("Admin account is ready.");
}
await pool.end();
