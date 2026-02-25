const f = require('../feature_list.json');
const agents = {};
f.features.forEach(x => {
  if (!agents[x.agent]) agents[x.agent] = {total:0, p0:0, p1:0, p2:0};
  agents[x.agent].total++;
  agents[x.agent]['p' + x.priority.charAt(1)]++;
});
Object.entries(agents)
  .sort((a,b) => b[1].total - a[1].total)
  .forEach(([k,v]) => console.log(`${k}: ${v.total} (P0:${v.p0} P1:${v.p1} P2:${v.p2})`));
