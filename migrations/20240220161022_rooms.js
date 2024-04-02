const up = function (knex) {
  return knex.schema.createTable("rooms", function (table) {
    table.increments("id").primary();
    table.string("gameId").notNullable();
    table.string("name").notNullable();
    table.jsonb("item").defaultTo({});
    table.timestamps(true, true); // Ajoute les colonnes created_at et updated_at automatiquement
  });
};

const down = function (knex) {
  return knex.schema.dropTableIfExists("rooms");
};

export { up, down };
