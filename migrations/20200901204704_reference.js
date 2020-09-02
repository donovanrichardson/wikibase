
exports.up = function(knex) {
    return knex.schema.createTable('reference', t=>{
        t.bigInteger('time').primary()
    })
};

exports.down = function(knex) {
    return knex.schema.dropTable('reference')
};
