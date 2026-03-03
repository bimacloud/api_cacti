require('dotenv').config({ path: '/opt/lampp/htdocs/cacti/api/.env' });
const db = require('./src/config/database');

async function test() {
    try {
        console.log("Connecting to:", process.env.DB_HOST, process.env.DB_USER);
        const [rows] = await db.query('SELECT 1 as val');
        console.log("Success:", rows);
        process.exit(0);
    } catch (e) {
        console.error("DB Error:", e.message);
        process.exit(1);
    }
}
test();
