// migrations/xxxx_create_utilisateurs_table.js

const up = function (knex) {
  return knex.schema.createTable("users", function (table) {
    table.increments("id").primary();
    table.string("gameId");
    table.string("username").notNullable(); // update quand le joueur créer son ID
    table.string("heroImg"); // update quand le joueur à choisi son hero
    table.string("hero"); // update quand le joueur à choisi son hero
    table.string("color"); // update quand le joueur à choisi son hero
    table.string("abilityName"); // update quand le joueur à choisi son hero
    table.string("ability"); // update quand le joueur à choisi son hero
    table.boolean("canUsePower");
    table.integer("luckDices");
    table.string("player"); // update quand le joueur à choisi son hero
    table.integer("life"); // update quand le joueur perd une vie
    table.integer("atk"); // update quand le joueur à choisi son hero et quand il gagne un item
    table.integer("def"); // update quand le joueur à choisi son hero et quand il gagne un item
    table.integer("speed"); // update quand le joueur à choisi son hero
    table.string("team"); // choisir quand tout le monde est connecté et que la partie commence
    table.integer("room"); // update à chaque changement de salle
    table.jsonb("inventory").defaultTo("");
    table.boolean("hasKey");
    table.timestamps(true, true);
  });
};

const down = function (knex) {
  return knex.schema.dropTableIfExists("users");
};

export { up, down };
