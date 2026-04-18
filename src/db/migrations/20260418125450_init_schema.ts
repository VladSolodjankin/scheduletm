import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("users", (table) => {
    table.increments("id").primary();
    table.bigInteger("telegram_id").notNullable().unique();
    table.string("username");
    table.string("first_name");
    table.string("phone");
    table.string("email");
    table.timestamps(true, true);
  });

  await knex.schema.createTable("services", (table) => {
    table.increments("id").primary();
    table.string("name").notNullable();
    table.integer("price").notNullable().defaultTo(0);
    table.string("currency").notNullable().defaultTo("RUB");
    table.integer("duration_min").notNullable().defaultTo(90);
    table.integer("sessions_count").notNullable().defaultTo(1);
    table.boolean("is_first_free").notNullable().defaultTo(false);
    table.boolean("is_active").notNullable().defaultTo(true);
    table.timestamps(true, true);
  });

  await knex.schema.createTable("app_settings", (table) => {
    table.increments("id").primary();
    table.string("timezone").notNullable().defaultTo("Europe/Moscow");
    table.integer("work_start_hour").notNullable().defaultTo(9);
    table.integer("work_end_hour").notNullable().defaultTo(20);
    table.string("work_days").notNullable().defaultTo("1,2,3,4,5,6");
    table.integer("slot_duration_min").notNullable().defaultTo(90);
    table.timestamps(true, true);
  });

  await knex.schema.createTable("appointments", (table) => {
    table.increments("id").primary();
    table
      .integer("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");

    table
      .integer("service_id")
      .notNullable()
      .references("id")
      .inTable("services")
      .onDelete("RESTRICT");

    table.timestamp("appointment_at", { useTz: true }).notNullable();
    table.integer("duration_min").notNullable().defaultTo(90);
    table.string("status").notNullable().defaultTo("new");
    table.text("comment");
    table.integer("price").notNullable().defaultTo(0);
    table.string("currency").notNullable().defaultTo("RUB");
    table.boolean("is_first_time").notNullable().defaultTo(false);
    table.timestamps(true, true);

    table.index(["appointment_at"]);
    table.index(["status"]);
  });

  await knex.schema.createTable("notifications", (table) => {
    table.increments("id").primary();
    table
      .integer("appointment_id")
      .notNullable()
      .references("id")
      .inTable("appointments")
      .onDelete("CASCADE");

    table.string("type").notNullable();
    table.timestamp("send_at", { useTz: true }).notNullable();
    table.timestamp("sent_at", { useTz: true });
    table.string("status").notNullable().defaultTo("pending");
    table.string("channel").notNullable().defaultTo("telegram");
    table.timestamps(true, true);

    table.index(["send_at"]);
    table.index(["status"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("notifications");
  await knex.schema.dropTableIfExists("appointments");
  await knex.schema.dropTableIfExists("app_settings");
  await knex.schema.dropTableIfExists("services");
  await knex.schema.dropTableIfExists("users");
}
