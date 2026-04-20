import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const hasCode = await knex.schema.hasColumn("services", "code");
  const hasNameRu = await knex.schema.hasColumn("services", "name_ru");
  const hasNameEn = await knex.schema.hasColumn("services", "name_en");
  const hasName = await knex.schema.hasColumn("services", "name");

  await knex.schema.alterTable("services", (table) => {
    if (!hasCode) {
      table.string("code").unique();
    }
    if (!hasNameRu) {
      table.string("name_ru");
    }
    if (!hasNameEn) {
      table.string("name_en");
    }
  });

  if (hasName) {
    await knex("services")
      .whereNull("name_ru")
      .update({ name_ru: knex.ref("name") });

    await knex("services")
      .whereNull("name_en")
      .update({ name_en: knex.ref("name") });
  }

  await knex.schema.alterTable("services", (table) => {
    if (!hasCode) {
      table.string("code").notNullable().alter();
    }
    if (!hasNameRu) {
      table.string("name_ru").notNullable().alter();
    }
    if (!hasNameEn) {
      table.string("name_en").notNullable().alter();
    }
  });


  if (hasName) {
    await knex.schema.alterTable("services", (table) => {
      table.dropColumn("name");
    });
  }

}

export async function down(knex: Knex): Promise<void> {
  const hasCode = await knex.schema.hasColumn("services", "code");
  const hasNameRu = await knex.schema.hasColumn("services", "name_ru");
  const hasNameEn = await knex.schema.hasColumn("services", "name_en");

  await knex.schema.alterTable("services", (table) => {
    if (hasCode) table.dropColumn("code");
    if (hasNameRu) table.dropColumn("name_ru");
    if (hasNameEn) table.dropColumn("name_en");
  });
}
