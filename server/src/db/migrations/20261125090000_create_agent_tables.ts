import type { Knex } from 'knex';

// In-app setup assistant: chat history, changes waiting for the user's confirmation and daily usage per account.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('agent_conversations', (table) => {
    table.uuid('id').primary();
    table.integer('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE');
    table.integer('web_user_id').notNullable().references('id').inTable('web_users').onDelete('CASCADE');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(['account_id', 'web_user_id', 'updated_at'], 'agent_conversations_user_updated_index');
  });

  await knex.schema.createTable('agent_messages', (table) => {
    table.bigIncrements('id');
    table.uuid('conversation_id').notNullable().references('id').inTable('agent_conversations').onDelete('CASCADE');
    table.enum('role', ['user', 'assistant']).notNullable();
    // Content blocks exactly as exchanged with the model, so the history can be replayed unchanged.
    table.jsonb('content').notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(['conversation_id', 'id'], 'agent_messages_conversation_index');
  });

  await knex.schema.createTable('agent_pending_actions', (table) => {
    table.uuid('id').primary();
    table.integer('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE');
    table.integer('web_user_id').notNullable().references('id').inTable('web_users').onDelete('CASCADE');
    table.uuid('conversation_id').notNullable().references('id').inTable('agent_conversations').onDelete('CASCADE');
    table.jsonb('changes').notNullable();
    table.enum('status', ['pending', 'confirmed', 'rejected', 'expired', 'failed']).notNullable().defaultTo('pending');
    table.jsonb('result');
    table.timestamp('expires_at', { useTz: true }).notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('resolved_at', { useTz: true });
    // Set once the outcome (applied, rejected, failed) has been passed back to the model.
    table.timestamp('reported_at', { useTz: true });
    table.index(['conversation_id', 'status'], 'agent_pending_actions_conversation_status_index');
  });

  await knex.schema.createTable('agent_usage_daily', (table) => {
    table.integer('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE');
    table.date('usage_date').notNullable();
    table.bigInteger('input_tokens').notNullable().defaultTo(0);
    table.bigInteger('output_tokens').notNullable().defaultTo(0);
    table.integer('messages').notNullable().defaultTo(0);
    table.primary(['account_id', 'usage_date']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('agent_usage_daily');
  await knex.schema.dropTableIfExists('agent_pending_actions');
  await knex.schema.dropTableIfExists('agent_messages');
  await knex.schema.dropTableIfExists('agent_conversations');
}
