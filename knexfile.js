// module.exports = {
//   client: "sqlite3",
//   connection: {
//     filename: "./dev.sqlite3",
//   },
//   useNullAsDefault: true,
// };

const databaseConfig = {
    client: "sqlite3",
    connection: {
        filename: process.env.KNEX_DATA
    },
    useNullAsDefault: true,
};

export default databaseConfig;