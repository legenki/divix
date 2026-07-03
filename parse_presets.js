const fs = require('fs');
const vm = require('vm');
let content = fs.readFileSync('reference/drift/scripts/presets.js', 'utf8');
const context = {};
vm.createContext(context);
vm.runInContext(content, context);
fs.writeFileSync('public/assets/deriva/presets.json', JSON.stringify(context, null, 2));
