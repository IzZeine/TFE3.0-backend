const up = function (knex) {
  return knex.schema.createTable("roomsConnections", function (table) {
    table.string("initialRoom").primary().notnullabe();
    table.string("destinationRoom").notnullabe();
    table.string("direction").notnullabe();

    table.timestamps(true, true); // Ajoute les colonnes created_at et updated_at automatiquement
  });
};

const down = function (knex) {
  return knex.schema.dropTableIfExists("roomsConnections");
};

export { up, down };
