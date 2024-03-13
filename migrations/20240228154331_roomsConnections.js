const up = function (knex) {
  return knex.schema.createTable("roomsConnections", function (table) {
    table.string("initialRoom").primary().notNullable();
    table.string("destinationRoom").notNullable();
    table.string("direction").notNullable();

    table.timestamps(true, true); // Ajoute les colonnes created_at et updated_at automatiquement
  });
};

const down = function (knex) {
  return knex.schema.dropTableIfExists("roomsConnections");
};

export { up, down };
