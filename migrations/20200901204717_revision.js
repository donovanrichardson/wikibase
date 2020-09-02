
exports.up = function(knex) {
    return knex.schema.createTable('revision', t=>{
        t.bigInteger("id").primary()
        t.integer("article_id")
        t.bigInteger("timestamp")
        t.integer("diff")

        t.foreign('article_id').references("id").inTable("article").onDelete("CASCADE").onUpdate("CASCADE");
    })
};

exports.down = function(knex) {
    return knex.schema.dropTable("revision")
};
