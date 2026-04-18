import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const hasUsersLanguage = await knex.schema.hasColumn("users", "language_code");

  if (!hasUsersLanguage) {
    await knex.schema.alterTable("users", (table) => {
      table.string("language_code").notNullable().defaultTo("ru");
    });
  }

  const hasServices = await knex.schema.hasTable("services");
  if (!hasServices) {
    await knex.schema.createTable("services", (table) => {
      table.increments("id").primary();
      table.string("code").notNullable().unique();
      table.string("name_ru").notNullable();
      table.string("name_en").notNullable();
      table.integer("price").notNullable().defaultTo(0);
      table.string("currency").notNullable().defaultTo("RUB");
      table.integer("duration_min").notNullable().defaultTo(90);
      table.integer("sessions_count").notNullable().defaultTo(1);
      table.boolean("is_first_free").notNullable().defaultTo(false);
      table.boolean("is_active").notNullable().defaultTo(true);
      table.timestamps(true, true);
    });
  }

  const hasSpecialists = await knex.schema.hasTable("specialists");
  if (!hasSpecialists) {
    await knex.schema.createTable("specialists", (table) => {
      table.increments("id").primary();
      table.string("code").notNullable().unique();
      table.string("name").notNullable();
      table.boolean("is_active").notNullable().defaultTo(true);
      table.boolean("is_default").notNullable().defaultTo(false);
      table.timestamps(true, true);
    });
  }

  const hasUserSessions = await knex.schema.hasTable("user_sessions");
  if (!hasUserSessions) {
    await knex.schema.createTable("user_sessions", (table) => {
      table.increments("id").primary();
      table
        .integer("user_id")
        .notNullable()
        .references("id")
        .inTable("users")
        .onDelete("CASCADE")
        .unique();

      table.string("state").notNullable().defaultTo("idle");
      table.jsonb("payload_json").notNullable().defaultTo("{}");
      table.timestamps(true, true);
    });
  }

  const hasAppointmentsSpecialist = await knex.schema.hasColumn(
    "appointments",
    "specialist_id"
  );

  if (!hasAppointmentsSpecialist) {
    await knex.schema.alterTable("appointments", (table) => {
      table
        .integer("specialist_id")
        .references("id")
        .inTable("specialists")
        .onDelete("RESTRICT");

      table.index(["specialist_id"]);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasAppointmentsSpecialist = await knex.schema.hasColumn(
    "appointments",
    "specialist_id"
  );

  if (hasAppointmentsSpecialist) {
    await knex.schema.alterTable("appointments", (table) => {
      table.dropIndex(["specialist_id"]);
      table.dropColumn("specialist_id");
    });
  }

  await knex.schema.dropTableIfExists("user_sessions");
  await knex.schema.dropTableIfExists("specialists");
  await knex.schema.dropTableIfExists("services");

  const hasUsersLanguage = await knex.schema.hasColumn("users", "language_code");
  if (hasUsersLanguage) {
    await knex.schema.alterTable("users", (table) => {
      table.dropColumn("language_code");
    });
  }
}
