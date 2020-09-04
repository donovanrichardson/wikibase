const {upsert} = require('./utils')
const config = require('./knexfile.js')['development']
var knex = require('knex')(config);
const axios = require('axios').default;

async function addDiffs(article){
    let noDiffs = await knex('revision').select('id', 'timestamp').where({article_id:article}).whereNull('diff').orderBy('timestamp')
    const recent = await knex('revision').select().whereNotNull('diff').where({article_id:article}).orderBy('diff', 'DESC').first()
    if (noDiffs.length > 0){
        if (recent){
            console.log(noDiffs);
            if(noDiffs.length > 1){
                noDiffs.shift()
                noDiffs[0].diff = Number(noDiffs[0].timestamp) - Number(recent.timestamp)
             } //in this case the earliest timestamp with null is the first revision. If the length is 1, this cannot be the case.
        }
        for(let i = 1; i < noDiffs.length;i++){
            noDiffs[i].diff = Number(noDiffs[i].timestamp) - Number(noDiffs[i-1].timestamp)
        }
    
        noDiffs = noDiffs.filter(d => d.diff)
    
        try{
            await knex.transaction(async trx=>{
                const diffs = noDiffs.map(rev =>{
                    return trx('revision').where({id:rev.id}).update({diff:rev.diff})
                })
                await Promise.all(diffs)
                console.log(`${noDiffs.length - 1} revisions added`); //take away the art's first revision
                console.log("a diff", noDiffs);
            })
        } catch (err) {
            console.error(err)
        }
    }
}

async function fakeDiffs(article){
    let noDiffs = await knex('revision').select('id', 'timestamp').where({article_id:article}).orderBy('timestamp')
    const recent = false
    if (noDiffs.length > 0){
        if (recent){
            console.log(noDiffs);
            if(noDiffs.length > 1){
                noDiffs.shift()
             } //in this case the earliest timestamp with null is the first revision. If the length is 1, this cannot be the case.
            noDiffs[0].diff = Number(noDiffs[0].timestamp) - Number(recent.timestamp)
        }
        for(let i = 1; i < noDiffs.length;i++){
            noDiffs[i].diff = Number(noDiffs[i].timestamp) - Number(noDiffs[i-1].timestamp)
        }
    
        // noDiffs = noDiffs.filter(d => d.diff)
        console.log(noDiffs);
    }
}

// addDiffs(48848273)
// fakeDiffs(48848273)

async function addAllDiffs(){
    const arts = await knex('article').select('id')
    console.log(arts);
    for(let a = 0; a < arts.length; a++){
        await addDiffs(arts[a].id)
    }
}

// addAllDiffs()


async function getRevs(pageid, latest, cont){
    // console.log(pageid);
    // console.log(`latest = ${latest}`);
    let newArt
    let isDone = false
    if(!latest && !cont){ //either an article is new and not recursion of new or the latest is undetermined and this isn't a recursion
        //upsert article and article domain
        // recur with latest if applic
        const artExists = await knex('article').select().where({id:pageid}).first();
        if(!artExists){
            const info = await axios.get(`https://en.wikipedia.org/w/api.php?action=query&prop=info&pageids=${pageid}&format=json`)
            await knex('article').insert({id:pageid, title:info.data.query.pages[pageid].title})
        }
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

async function randomRevs(){
    console.log('how many times is this done');
    const randomArt = await axios.get('https://en.wikipedia.org/w/api.php?action=query&format=json&rnnamespace=0&list=random')

    // console.log(randomArt.data);
    const theId = randomArt.data.query.random[0].id;
    console.log(randomArt.data.query.random[0]);
    await getRevs(theId)
    // console.log("i have awaited");
    // knex.destroy()
}

async function importRandom(n=0){
    const ref = Math.floor(Date.now()/1000)
    const arts = await knex('article').select('id')
    // console.log(arts);
    const limit = arts.length
    for (let i = 0;i < limit; i ++){
        console.log(`${i+1} out of ${arts.length}`);
        await getRevs(arts[i].id)
    }
    for(let j = 0; j < n; j++){
        console.log(`${j+1} out of ${n}`);
        await randomRevs()
    }
    await knex('reference').insert({time:ref})
    // knex.destroy()
}

module.exports = {getRevs, importRandom}