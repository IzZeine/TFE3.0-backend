const up = function (knex) {
  return knex.schema.createTable("games", function (table) {
    // état de la partie :
    // ID -> string uuidv4
    table.string("gameId").primary().unique().notNullable();
    // name -> string
    table.string("name").notNullable().unique();
    // statut -> waiting / inactive / closed / started / ended / toClear
    table.string("statut").notNullable();
    // nbre de rooms -> 39 -> integer
    table.integer("rooms").notNullable();
    // nbre de joueurs -> entre 2 et 6 -> integer
    table.integer("users");

    table.timestamps(true, true); // Ajoute les colonnes created_at et updated_at automatiquement
  });
};

const down = function (knex) {
  return knex.schema.dropTableIfExists("rooms");
};

export { up, down };
