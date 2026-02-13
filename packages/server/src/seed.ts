import "dotenv/config";

import { eq, sql } from "drizzle-orm";
import { db } from "./db/client";
import { users } from "./db/schema";

const seedUsers = [
  {
    name: "Admin",
    email: "admin@example.com",
    passwordHash: "password",
    role: "admin"
  },
  {
    name: "User",
    email: "user@example.com",
    passwordHash: "password",
    role: "user"
  }
];

async function seed() {
  await db.execute(sql`create extension if not exists "pgcrypto";`);

  await db.execute(sql`
    create table if not exists users (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      email text not null unique,
      password_hash text not null,
      role text not null default 'user',
      created_at timestamptz default now()
    )
  `);

  await db.execute(sql`
    alter table users add column if not exists name text;
  `);

  await db.execute(sql`
    create table if not exists workspaces (
      id uuid primary key default gen_random_uuid(),
      slug text not null unique,
      name text not null,
      description text,
      owner_id uuid references users(id),
      created_at timestamptz default now()
    )
  `);

  await db.execute(sql`
    create table if not exists workspace_members (
      id uuid primary key default gen_random_uuid(),
      workspace_id uuid not null references workspaces(id),
      user_id uuid not null references users(id),
      role text not null default 'member',
      created_at timestamptz default now()
    )
  `);

  await db.execute(sql`
    create table if not exists todos (
      id uuid primary key default gen_random_uuid(),
      workspace_id uuid not null references workspaces(id),
      title text not null,
      category text not null default '默认',
      completed boolean not null default false,
      created_by uuid references users(id),
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `);

  for (const user of seedUsers) {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, user.email));

    if (existing.length === 0) {
      await db.insert(users).values(user);
    } else if (!existing[0].name) {
      await db
        .update(users)
        .set({ name: user.name })
        .where(eq(users.id, existing[0].id));
    }
  }

  console.log("Seed completed");
  process.exit(0);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
