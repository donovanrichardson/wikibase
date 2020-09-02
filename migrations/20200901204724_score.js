
exports.up = function(knex) {
    return knex.schema.createTable("score", t=>{
        t.integer("article_id")
        t.bigInteger("reference_time")
        t.float('score', 8, 3)

        t.foreign('article_id').references("id").inTable("article").onDelete("CASCADE").onUpdate("CASCADE");
        t.foreign('reference_time').references("time").inTable("reference").onDelete("CASCADE").onUpdate("CASCADE");

        t.primary(["article_id","reference_time"])
    })
};

exports.down = function(knex) {
    return knex.schema.dropTable("score")
  
};
