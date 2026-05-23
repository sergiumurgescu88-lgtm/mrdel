const fs = require('fs');

console.log('🔧 Reparare App.tsx - problema cu website.replace...');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Găsim și înlocuim linia problematică cu website.replace
// Căutăm pattern-ul: {lead.website.replace(...)}
const oldPattern = /\{lead\.website\.replace\([^)]+\)\.replace\([^)]+\)\}/g;

const newCode = `{typeof lead.website === 'string' ? lead.website.replace(/^https?:\\/\\//, '').replace(/^www\\./, '') : (lead.website?.url || lead.website?.lynx_url || '').replace(/^https?:\\/\\//, '').replace(/^www\\./, '')}`;

if (content.match(oldPattern)) {
  content = content.replace(oldPattern, newCode);
  console.log('✅ Linia cu website.replace a fost reparată');
} else {
  console.log('⚠️  Nu am găsit pattern-ul exact, caut alternative...');
  
  // Alternativă: caută orice .replace pe website
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('lead.website') && lines[i].includes('.replace')) {
      console.log(`📍 Linia ${i + 1}: ${lines[i].trim()}`);
      
      // Înlocuiește linia cu versiune sigură
      const indent = lines[i].match(/^\s*/)[0];
      lines[i] = `${indent}{typeof lead.website === 'string' ? lead.website.replace(/^https?:\\/\\//, '').replace(/^www\\./, '') : (lead.website?.url || lead.website?.lynx_url || '').replace(/^https?:\\/\\//, '').replace(/^www\\./, '')}`;
      console.log(`✅ Linia ${i + 1} reparată`);
    }
  }
  content = lines.join('\n');
}

// De asemenea, asigură-te că href-ul este sigur
content = content.replace(
  /href=\{lead\.website\}/g,
  `href={typeof lead.website === 'string' ? lead.website : (lead.website?.url || lead.website?.lynx_url || '#')}`
);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('✅ App.tsx salvat cu succes');
