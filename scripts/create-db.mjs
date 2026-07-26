import pg from "pg";

const url =
  "postgres://postgres:postgres@localhost:51218/template1?sslmode=disable";
const client = new pg.Client({ connectionString: url });

await client.connect();
const { rows } = await client.query(
  "SELECT 1 FROM pg_database WHERE datname = $1",
  ["snooker_club"],
);
if (rows.length === 0) {
  await client.query("CREATE DATABASE snooker_club");
  console.log("created snooker_club");
} else {
  console.log("snooker_club already exists");
}
await client.end();
