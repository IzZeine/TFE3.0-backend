// migrations/xxxx_create_utilisateurs_table.js

const up = function (knex) {
  return knex.schema.createTable("users", function (table) {
    table.string("ID").primary().unique();
    table.string("username").notNullable();
    table.string("inventory_id").unsigned(); // Clé étrangère vers la table d'inventaire
    table.foreign("inventory_id").references("inventory.id");
    table.timestamps(true, true);
  });
};

const down = function (knex) {
  return knex.schema.dropTableIfExists("users");
};

export { up, down };
