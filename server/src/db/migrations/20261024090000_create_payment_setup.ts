import type { Knex } from 'knex';

const PROVIDERS = "('stripe','yookassa','bog')";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('account_payment_settings', (table) => {
    table.integer('account_id').primary().references('id').inTable('accounts').onDelete('CASCADE');
    table.string('active_provider', 20);
    table.boolean('bank_transfer_enabled').notNullable().defaultTo(false);
    table.text('bank_transfer_text').notNullable().defaultTo('');
    table.boolean('custom_link_enabled').notNullable().defaultTo(false);
    table.string('custom_link_title', 60).notNullable().defaultTo('');
    table.string('custom_link_url', 500).notNullable().defaultTo('');
    table.boolean('cash_enabled').notNullable().defaultTo(false);
    table.text('cash_comment').notNullable().defaultTo('');
    table.timestamps(true, true);
  });
  await knex.raw(
    `ALTER TABLE account_payment_settings ADD CONSTRAINT account_payment_settings_active_provider_check CHECK (active_provider IS NULL OR active_provider IN ${PROVIDERS})`,
  );

  await knex.schema.createTable('account_payment_providers', (table) => {
    table.increments('id').primary();
    table.integer('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE');
    table.string('provider', 20).notNullable();
    table.jsonb('config_json').notNullable().defaultTo('{}');
    table.text('secret_encrypted');
    table.string('webhook_token_hash', 64);
    table.timestamp('connected_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamps(true, true);
    table.unique(['account_id', 'provider'], { indexName: 'account_payment_providers_account_provider_uq' });
    table.index(['provider', 'webhook_token_hash'], 'account_payment_providers_token_idx');
  });
  await knex.raw(
    `ALTER TABLE account_payment_providers ADD CONSTRAINT account_payment_providers_provider_check CHECK (provider IN ${PROVIDERS})`,
  );

  await knex.schema.createTable('payment_orders', (table) => {
    table.increments('id').primary();
    table.integer('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE');
    table.integer('appointment_id').notNullable().references('id').inTable('appointments').onDelete('CASCADE');
    table.string('provider', 20).notNullable();
    table.string('provider_order_id', 128);
    table.integer('amount').notNullable();
    table.string('currency', 3).notNullable();
    table.string('status', 20).notNullable().defaultTo('pending');
    table.text('redirect_url');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('paid_at', { useTz: true });
    table.unique(['provider', 'provider_order_id'], { indexName: 'payment_orders_provider_order_uq' });
    table.index(['account_id', 'appointment_id'], 'payment_orders_account_appointment_idx');
  });
  await knex.raw(
    `ALTER TABLE payment_orders ADD CONSTRAINT payment_orders_provider_check CHECK (provider IN ${PROVIDERS})`,
  );
  await knex.raw(
    "ALTER TABLE payment_orders ADD CONSTRAINT payment_orders_status_check CHECK (status IN ('pending','paid','failed','cancelled','duplicate','mismatch'))",
  );
  // At most one open checkout per appointment: concurrent checkout calls cannot create duplicates.
  await knex.raw(
    "CREATE UNIQUE INDEX payment_orders_one_pending_per_appointment_uq ON payment_orders (appointment_id) WHERE status = 'pending'",
  );

  await knex.schema.createTable('payment_webhook_events', (table) => {
    table.increments('id').primary();
    table.string('provider', 20).notNullable();
    table.string('event_id', 255).notNullable();
    table.string('status', 20).notNullable().defaultTo('processing');
    table.uuid('processing_token');
    table.timestamp('lease_expires_at', { useTz: true });
    table.timestamp('received_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(['provider', 'event_id'], { indexName: 'payment_webhook_events_provider_event_uq' });
  });

  await knex.schema.createTable('appointment_payment_tokens', (table) => {
    table.increments('id').primary();
    table.integer('appointment_id').notNullable().references('id').inTable('appointments').onDelete('CASCADE');
    table.string('token_hash', 64).notNullable().unique();
    table.timestamp('expires_at', { useTz: true }).notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(['appointment_id'], 'appointment_payment_tokens_appointment_idx');
  });

  await knex.schema.createTable('stripe_oauth_states', (table) => {
    table.increments('id').primary();
    table.integer('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE');
    table.integer('web_user_id').notNullable().references('id').inTable('web_users').onDelete('CASCADE');
    table.string('state_token', 128).notNullable().unique();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('expires_at', { useTz: true }).notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('stripe_oauth_states');
  await knex.schema.dropTableIfExists('appointment_payment_tokens');
  await knex.schema.dropTableIfExists('payment_webhook_events');
  await knex.schema.dropTableIfExists('payment_orders');
  await knex.schema.dropTableIfExists('account_payment_providers');
  await knex.schema.dropTableIfExists('account_payment_settings');
}
