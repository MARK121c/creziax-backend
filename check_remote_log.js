const path = require('path');
const BACKEND_DIR = 'e:\\DOWNLOADS\\الموقع الكتروني بتاع الاجينت المخصص لليوتيوب\\نظام الداخلي للشركة\\creziax-backend-repo';
const git = require(path.join(BACKEND_DIR, 'node_modules', 'isomorphic-git'));
const http = require(path.join(BACKEND_DIR, 'node_modules', 'isomorphic-git', 'http', 'node'));
const fs = require('fs');

async function main() {
  try {
    const log = await git.log({ 
      fs, 
      http, 
      url: 'https://github.com/MARK121c/creziax-portal.git', 
      ref: 'main', 
      depth: 3 
    });
    console.log(JSON.stringify(log, null, 2));
  } catch (err) {
    console.error(err);
  }
}

main();
