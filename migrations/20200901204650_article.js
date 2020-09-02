
exports.up = function(knex) {
    return knex.schema.createTable('article', t=>{
        t.integer('id').primary()
        t.text('title')
    })
};

exports.down = function(knex) {
    return knex.schema.dropTable('article')
};
