const config = require('./knexfile.js')['development']
var knex = require('knex')(config);

async function upsert(insertion){
    const query = knex.raw('? on conflict do nothing', [insertion]);
    console.log(query.toQuery());
    await query
}

module.exports = {upsert}