// migrations/xxxx_create_utilisateurs_table.js

const up = function (knex) {
  return knex.schema.createTable("users", function (table) {
    table.string("id").primary().unique();
    table.string("gameId");
    table.string("username").notNullable(); // update quand le joueur créer son ID
    table.boolean("ready").notNullable();
    table.string("hero"); // update quand le joueur à choisi son hero
    table.integer("atk"); // update quand le joueur à choisi son hero et quand il gagne un item
    table.integer("life"); // update quand le joueur à choisi son hero et quand il gagne un item
    table.string("team"); // choisir quand tout le monde est connecté et que la partie commence
    table.integer("room"); // update à chaque changement de salle
    table.string("inventory_id").unsigned(); // Clé étrangère vers la table d'inventaire
    table.foreign("inventory_id").references("inventory.id");
    table.timestamps(true, true);
  });
};

const down = function (knex) {
  return knex.schema.dropTableIfExists("users");
};

export { up, down };
