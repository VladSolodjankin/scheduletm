import type { Knex } from "knex";

export async function seed(knex: Knex): Promise<void> {
    await knex("user_sessions").del();
    await knex("specialists").del();
    await knex("services").del();

    await knex("services").insert([
        {
            code: "first_consultation",
            name_ru: "Первичная консультация",
            name_en: "First consultation",
            price: 0,
            currency: "RUB",
            duration_min: 90,
            sessions_count: 1,
            is_first_free: true,
            is_active: true,
        },
        {
            code: "single_session",
            name_ru: "1 сессия",
            name_en: "1 session",
            price: 2500,
            currency: "RUB",
            duration_min: 90,
            sessions_count: 1,
            is_first_free: false,
            is_active: true,
        },
        {
            code: "package_10",
            name_ru: "10 сессий",
            name_en: "10 sessions",
            price: 22500,
            currency: "RUB",
            duration_min: 90,
            sessions_count: 10,
            is_first_free: false,
            is_active: true,
        },
    ]);

    await knex("specialists").insert([
        {
            code: "main_psychologist",
            name: "Лилия Солодянкина",
            is_active: true,
            is_default: true,
        },
    ]);
}
