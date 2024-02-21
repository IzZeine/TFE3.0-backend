const up = function (knex) {
  return knex.schema.createTable("games", function (table) {
    // état de la partie :
    // ID -> string uuidv4
    table.string("gameId").primary().unique().notNullable();
    // name -> string
    table.string("name").notNullable();
    // statut -> waiting / inactive / sarted / cleared
    table.string("statut").notNullable();
    // started -> Boolean
    table.boolean("started").notNullable();
    // step de la partie -> float
    table.float("step").notNullable();
    // nbre de rooms -> 39 -> float
    table.float("rooms").notNullable();
    // nbre de joueurs -> entre 2 et 6 -> float
    table.float("users");

    table.timestamps(true, true); // Ajoute les colonnes created_at et updated_at automatiquement
  });
};

const down = function (knex) {
  return knex.schema.dropTableIfExists("rooms");
};

export { up, down };
