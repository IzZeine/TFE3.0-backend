// migrations/xxxx_create_inventory_table.js

const up = function (knex) {
  return knex.schema.createTable("inventory", function (table) {
    table.string("id").primary().unique();
    table.string("itemName").notNullable();
    table.integer("quantity").notNullable().defaultTo(0);
    table.integer("user_id").unsigned(); // Clé étrangère vers la table des utilisateurs
    table.foreign("user_id").references("users.id"); // Définition de la clé étrangère
    table.timestamps(true, true);
  });
};

const down = function (knex) {
  return knex.schema.dropTableIfExists("inventory");
};

export { up, down };
