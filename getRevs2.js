sync function getRevs(pageid, latest, cont, domain){
    // console.log(pageid);
    // console.log(`latest = ${latest}`);
    let newArt
    let newDom
    let isDone = false
    if(!latest && !cont){ //either an article is new and not recursion of new or the latest is undetermined and this isn't a recursion
        //upsert article and article domain
        // recur with latest if applic
        const artExists = await knex('article').select().where({id:pageid}).first();
        if(!artExists){
            const info = await axios.get(`https://en.wikipedia.org/w/api.php?action=query&prop=info&pageids=${pageid}&format=json`)
            await knex('article').insert({id:pageid, title:info.data.query.pages[pageid].title})
        }
        const aRevIns = knex('articledomain').insert({article_id:pageid,domain_id:domain})
        console.log(aRevIns.toQuery(),pageid,domain);
        await upsert(aRevIns)
        const latestQ = knex('revision').select().whereNotNull('diff').where({article_id:pageid}).orderBy('id', 'DESC')
        // console.log(latestQ.toQuery());
        const latestRev = await latestQ.first()
        newArt = !latestRev
        if(latestRev){ //the article is not new and the latest has now been determined
            await getRevs(pageid,latestRev.id) //i forgot the awat here and it made the pool run out
            isDone = true //done //this could probably just be return
        }
    }
    if (!isDone){
        let query = `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&pageids=${pageid}&format=json&formatversion=2&rvlimit=500`
        query = latest ? query + `&rvendid=${latest}` : query
        query = cont ? query + `&rvcontinue=${cont}` : query
        console.log(query);
        const res = await axios.get(query)
        //the article is not new and the latest has been determined and this is a recursion OR the article is new and has to be imported.

        const page = res.data.query.pages[0]
        const revs = page.revisions.map(r=>{
            return {
                id:r.revid,
                article_id:pageid,//separate refactor change to pageid
                timestamp:Date.parse(r.timestamp.substring(0,r.timestamp.length-1)+"+0000")/1000
            }
        })

        if(latest && !res.data.continue){ //if query retrieved additional revisions to an article (with rvendid param) and has accessed the last requested revision (no rvcontinue), then the last revision will be the revision specified in rvendid, rather than its child revision. this pops that revision from the revs array to avoid violating the unique constraint in the db. I am not sure that it is impossible for two edits on the same article to occur the same second (which would cause the rvendid param to include any edits occuring at the same second), but because of Wiki's conflict warning system, I think this is highly unlikely.
            console.log(revs.pop())

        } 

        if(revs.length){
            await upsert(knex('revision').insert(revs))
        } //in case two revs have the same timestamp
        if(res.data.continue){
            // console.log(`latest at the end ${latest}`);
            getRevs(pageid, latest, res.data.continue.rvcontinue)
        }else{
            await addDiffs(pageid)
            // knex.destroy() now used in a later method
        }}
}